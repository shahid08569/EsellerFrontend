import { Component, OnInit, OnDestroy, HostListener, inject, signal, computed, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthStore, ToastService, SignalRService, ChatService, SkeletonLayout, ParsedReply, parseMessageReply, buildReplyMessage, cleanMessagePreview } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminChatUnreadService } from '../../../core/services/admin-chat-unread.service';

export interface AdminChatShop {
  id: string;
  name: string;
  conversationId?: string | null;
  shopId?: string | null;
  logoUrl?: string | null;
  lastMessage?: string | null;
  lastMessageTime?: string | Date | null;
  city?: string;
  country?: string;
  phone?: string;
  totalProducts?: number;
  merchantStatus: 'Approved' | 'Pending' | 'Rejected' | string;
  tierLabel: string;
}

export interface AdminToSellerMessage {
  id: string;
  sender: 'admin' | 'seller';
  senderName: string;
  message: string;
  timestamp: string;
  attachmentUrl?: string | null;
  attachmentFileName?: string | null;
  attachmentContentType?: string | null;
  isEdited?: boolean;
  editedAt?: string | Date | null;
  isDeletedForEveryone?: boolean;
  isTemp?: boolean;
  isDelivered?: boolean;
  deliveredAt?: string | Date | null;
  isRead?: boolean;
  readAt?: string | Date | null;
}

