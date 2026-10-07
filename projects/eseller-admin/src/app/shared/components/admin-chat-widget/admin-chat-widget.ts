import { Component, OnInit, OnDestroy, inject, signal, computed, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthStore, ToastService, SignalRService, ChatService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminChatUnreadService } from '../../../core/services/admin-chat-unread.service';

export interface AdminChatShop {
  id: string;
  name: string;
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

  @ViewChild('messagesContainer') private messagesContainer?: ElementRef;

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
  readonly messagesMap = signal<Record<string, AdminToSellerMessage[]>>({});
  readonly isLoadingShops = signal<boolean>(false);

  readonly filteredShops = computed(() => {
    const list = this.shops();
    const term = this.sellerSearchTerm().trim().toLowerCase();
    let filtered = list;
    if (term) {
      filtered = list.filter(s =>
        s.name.toLowerCase().includes(term) ||
        (s.city && s.city.toLowerCase().includes(term))
      );
    }
    // Unread merchants first (WhatsApp-style)
    return [...filtered].sort((a, b) => {
      const au = this.chatUnread.unreadFor(a.id) > 0 ? 1 : 0;
      const bu = this.chatUnread.unreadFor(b.id) > 0 ? 1 : 0;
      if (au !== bu) return bu - au;
      return a.name.localeCompare(b.name);
    });
  });

  private shouldScrollToBottom = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private joinedRoomId: string | null = null;
  private unsubscribeSignalR?: () => void;

  ngOnInit(): void {
    this.chatUnread.start();
    this.loadShops();

    this.signalR.startChatConnection().then(() => {
      this.unsubscribeSignalR = this.signalR.onReceiveMessage((incoming) => {
        if (!this.isShopkeeperRole(String(incoming.senderRole || ''))
          && !this.isCustomerRole(String(incoming.senderRole || ''))) {
          return;
        }

        const shopId = incoming.orderRequestId;
        if (!shopId) return;

        const exists = (this.messagesMap()[shopId] || []).some(
          m => m.id && incoming.messageId && m.id.toLowerCase() === String(incoming.messageId).toLowerCase()
        );
        if (exists) return;

        const shopName = this.shops().find(s => s.id?.toLowerCase() === shopId.toLowerCase())?.name || 'Merchant';

        this.messagesMap.update(map => {
          const list = (map[shopId] || []).filter(m =>
            !(m.sender === 'seller' && String(m.id).startsWith('tmp-')
              && (m.message === incoming.message
                || (!!incoming.attachmentUrl && m.attachmentUrl === incoming.attachmentUrl)))
          );
          return {
            ...map,
            [shopId]: [
              ...list,
              {
                id: incoming.messageId || `m-${Date.now()}`,
                sender: 'seller' as const,
                senderName: (incoming as any).senderName || shopName,
                message: incoming.message,
                timestamp: new Date(incoming.sentAt || Date.now()).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                attachmentUrl: incoming.attachmentUrl || null,
                attachmentFileName: incoming.attachmentFileName || null,
                attachmentContentType: incoming.attachmentContentType || null
              }
            ]
          };
        });

        const isActiveOpen =
          this.isOpen()
          && this.currentView() === 'chat'
          && this.selectedShop()?.id?.toLowerCase() === shopId.toLowerCase();

        if (isActiveOpen) {
          // Already viewing — clear unread immediately
          this.chatUnread.markConversationRead(shopId);
        } else {
          this.chatUnread.bump(shopId, 1);
          this.toast.show(`New chat from ${shopName}`, 'info');
        }
        this.shouldScrollToBottom = true;
      });
    }).catch(() => {});

    this.pollTimer = setInterval(() => {
      this.chatUnread.refresh();
      if (this.isOpen() && this.selectedShop() && this.currentView() === 'chat') {
        this.fetchLiveMessages(this.selectedShop()!.id);
      }
    }, 8000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.unsubscribeSignalR?.();
    if (this.joinedRoomId) {
      this.signalR.leaveOrderRoom(this.joinedRoomId).catch(() => {});
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
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
            city: k.city,
            country: k.country,
            phone: k.phone,
            totalProducts: k.totalProducts || 0,
            merchantStatus: this.normalizeStatus(k.status),
            tierLabel: (k as any).badgeText || (k as any).tierName || 'Bronze (Free)'
          }));

        this.shops.set(mapped);
        this.isLoadingShops.set(false);

        this.adminService.getShops(1, 100).subscribe({
          next: (res) => {
            const items = res?.items || [];
            const existing = new Set(this.shops().map(s => s.id));
            const merged = [...this.shops()];
            for (const shop of items) {
              if (!existing.has(shop.id)) {
                merged.push({
                  id: shop.id,
                  name: shop.name,
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
          },
          error: () => {}
        });
      },
      error: () => {
        this.adminService.getShops(1, 100).subscribe({
          next: (res) => {
            this.shops.set((res?.items || []).map(shop => ({
              id: shop.id,
              name: shop.name,
              city: shop.city ?? undefined,
              country: shop.country ?? undefined,
              phone: shop.phone ?? undefined,
              totalProducts: shop.totalProducts || 0,
              merchantStatus: 'Approved',
              tierLabel: 'Bronze (Free)'
            })));
            this.isLoadingShops.set(false);
          },
          error: () => this.isLoadingShops.set(false)
        });
      }
    });
  }