@Component({
  selector: 'app-admin-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
  templateUrl: './admin-chat-widget.html',
  styleUrls: ['./admin-chat-widget.css']
})
export class AdminChatWidget implements OnInit, OnDestroy, AfterViewChecked {
  private readonly adminService = inject(AdminService);
  readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);
  private readonly signalR = inject(SignalRService);
  private readonly chatService = inject(ChatService);
  readonly chatUnread = inject(AdminChatUnreadService);
  readonly cleanMessagePreview = cleanMessagePreview;

  readonly isPartner = computed(() => this.authStore.role() === 'Partner');
  readonly isSuperAdmin = computed(() => this.authStore.role() === 'SuperAdmin');

  @ViewChild('messagesContainer') private messagesContainer?: ElementRef;

  private unsubscribeSignalR?: () => void;
  private unsubscribeEdited?: () => void;
  private unsubscribeDeleted?: () => void;
  private unsubscribeMessageDelivered?: () => void;
  private unsubscribeMessageRead?: () => void;

  readonly isOpen = signal<boolean>(false);
  readonly messageText = signal<string>('');
  readonly isSending = signal<boolean>(false);
  readonly uploadingFile = signal<boolean>(false);
  readonly pendingAttachment = signal<{
    url: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  } | null>(null);

  readonly shops = signal<AdminChatShop[]>([]);
  readonly selectedShop = signal<AdminChatShop | null>(null);
  readonly sellerSearchTerm = signal<string>('');
  readonly currentView = signal<'directory' | 'chat'>('directory');
  readonly directoryTab = signal<'support' | 'customers' | 'partners' | 'stores' | 'partner-service'>('support');
  readonly messagesMap = signal<Record<string, AdminToSellerMessage[]>>({});
  readonly isLoadingShops = signal<boolean>(false);
  readonly isLoadingCustomers = signal<boolean>(false);
  readonly isLoadingMessages = signal<boolean>(false);
  readonly customerConvos = signal<any[]>([]);
  readonly partnerConvos = signal<any[]>([]);
  readonly partnerServiceShop = signal<AdminChatShop | null>(null);
  readonly editingMessage = signal<AdminToSellerMessage | null>(null);
  readonly replyingTo = signal<ParsedReply | null>(null);
  readonly deleteModalMessage = signal<AdminToSellerMessage | null>(null);
  readonly activeMenuMessageId = signal<string | null>(null);
  readonly menuOpenUpwards = signal<boolean>(false);
  readonly isSelectionMode = signal<boolean>(false);
  readonly selectedMessageIds = signal<string[]>([]);
  readonly batchDeleteModalOpen = signal<boolean>(false);

  readonly selectedCount = computed(() => this.selectedMessageIds().length);
  readonly canDeleteSelectedForEveryone = computed(() => {
    const ids = this.selectedMessageIds();
    if (ids.length === 0) return false;
    const msgs = this.getCurrentMessages();
    const idSet = new Set(ids);
    const selected = msgs.filter(m => idSet.has(m.id));
    return selected.length > 0 && selected.every(m => m.sender === 'admin' && !m.isDeletedForEveryone);
  });

  readonly filteredShops = computed(() => {
    const partnerId = this.partnerServiceShop()?.id;
    let list = this.shops();
    if (this.isPartner() && partnerId) {
      list = list.filter(s => s.id !== partnerId);
    }
    const term = this.sellerSearchTerm().trim().toLowerCase();
    let filtered = list;
    if (term) {
      filtered = list.filter(s =>
        s.name.toLowerCase().includes(term) ||
        (s.city && s.city.toLowerCase().includes(term)) ||
        (s.lastMessage && s.lastMessage.toLowerCase().includes(term))
      );
    }
    return [...filtered].sort((a, b) => {
      const au = this.chatUnread.unreadFor(a.id) > 0 ? 1 : 0;
      const bu = this.chatUnread.unreadFor(b.id) > 0 ? 1 : 0;
      if (au !== bu) return bu - au;
      const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.name.localeCompare(b.name);
    });
  });

  readonly filteredCustomerConvos = computed(() => {
    const term = this.sellerSearchTerm().trim().toLowerCase();
    let list = this.customerConvos();
    if (term) {
      list = list.filter(c => this.customerDisplayName(c).toLowerCase().includes(term)
        || String(c.lastMessage || '').toLowerCase().includes(term));
    }
    return [...list].sort((a, b) => {
      const aId = String(a.orderRequestId || a.id || '');
      const bId = String(b.orderRequestId || b.id || '');
      const au = (this.chatUnread.unreadFor(aId) || a.unreadCount || 0) > 0 ? 1 : 0;
      const bu = (this.chatUnread.unreadFor(bId) || b.unreadCount || 0) > 0 ? 1 : 0;
      if (au !== bu) return bu - au;
      return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
    });
  });

  readonly filteredPartnerConvos = computed(() => {
    const term = this.sellerSearchTerm().trim().toLowerCase();
    let list = this.partnerConvos();
    if (term) {
      list = list.filter(c => this.customerDisplayName(c).toLowerCase().includes(term)
        || String(c.lastMessage || '').toLowerCase().includes(term));
    }
    return [...list].sort((a, b) => {
      const aId = String(a.orderRequestId || a.id || '');
      const bId = String(b.orderRequestId || b.id || '');
      const au = (this.chatUnread.unreadFor(aId) || a.unreadCount || 0) > 0 ? 1 : 0;
      const bu = (this.chatUnread.unreadFor(bId) || b.unreadCount || 0) > 0 ? 1 : 0;
      if (au !== bu) return bu - au;
      return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
    });
  });

  readonly supportUnreadTotal = computed(() =>
    this.shops().reduce((sum, s) => sum + this.chatUnread.unreadFor(s.id), 0)
  );

  readonly customerUnreadTotal = computed(() =>
    this.customerConvos().reduce((sum, c) => {
      const id = String(c.orderRequestId || c.id || '');
      return sum + Math.max(Number(c.unreadCount || 0), id ? this.chatUnread.unreadFor(id) : 0);
    }, 0)
  );

  readonly partnersUnreadTotal = computed(() =>
    this.partnerConvos().reduce((sum, c) => {
      const id = String(c.orderRequestId || c.id || '');
      return sum + Math.max(Number(c.unreadCount || 0), id ? this.chatUnread.unreadFor(id) : 0);
    }, 0)
  );

  readonly storesUnreadTotal = computed(() => {
    const pId = this.partnerServiceShop()?.id;
    return this.shops().filter(s => s.id !== pId).reduce((sum, s) => sum + this.chatUnread.unreadFor(s.id), 0);
  });

  readonly partnerServiceUnreadTotal = computed(() => {
    const shop = this.partnerServiceShop();
    return shop ? this.chatUnread.unreadFor(shop.id) : 0;
  });

  private shouldScrollToBottom = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private joinedRoomId: string | null = null;

  ngOnInit(): void {
    this.chatUnread.start();
    if (this.isPartner()) {
      this.directoryTab.set('stores');
      this.chatService.getPartnerSupportSession().subscribe({
        next: (session) => {
          const roomId = session.conversationId || session.orderRequestId;
          this.partnerServiceShop.set({
            id: roomId,
            name: 'Partner Service',
            merchantStatus: 'Official Support',
            tierLabel: 'Partner Service'
          });
          this.loadShops();
        },
        error: () => {
          this.loadShops();
        }
      });
    } else {
      this.directoryTab.set('support');
      this.loadShops();
      this.loadCustomerConvos();
    }

    this.signalR.startChatConnection().then(() => {
      this.unsubscribeSignalR = this.signalR.onReceiveMessage((incoming) => {
        if (this.isMyMessage(incoming)) {
          return;
        }

        const incomingRoom = incoming.orderRequestId;
        if (!incomingRoom) return;

        const matchingShop = this.shops().find(s =>
          s.id?.toLowerCase() === incomingRoom.toLowerCase() ||
          s.conversationId?.toLowerCase() === incomingRoom.toLowerCase()
        );
        const targetMapKey = matchingShop?.conversationId || matchingShop?.id || incomingRoom;

        const exists = (this.messagesMap()[targetMapKey] || this.messagesMap()[incomingRoom] || []).some(
          m => m.id && incoming.messageId && m.id.toLowerCase() === String(incoming.messageId).toLowerCase()
        );
        if (exists) return;

        let shopName = matchingShop?.name;
        if (!shopName && this.partnerServiceShop()?.id?.toLowerCase() === incomingRoom.toLowerCase()) {
          shopName = 'Partner Service';
        }
        if (!shopName) {
          const p = this.partnerConvos().find(c => String(c.orderRequestId || c.id || '').toLowerCase() === incomingRoom.toLowerCase());
          if (p) shopName = this.customerDisplayName(p);
        }
        if (!shopName) {
          const cust = this.customerConvos().find(c => String(c.orderRequestId || c.id || '').toLowerCase() === incomingRoom.toLowerCase());
          if (cust) shopName = this.customerDisplayName(cust);
        }
        if (!shopName) shopName = 'Contact';

        const senderDisplayName = this.getSenderDisplayName(incoming, false, shopName);

        this.messagesMap.update(map => {
          const existingList = map[targetMapKey] || map[incomingRoom] || [];
          const list = existingList.filter(m =>
            !(m.sender === 'seller' && String(m.id).startsWith('tmp-')
              && (m.message === incoming.message
                || (!!incoming.attachmentUrl && m.attachmentUrl === incoming.attachmentUrl)))
          );
          const newMsg = {
            id: incoming.messageId || `m-${Date.now()}`,
            sender: 'seller' as const,
            senderName: senderDisplayName,
            message: incoming.message,
            timestamp: new Date(incoming.sentAt || Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            }),
            attachmentUrl: incoming.attachmentUrl || null,
            attachmentFileName: incoming.attachmentFileName || null,
            attachmentContentType: incoming.attachmentContentType || null
          };
          return {
            ...map,
            [targetMapKey]: [...list, newMsg]
          };
        });

        const previewText = incoming.message || (incoming.attachmentUrl ? '📎 Attachment' : 'New message');
        this.shops.update(currentList => currentList.map(s => {
          if (s.id.toLowerCase() === incomingRoom.toLowerCase() || (s.conversationId && s.conversationId.toLowerCase() === incomingRoom.toLowerCase())) {
            return {
              ...s,
              lastMessage: previewText,
              lastMessageTime: incoming.sentAt || new Date().toISOString()
            };
          }
          return s;
        }));

        if (this.partnerServiceShop()?.id?.toLowerCase() === incomingRoom.toLowerCase()) {
          const current = this.partnerServiceShop();
          if (current) {
            this.partnerServiceShop.set({
              ...current,
              lastMessage: previewText,
              lastMessageTime: incoming.sentAt || new Date().toISOString()
            });
          }
        }

        this.partnerConvos.update(currentList => currentList.map(c => {
          if (String(c.orderRequestId || c.id || '').toLowerCase() === incomingRoom.toLowerCase()) {
            return {
              ...c,
              lastMessage: previewText,
              lastMessageAt: incoming.sentAt || new Date().toISOString()
            };
          }
          return c;
        }));

        const activeShop = this.selectedShop();
        const activeThreadId = activeShop?.conversationId || activeShop?.id;
        const isActiveOpen =
          this.isOpen()
          && this.currentView() === 'chat'
          && (activeShop?.id?.toLowerCase() === incomingRoom.toLowerCase() ||
              activeThreadId?.toLowerCase() === incomingRoom.toLowerCase());

        if (isActiveOpen) {
          this.chatUnread.markConversationRead(incomingRoom);
          if (targetMapKey !== incomingRoom) {
            this.chatUnread.markConversationRead(targetMapKey);
          }
        } else {
          this.chatUnread.bump(incomingRoom, 1);
          this.toast.show(`New chat from ${shopName}`, 'info');
        }
        this.queueScrollToLatest();
      });

      this.unsubscribeEdited = this.signalR.onMessageEdited((payload) => {
        this.messagesMap.update(map => {
          const next: Record<string, AdminToSellerMessage[]> = {};
          for (const [k, v] of Object.entries(map)) {
            next[k] = v.map(m =>
              m.id && m.id.toLowerCase() === payload.messageId.toLowerCase()
                ? { ...m, message: payload.newContent, isEdited: true, editedAt: payload.editedAt }
                : m
            );
          }
          return next;
        });
      });

      this.unsubscribeDeleted = this.signalR.onMessageDeleted((payload) => {
        this.messagesMap.update(map => {
          const next: Record<string, AdminToSellerMessage[]> = {};
          for (const [k, v] of Object.entries(map)) {
            if (payload.isDeletedForEveryone) {
              next[k] = v.map(m =>
                m.id && m.id.toLowerCase() === payload.messageId.toLowerCase()
                  ? { ...m, message: 'This message was deleted', isDeletedForEveryone: true, attachmentUrl: null, attachmentFileName: null }
                  : m
              );
            } else {
              next[k] = v.filter(m => !m.id || m.id.toLowerCase() !== payload.messageId.toLowerCase());
            }
          }
          return next;
        });
      });

      this.unsubscribeMessageDelivered = this.signalR.onMessageDelivered((messageId, deliveredAt) => {
        this.messagesMap.update(map => {
          const next: Record<string, AdminToSellerMessage[]> = {};
          for (const [k, v] of Object.entries(map)) {
            next[k] = v.map(m =>
              m.id && m.id.toLowerCase() === messageId.toLowerCase()
                ? { ...m, isDelivered: true, deliveredAt: deliveredAt || new Date().toISOString() }
                : m
            );
          }
          return next;
        });
      });

      this.unsubscribeMessageRead = this.signalR.onMessageRead((messageId, readAt) => {
        this.messagesMap.update(map => {
          const next: Record<string, AdminToSellerMessage[]> = {};
          for (const [k, v] of Object.entries(map)) {
            next[k] = v.map(m =>
              m.id && m.id.toLowerCase() === messageId.toLowerCase()
                ? { ...m, isRead: true, isDelivered: true, readAt: readAt || new Date().toISOString() }
                : m
            );
          }
          return next;
        });
      });
    }).catch(() => {});

    this.pollTimer = setInterval(() => {
      this.chatUnread.refresh();
      if (this.isOpen() && this.selectedShop() && this.currentView() === 'chat') {
        const activeShop = this.selectedShop()!;
        const threadId = activeShop.conversationId || activeShop.id;
        this.fetchLiveMessagesSilent(threadId, activeShop.id);
      }
    }, 15000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.unsubscribeSignalR?.();
    this.unsubscribeEdited?.();
    this.unsubscribeDeleted?.();
    this.unsubscribeMessageDelivered?.();
    this.unsubscribeMessageRead?.();
    if (this.joinedRoomId) {
      this.signalR.leaveOrderRoom(this.joinedRoomId).catch(() => {});
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
    }
  }

  loadShops(): void {
    this.isLoadingShops.set(true);
    this.adminService.getShopkeepers().subscribe({
      next: (keepers) => {
        const mapped: AdminChatShop[] = (keepers || [])
          .filter(k => !!k.shopId && String(k.status).toLowerCase() !== 'rejected')
          .map(k => ({
            id: k.shopId as string,
            name: k.storeName || k.name || 'Store',
            logoUrl: (k as any).logoUrl || null,
            city: k.city,
            country: k.country,
            phone: k.phone,
            totalProducts: k.totalProducts || 0,
            merchantStatus: this.normalizeStatus(k.status),
            tierLabel: (k as any).badgeText || (k as any).tierName || 'Bronze (Free)'
          }));

        this.shops.set(mapped);
        this.isLoadingShops.set(false);

        if (this.isPartner()) {
          this.syncShopConversations();
          return;
        }

        this.adminService.getShops(1, 100).subscribe({
          next: (res) => {
            const items = res?.items || [];
            const merged = [...this.shops()];
            for (const shop of items) {
              const existingShop = merged.find(s => s.id === shop.id);
              if (existingShop) {
                if (!existingShop.logoUrl && shop.logoUrl) {
                  existingShop.logoUrl = shop.logoUrl;
                }
              } else {
                merged.push({
                  id: shop.id,
                  name: shop.name,
                  logoUrl: shop.logoUrl || null,
                  city: shop.city ?? undefined,
                  country: shop.country ?? undefined,
                  phone: shop.phone ?? undefined,
                  totalProducts: shop.totalProducts || 0,
                  merchantStatus: 'Approved',
                  tierLabel: (shop as any).badgeText || (shop as any).tierName || 'Bronze (Free)'
                });
              }
            }
            this.shops.set(merged);
            this.syncShopConversations();
          },
          error: () => {
            this.syncShopConversations();
          }
        });
      },
      error: () => {
        if (this.isPartner()) {
          this.shops.set([]);
          this.isLoadingShops.set(false);
          this.syncShopConversations();
          return;
        }

        this.adminService.getShops(1, 100).subscribe({
          next: (res) => {
            this.shops.set((res?.items || []).map(shop => ({
              id: shop.id,
              name: shop.name,
              logoUrl: shop.logoUrl || null,
              city: shop.city ?? undefined,
              country: shop.country ?? undefined,
              phone: shop.phone ?? undefined,
              totalProducts: shop.totalProducts || 0,
              merchantStatus: 'Approved',
              tierLabel: 'Bronze (Free)'
            })));
            this.isLoadingShops.set(false);
            this.syncShopConversations();
          },
          error: () => {
            this.isLoadingShops.set(false);
            this.syncShopConversations();
          }
        });
      }
    });
  }

  setDirectoryTab(tab: 'support' | 'customers' | 'partners' | 'stores' | 'partner-service'): void {
    this.directoryTab.set(tab);
    this.sellerSearchTerm.set('');
    if (tab === 'customers' && !this.customerConvos().length) {
      this.loadCustomerConvos();
    }
  }

  selectShop(shop: AdminChatShop): void {
    this.directoryTab.set(this.isPartner() ? 'stores' : 'support');
    this.openThread(shop);
  }

  selectCustomerConvo(convo: any): void {
    const id = String(convo?.orderRequestId || convo?.id || '');
    if (!id) return;
    this.directoryTab.set('customers');
    this.openThread({
      id,
      name: this.customerDisplayName(convo),
      merchantStatus: 'Approved',
      tierLabel: 'Customer'
    });
  }

  selectPartnerConvo(convo: any): void {
    const id = String(convo?.orderRequestId || convo?.id || '');
    if (!id) return;
    this.directoryTab.set('partners');
    this.openThread({
      id,
      name: this.customerDisplayName(convo),
      merchantStatus: 'Partner',
      tierLabel: 'Partner'
    });
  }

  private openThread(shop: AdminChatShop): void {
    const threadId = shop.conversationId || shop.id;
    if (this.joinedRoomId && this.joinedRoomId !== threadId && this.joinedRoomId !== shop.id) {
      this.signalR.leaveOrderRoom(this.joinedRoomId).catch(() => {});
    }

    this.cancelEdit();
    this.cancelReply();
    this.exitSelectionMode();
    this.selectedShop.set(shop);
    this.currentView.set('chat');
    this.isLoadingMessages.set(true);

    this.signalR.joinOrderRoom(threadId).then(() => {
      this.joinedRoomId = threadId;
    }).catch(() => {});
    if (shop.id && shop.id !== threadId) {
      this.signalR.joinOrderRoom(shop.id).catch(() => {});
    }

    this.chatUnread.markConversationRead(threadId);
    this.chatUnread.markConversationRead(shop.id);
    this.fetchLiveMessages(threadId, shop.id);
    this.queueScrollToLatest();
  }

  syncShopConversations(): void {
    if (this.isPartner()) {
      this.customerConvos.set([]);
      this.partnerConvos.set([]);
      this.isLoadingCustomers.set(false);
    }

    this.adminService.getConversations(1, 500).subscribe({
      next: (list) => {
        const convos = list || [];
        if (this.isPartner()) {
          const saConvo = convos.find((c: any) => String(c.participantType || '').toLowerCase() === 'partner');
          if (saConvo) {
            const current = this.partnerServiceShop();
            this.partnerServiceShop.set({
              id: saConvo.orderRequestId || saConvo.id || current?.id || '',
              name: 'Partner Service',
              merchantStatus: 'Official Support',
              tierLabel: 'Partner Service',
              lastMessage: saConvo.lastMessage || null,
              lastMessageTime: saConvo.lastMessageAt || null
            });
          }
        } else {
          const customers = convos.filter((c: any) => String(c.participantType || '').toLowerCase() === 'customer');
          this.customerConvos.set(customers);

          const partners = convos.filter((c: any) => String(c.participantType || '').toLowerCase() === 'partner');
          this.partnerConvos.set(partners);
          this.isLoadingCustomers.set(false);
        }

        // Update seller shops with conversationId, lastMessage, lastMessageTime, and logoUrl
        this.shops.update(currentList => currentList.map(shop => {
          const matching = convos.find((c: any) =>
            String(c.orderRequestId || c.id || '').toLowerCase() === shop.id.toLowerCase() ||
            String(c.shopId || '').toLowerCase() === shop.id.toLowerCase() ||
            String(c.participantId || '').toLowerCase() === shop.id.toLowerCase()
          );
          if (matching) {
            const convoRoomId = String(matching.orderRequestId || matching.id || '');
            return {
              ...shop,
              conversationId: convoRoomId,
              shopId: shop.id,
              lastMessage: matching.lastMessage || shop.lastMessage || null,
              lastMessageTime: matching.lastMessageAt || shop.lastMessageTime || null,
              logoUrl: shop.logoUrl || matching.logoUrl || null
            };
          }
          return shop;
        }));
      },
      error: () => {
        this.isLoadingCustomers.set(false);
      }
    });
  }

  loadCustomerConvos(): void {
    if (this.isPartner()) {
      this.customerConvos.set([]);
      this.isLoadingCustomers.set(false);
      return;
    }
    this.isLoadingCustomers.set(true);
    this.syncShopConversations();
  }

  isSellerSupportConvo(convo: any): boolean {
    const pt = String(convo?.participantType || convo?.ParticipantType || '').toLowerCase();
    if (pt === 'seller' || pt === '2' || pt === 'shopkeeper') return true;
    if (pt === 'customer' || pt === '1' || pt === 'user') return false;
    const s = String(convo?.orderStatus || '');
    return s.includes('Merchant') || s.includes('Partner') || s.includes('Verification')
      || s.includes('Active Partner') || s.includes('Seller');
  }

  customerDisplayName(convo: any): string {
    return convo?.customerName || convo?.participantName || convo?.shopName || 'Contact';
  }

  customerInitials(convo: any): string {
    const name = this.customerDisplayName(convo).trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    return (name.charAt(0) || '?').toUpperCase();
  }

  backToDirectory(): void {
    this.cancelEdit();
    this.cancelReply();
    this.exitSelectionMode();
    this.currentView.set('directory');
    this.chatUnread.refresh();
    if (!this.isPartner() && this.directoryTab() === 'customers') this.loadCustomerConvos();
  }

  openPartnerServiceChat(): void {
    const pShop = this.partnerServiceShop();
    if (pShop) {
      this.directoryTab.set('partner-service');
      this.openThread(pShop);
      return;
    }

    this.isLoadingMessages.set(true);
    this.chatService.getPartnerSupportSession().subscribe({
      next: (session) => {
        const roomId = session.conversationId || session.orderRequestId;
        const shop: AdminChatShop = {
          id: roomId,
          name: 'Partner Service',
          merchantStatus: 'Official Support',
          tierLabel: 'Partner Service'
        };
        this.partnerServiceShop.set(shop);
        this.directoryTab.set('partner-service');
        this.openThread(shop);
      },
      error: () => {
        this.isLoadingMessages.set(false);
        this.currentView.set('directory');
        if (!this.shops().length) this.loadShops();
      }
    });
  }

  toggleChat(): void {
    const nextState = !this.isOpen();
    this.isOpen.set(nextState);
    if (nextState) {
      this.chatUnread.refresh();
      this.currentView.set('directory');
      if (this.isPartner()) {
        this.directoryTab.set('stores');
        if (!this.shops().length) this.loadShops();
      } else {
        this.directoryTab.set('support');
        if (!this.shops().length) this.loadShops();
        this.loadCustomerConvos();
      }
    }
  }

  shopUnread(shopId: string): number {
    return this.chatUnread.unreadFor(shopId);
  }

  closeChat(): void {
    this.isOpen.set(false);
  }

  getCurrentMessages(): AdminToSellerMessage[] {
    const shop = this.selectedShop();
    if (!shop) return [];
    const threadId = shop.conversationId || shop.id;
    return this.messagesMap()[threadId] || this.messagesMap()[shop.id] || [];
  }

  fetchLiveMessages(targetId: string, fallbackShopId?: string): void {
    this.adminService.getOrderMessages(targetId, 1, 50).subscribe({
      next: (msgs: any[]) => {
        this.isLoadingMessages.set(false);
        const list = Array.isArray(msgs) ? msgs : (msgs as any)?.items || [];
        if (!list || !list.length) {
          if (fallbackShopId && fallbackShopId !== targetId) {
            this.adminService.getOrderMessages(fallbackShopId, 1, 50).subscribe({
              next: (fallbackMsgs: any[]) => {
                const fbList = Array.isArray(fallbackMsgs) ? fallbackMsgs : (fallbackMsgs as any)?.items || [];
                if (fbList && fbList.length) {
                  this.populateMessagesForShop(targetId, fbList);
                } else {
                  this.ensureWelcomeMessage(targetId);
                }
              },
              error: () => this.ensureWelcomeMessage(targetId)
            });
            return;
          }
          this.ensureWelcomeMessage(targetId);
          return;
        }
        this.populateMessagesForShop(targetId, list);
      },
      error: () => {
        this.isLoadingMessages.set(false);
      }
    });
  }

  fetchLiveMessagesSilent(targetId: string, fallbackShopId?: string): void {
    this.adminService.getOrderMessages(targetId, 1, 50).subscribe({
      next: (msgs: any[]) => {
        const list = Array.isArray(msgs) ? msgs : (msgs as any)?.items || [];
        if (list && list.length) {
          this.populateMessagesForShop(targetId, list);
        } else if (fallbackShopId && fallbackShopId !== targetId) {
          this.adminService.getOrderMessages(fallbackShopId, 1, 50).subscribe({
            next: (fallbackMsgs: any[]) => {
              const fbList = Array.isArray(fallbackMsgs) ? fallbackMsgs : (fallbackMsgs as any)?.items || [];
              if (fbList && fbList.length) {
                this.populateMessagesForShop(targetId, fbList);
              }
            },
            error: () => {}
          });
        }
      },
      error: () => {}
    });
  }

  private populateMessagesForShop(targetId: string, list: any[]): void {
    const formatted: AdminToSellerMessage[] = list.map((m: any) => {
      const isMe = this.isMyMessage(m);
      const isDel = !!(m.isDeletedForEveryone ?? m.IsDeletedForEveryone);
      return {
        id: m.id || `msg-${Math.random()}`,
        sender: isMe ? 'admin' : 'seller',
        senderName: this.getSenderDisplayName(m, isMe),
        message: isDel ? 'This message was deleted' : (m.message || m.content || ''),
        timestamp: new Date(m.sentAt || m.createdAt || Date.now()).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        }),
        attachmentUrl: isDel ? null : (m.attachmentUrl || null),
        attachmentFileName: isDel ? null : (m.attachmentFileName || null),
        attachmentContentType: isDel ? null : (m.attachmentContentType || null),
        isEdited: !!(m.isEdited ?? m.IsEdited),
        editedAt: m.editedAt || m.EditedAt || null,
        isDeletedForEveryone: isDel,
        isRead: !!(m.isRead ?? m.IsRead),
        readAt: m.readAt || m.ReadAt || null,
        isDelivered: !!(m.deliveredAt || m.DeliveredAt || m.isRead || m.IsRead),
        deliveredAt: m.deliveredAt || m.DeliveredAt || null,
        isTemp: false
      };
    });

    this.messagesMap.update(map => ({
      ...map,
      [targetId]: formatted
    }));
    this.queueScrollToLatest();
  }

  private ensureWelcomeMessage(targetId: string): void {
    if (this.messagesMap()[targetId]?.length) return;
    const shop = this.shops().find(s => s.id === targetId || s.conversationId === targetId);
    const myName = this.isPartner() ? 'Partner Support' : 'Management';
    const welcomeMsg = this.isPartner()
      ? `Hello ${shop?.name || 'Merchant'}! This is your direct partner support channel.`
      : `Hello ${shop?.name || 'Merchant'}! This is your direct support channel with Management.`;
    this.messagesMap.update(map => {
      if (map[targetId]?.length) return map;
      return {
        ...map,
        [targetId]: [{
          id: `init-${targetId}`,
          sender: 'admin',
          senderName: myName,
          message: welcomeMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]
      };
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      this.toast.show('Max file size is 10 MB', 'error');
      return;
    }

    this.uploadingFile.set(true);
    this.chatService.uploadAttachment(file).subscribe({
      next: (res) => {
        this.uploadingFile.set(false);
        this.pendingAttachment.set({
          url: res.url,
          fileName: res.fileName,
          contentType: res.contentType,
          sizeBytes: res.sizeBytes
        });
      },
      error: (err) => {
        this.uploadingFile.set(false);
        this.toast.show(err?.error?.error || 'File upload failed', 'error');
      }
    });
  }

  clearPendingAttachment(): void {
    this.pendingAttachment.set(null);
  }

  getReplyInfo(raw: string | null | undefined): ParsedReply | null {
    return parseMessageReply(raw).reply;
  }

  getCleanMessage(raw: string | null | undefined): string {
    return parseMessageReply(raw).cleanText;
  }

  startReply(msg: AdminToSellerMessage): void {
    if (msg.isDeletedForEveryone) return;
    const clean = this.getCleanMessage(msg.message);
    const sName = msg.senderName || (msg.sender === 'admin' ? (this.isPartner() ? 'Partner Support' : 'Management') : (this.selectedShop()?.name || 'Merchant'));
    this.replyingTo.set({
      id: msg.id,
      senderName: sName,
      text: clean || (msg.attachmentFileName ? `📎 ${msg.attachmentFileName}` : 'Message')
    });
    this.activeMenuMessageId.set(null);
    setTimeout(() => {
      const inp = document.getElementById('admin-chat-widget-input') as HTMLInputElement | null;
      if (inp) inp.focus();
    }, 50);
  }

  cancelReply(): void {
    this.replyingTo.set(null);
  }

  scrollToMessage(targetId: string): void {
    if (!targetId) return;
    const el = document.getElementById(`msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('reply-highlight');
      setTimeout(() => {
        el.classList.remove('reply-highlight');
      }, 1500);
    }
  }

  startEditMessage(msg: AdminToSellerMessage): void {
    if (msg.isDeletedForEveryone) return;
    this.editingMessage.set(msg);
    this.messageText.set(this.getCleanMessage(msg.message));
    this.cancelReply();
    this.activeMenuMessageId.set(null);
  }

  cancelEdit(): void {
    this.editingMessage.set(null);
    this.messageText.set('');
  }

  submitEditMessage(): void {
    const msg = this.editingMessage();
    const newContent = this.messageText().trim();
    const shop = this.selectedShop();
    if (!msg || !newContent || !msg.id || !shop) return;

    if (newContent === msg.message) {
      this.cancelEdit();
      return;
    }

    const threadId = shop.conversationId || shop.id;
    this.isSending.set(true);
    this.adminService.editChatMessage(msg.id, newContent).subscribe({
      next: () => {
        this.isSending.set(false);
        const now = new Date().toISOString();
        this.messagesMap.update(map => ({
          ...map,
          [threadId]: (map[threadId] || map[shop.id] || []).map(m =>
            m.id === msg.id ? { ...m, message: newContent, isEdited: true, editedAt: now } : m
          )
        }));
        this.cancelEdit();
      },
      error: (err) => {
        this.isSending.set(false);
        this.toast.show(err?.error?.error || 'Failed to edit message', 'error');
      }
    });
  }

  openDeleteModal(msg: AdminToSellerMessage): void {
    this.deleteModalMessage.set(msg);
    this.activeMenuMessageId.set(null);
  }

  closeDeleteModal(): void {
    this.deleteModalMessage.set(null);
  }

  confirmDelete(forEveryone: boolean): void {
    const msg = this.deleteModalMessage();
    const shop = this.selectedShop();
    if (!msg || !msg.id || !shop) return;

    const threadId = shop.conversationId || shop.id;
    this.adminService.deleteChatMessage(msg.id, forEveryone).subscribe({
      next: () => {
        if (forEveryone) {
          this.messagesMap.update(map => ({
            ...map,
            [threadId]: (map[threadId] || map[shop.id] || []).map(m =>
              m.id === msg.id
                ? { ...m, message: 'This message was deleted', isDeletedForEveryone: true, attachmentUrl: null, attachmentFileName: null }
                : m
            )
          }));
        } else {
          this.messagesMap.update(map => ({
            ...map,
            [threadId]: (map[threadId] || map[shop.id] || []).filter(m => m.id !== msg.id)
          }));
        }
        this.closeDeleteModal();
      },
      error: (err) => {
        this.toast.show(err?.error?.error || 'Failed to delete message', 'error');
      }
    });
  }

  toggleMessageMenu(msgId: string, event?: MouseEvent | Event): void {
    event?.stopPropagation();
    if (this.activeMenuMessageId() === msgId) {
      this.activeMenuMessageId.set(null);
      return;
    }

    if (event && (event as MouseEvent).currentTarget) {
      const btn = (event as MouseEvent).currentTarget as HTMLElement;
      const rect = btn.getBoundingClientRect();
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const isNearBottom = (rect.bottom - containerRect.top) > (containerRect.height * 0.58);
        this.menuOpenUpwards.set(isNearBottom);
      } else {
        const isNearBottom = rect.bottom > (window.innerHeight - 220);
        this.menuOpenUpwards.set(isNearBottom);
      }
    } else {
      this.menuOpenUpwards.set(false);
    }

    this.activeMenuMessageId.set(msgId);
  }

  startSelectionMode(initialMsgId?: string): void {
    this.isSelectionMode.set(true);
    this.activeMenuMessageId.set(null);
    if (initialMsgId) {
      this.selectedMessageIds.set([initialMsgId]);
    } else {
      this.selectedMessageIds.set([]);
    }
  }

  exitSelectionMode(): void {
    this.isSelectionMode.set(false);
    this.selectedMessageIds.set([]);
    this.batchDeleteModalOpen.set(false);
  }

  toggleSelectMessage(msgId: string): void {
    if (!this.isSelectionMode()) return;
    const current = this.selectedMessageIds();
    if (current.includes(msgId)) {
      const next = current.filter(id => id !== msgId);
      this.selectedMessageIds.set(next);
      if (next.length === 0) {
        this.exitSelectionMode();
      }
    } else {
      this.selectedMessageIds.set([...current, msgId]);
    }
  }

  isMessageSelected(msgId: string): boolean {
    return this.selectedMessageIds().includes(msgId);
  }

  openBatchDeleteModal(): void {
    if (this.selectedMessageIds().length === 0) return;
    this.batchDeleteModalOpen.set(true);
  }

  closeBatchDeleteModal(): void {
    this.batchDeleteModalOpen.set(false);
  }

  confirmBatchDelete(forEveryone: boolean): void {
    const ids = this.selectedMessageIds();
    const shop = this.selectedShop();
    if (!ids || ids.length === 0 || !shop) return;

    const threadId = shop.conversationId || shop.id;
    this.adminService.batchDeleteChatMessages(ids, forEveryone).subscribe({
      next: () => {
        const idSet = new Set(ids);
        if (forEveryone) {
          this.messagesMap.update(map => ({
            ...map,
            [threadId]: (map[threadId] || map[shop.id] || []).map(m =>
              idSet.has(m.id)
                ? { ...m, message: 'This message was deleted', isDeletedForEveryone: true, attachmentUrl: null, attachmentFileName: null }
                : m
            )
          }));
        } else {
          this.messagesMap.update(map => ({
            ...map,
            [threadId]: (map[threadId] || map[shop.id] || []).filter(m => !idSet.has(m.id))
          }));
        }
        this.exitSelectionMode();
      },
      error: (err) => {
        this.toast.show(err?.error?.error || 'Failed to delete selected messages', 'error');
        this.closeBatchDeleteModal();
      }
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeMenuMessageId.set(null);
  }

  sendMessage(): void {
    if (this.editingMessage()) {
      this.submitEditMessage();
      return;
    }

    const text = this.messageText().trim();
    const attachment = this.pendingAttachment();
    const shop = this.selectedShop();
    if ((!text && !attachment) || !shop || this.isSending()) return;

    const threadId = shop.conversationId || shop.id;
    const reply = this.replyingTo();
    const payloadText = reply ? buildReplyMessage(reply, text) : text;

    this.isSending.set(true);
    const tempId = `tmp-${Date.now()}`;
    const preview = payloadText || (attachment ? `📎 ${attachment.fileName}` : '');
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const myName = this.isPartner() ? 'Partner Support' : 'Management';

    this.messagesMap.update(map => ({
      ...map,
      [threadId]: [
        ...(map[threadId] || map[shop.id] || []),
        {
          id: tempId,
          sender: 'admin',
          senderName: myName,
          message: preview,
          timestamp: stamp,
          attachmentUrl: attachment?.url || null,
          attachmentFileName: attachment?.fileName || null,
          attachmentContentType: attachment?.contentType || null,
          isTemp: true,
          isDelivered: false,
          isRead: false
        }
      ]
    }));
    this.messageText.set('');
    this.pendingAttachment.set(null);
    this.cancelReply();
    this.queueScrollToLatest();

    this.shops.update(currentList => currentList.map(s => {
      if (s.id.toLowerCase() === shop.id.toLowerCase() || (s.conversationId && s.conversationId.toLowerCase() === threadId.toLowerCase())) {
        return {
          ...s,
          lastMessage: preview,
          lastMessageTime: new Date().toISOString()
        };
      }
      return s;
    }));

    this.adminService.sendChatMessage(threadId, payloadText, attachment ? {
      attachmentUrl: attachment.url,
      attachmentFileName: attachment.fileName,
      attachmentContentType: attachment.contentType,
      attachmentSizeBytes: attachment.sizeBytes
    } : null).subscribe({
      next: (res) => {
        this.isSending.set(false);
        const realId = res?.messageId ? String(res.messageId) : tempId;
        const isDelivered = !!(res?.isDelivered);
        const deliveredAt = res?.deliveredAt || null;
        this.messagesMap.update(map => {
          const list = (map[threadId] || []).filter(m =>
            m.id !== tempId && String(m.id).toLowerCase() !== realId.toLowerCase()
          );
          return {
            ...map,
            [threadId]: [
              ...list,
              {
                id: realId,
                sender: 'admin',
                senderName: myName,
                message: preview,
                timestamp: stamp,
                attachmentUrl: attachment?.url || null,
                attachmentFileName: attachment?.fileName || null,
                attachmentContentType: attachment?.contentType || null,
                isTemp: false,
                isDelivered: isDelivered,
                deliveredAt: deliveredAt,
                isRead: false
              }
            ]
          };
        });
      },
      error: (err) => {
        this.isSending.set(false);
        this.messagesMap.update(map => ({
          ...map,
          [threadId]: (map[threadId] || []).filter(m => m.id !== tempId)
        }));
        this.toast.show(err?.error?.error || 'Failed to send message.', 'error');
      }
    });
  }

  attachmentHref(url: string | null | undefined): string {
    if (!url) return '#';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    return this.adminService.formatImageUrl(url) || url;
  }

  isImageAttachment(msg: AdminToSellerMessage): boolean {
    const ct = (msg.attachmentContentType || '').toLowerCase();
    return ct.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(msg.attachmentFileName || '');
  }

  sendQuickAction(action: 'approve_gold' | 'approve_diamond' | 'request_payment' | 'bronze_info'): void {
    const shop = this.selectedShop();
    if (!shop) return;

    let text = '';
    switch (action) {
      case 'approve_gold':
        text = `Gold tier ($1000 / 1,000 products) for ${shop.name} — please share payment proof for activation.`;
        break;
      case 'approve_diamond':
        text = `Diamond tier ($2000 / 5,000 products) for ${shop.name} is under review. Please submit transaction ID.`;
        break;
      case 'request_payment':
        text = `Please upload your bank transfer / ACH / wire confirmation slip here.`;
        break;
      case 'bronze_info':
        text = `Bronze (Free) supports up to 200 catalog products. Upgrade anytime to expand inventory.`;
        break;
    }

    this.messageText.set(text);
    this.sendMessage();
  }

  statusLabel(shop: AdminChatShop): string {
    const s = String(shop.merchantStatus || '').toLowerCase();
    if (s === 'approved') return 'Verified';
    if (s === 'rejected') return 'Rejected';
    return 'Pending';
  }

  statusClass(shop: AdminChatShop): string {
    const s = String(shop.merchantStatus || '').toLowerCase();
    if (s === 'approved') return 'bg-emerald-100 text-emerald-800';
    if (s === 'rejected') return 'bg-rose-100 text-rose-800';
    return 'bg-amber-100 text-amber-800';
  }

  private normalizeStatus(status: any): string {
    const s = String(status ?? '').toLowerCase();
    if (s === '1' || s === 'pending') return 'Pending';
    if (s === '2' || s === 'approved') return 'Approved';
    if (s === '3' || s === 'rejected') return 'Rejected';
    if (s === 'approved' || s === 'pending' || s === 'rejected') {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    return status || 'Pending';
  }

  private isMyMessage(m: any): boolean {
    const myAccId = this.authStore.currentAccount()?.accountId?.toLowerCase();
    const msgSenderAccId = String(
      m?.senderAccountId || m?.SenderAccountId || m?.senderId || m?.SenderId || ''
    ).toLowerCase();

    if (myAccId && msgSenderAccId) {
      return myAccId === msgSenderAccId;
    }

    const roleLower = String(m?.senderRole || m?.SenderRole || '').toLowerCase();
    if (this.isPartner()) {
      return roleLower.includes('partner') || roleLower === '4';
    }
    return roleLower.includes('superadmin') || roleLower.includes('admin') || roleLower === '3';
  }

  private getSenderDisplayName(m: any, isMe: boolean, fallbackName?: string): string {
    if (isMe) {
      return this.isPartner() ? 'Partner Support' : 'Management';
    }

    const activeShop = this.selectedShop();
    const activeName = fallbackName || activeShop?.name || '';
    const roleLower = String(m?.senderRole || m?.SenderRole || '').toLowerCase();

    if (this.isPartner()) {
      if (this.directoryTab() === 'partner-service' || roleLower.includes('superadmin') || roleLower.includes('admin') || roleLower === '3') {
        return 'Partner Service';
      }
      return activeName || 'Merchant';
    }

    // SuperAdmin perspective
    if (this.directoryTab() === 'partners' || roleLower.includes('partner') || roleLower === '4') {
      return activeName || 'Partner';
    }
    if (this.directoryTab() === 'customers' || roleLower.includes('user') || roleLower.includes('customer') || roleLower === '1') {
      return activeName || 'Customer';
    }
    return activeName || 'Merchant';
  }

  private queueScrollToLatest(): void {
    this.shouldScrollToBottom = true;
    this.scrollToBottom();
    setTimeout(() => this.scrollToBottom(), 0);
    setTimeout(() => this.scrollToBottom(), 50);
    setTimeout(() => this.scrollToBottom(), 150);
    setTimeout(() => {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }, 350);
  }

  formatImageUrl(url?: string | null): string {
    return this.adminService.formatImageUrl(url);
  }

  onImgError(event: Event, name?: string): void {
    const img = event.target as HTMLImageElement;
    img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Shop')}&background=EA580C&color=fff&bold=true`;
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    } catch { /* ignore */ }
  }
}