  selectShop(shop: AdminChatShop): void {
    if (this.joinedRoomId && this.joinedRoomId !== shop.id) {
      this.signalR.leaveOrderRoom(this.joinedRoomId).catch(() => {});
    }

    this.selectedShop.set(shop);
    this.currentView.set('chat');
    this.signalR.joinOrderRoom(shop.id).then(() => {
      this.joinedRoomId = shop.id;
    }).catch(() => {});
    this.chatUnread.markConversationRead(shop.id);
    this.fetchLiveMessages(shop.id);
    this.shouldScrollToBottom = true;
  }

  backToDirectory(): void {
    this.currentView.set('directory');
    this.chatUnread.refresh();
  }

  toggleChat(): void {
    const nextState = !this.isOpen();
    this.isOpen.set(nextState);
    if (nextState) {
      // Do NOT zero the badge on open — only clear when a thread is opened/read
      this.currentView.set('directory');
      this.shouldScrollToBottom = true;
      this.chatUnread.refresh();
      if (!this.shops().length) this.loadShops();
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
    return this.messagesMap()[shop.id] || [];
  }

  fetchLiveMessages(shopId: string): void {
    this.adminService.getOrderMessages(shopId, 1, 50).subscribe({
      next: (msgs: any[]) => {
        if (!msgs || !msgs.length) {
          if (!(this.messagesMap()[shopId]?.length)) {
            const shop = this.shops().find(s => s.id === shopId);
            this.messagesMap.update(map => ({
              ...map,
              [shopId]: [{
                id: `init-${shopId}`,
                sender: 'admin',
                senderName: 'Super Admin',
                message: `Hello ${shop?.name || 'Merchant'}! This is your direct support channel with Super Admin.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }]
            }));
          }
          return;
        }

        const formatted: AdminToSellerMessage[] = msgs.map((m: any) => {
          const role = String(m.senderRole || '');
          const isAdmin = this.isAdminRole(role);
          return {
            id: m.id || `msg-${Math.random()}`,
            sender: isAdmin ? 'admin' : 'seller',
            senderName: isAdmin ? 'Super Admin' : (this.selectedShop()?.name || 'Merchant'),
            message: m.message || m.content || '',
            timestamp: new Date(m.sentAt || m.createdAt || Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            }),
            attachmentUrl: m.attachmentUrl || null,
            attachmentFileName: m.attachmentFileName || null,
            attachmentContentType: m.attachmentContentType || null
          };
        });

        this.messagesMap.update(map => ({
          ...map,
          [shopId]: formatted
        }));
        this.shouldScrollToBottom = true;
      },
      error: () => {}
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

  sendMessage(): void {
    const text = this.messageText().trim();
    const attachment = this.pendingAttachment();
    const shop = this.selectedShop();
    if ((!text && !attachment) || !shop || this.isSending()) return;

    this.isSending.set(true);
    const tempId = `tmp-${Date.now()}`;
    const preview = text || (attachment ? `📎 ${attachment.fileName}` : '');
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    this.messagesMap.update(map => ({
      ...map,
      [shop.id]: [
        ...(map[shop.id] || []),
        {
          id: tempId,
          sender: 'admin',
          senderName: 'Super Admin',
          message: preview,
          timestamp: stamp,
          attachmentUrl: attachment?.url || null,
          attachmentFileName: attachment?.fileName || null,
          attachmentContentType: attachment?.contentType || null
        }
      ]
    }));
    this.messageText.set('');
    this.pendingAttachment.set(null);
    this.shouldScrollToBottom = true;

    this.adminService.sendChatMessage(shop.id, text, attachment ? {
      attachmentUrl: attachment.url,
      attachmentFileName: attachment.fileName,
      attachmentContentType: attachment.contentType,
      attachmentSizeBytes: attachment.sizeBytes
    } : null).subscribe({
      next: (res) => {
        this.isSending.set(false);
        const realId = res?.messageId ? String(res.messageId) : tempId;
        this.messagesMap.update(map => {
          const list = (map[shop.id] || []).filter(m =>
            m.id !== tempId && String(m.id).toLowerCase() !== realId.toLowerCase()
          );
          return {
            ...map,
            [shop.id]: [
              ...list,
              {
                id: realId,
                sender: 'admin',
                senderName: 'Super Admin',
                message: preview,
                timestamp: stamp,
                attachmentUrl: attachment?.url || null,
                attachmentFileName: attachment?.fileName || null,
                attachmentContentType: attachment?.contentType || null
              }
            ]
          };
        });
      },
      error: (err) => {
        this.isSending.set(false);
        this.messagesMap.update(map => ({
          ...map,
          [shop.id]: (map[shop.id] || []).filter(m => m.id !== tempId)
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

  private isAdminRole(role: string): boolean {
    const r = role.toLowerCase();
    // RoleType: SuperAdmin=3, Partner=4
    return r.includes('superadmin') || r.includes('partner') || r === '3' || r === '4';
  }

  private isShopkeeperRole(role: string): boolean {
    const r = role.toLowerCase();
    // RoleType: Shopkeeper=2
    return r.includes('shopkeeper') || r.includes('seller') || r === '2';
  }

  private isCustomerRole(role: string): boolean {
    const r = role.toLowerCase();
    return r.includes('user') || r.includes('customer') || r === '1';
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch { /* ignore */ }
  }
}
