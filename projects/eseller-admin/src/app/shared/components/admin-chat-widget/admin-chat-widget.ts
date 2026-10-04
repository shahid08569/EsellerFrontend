import { Component, OnInit, OnDestroy, inject, signal, computed, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthStore, ToastService, SignalRService, ChatService } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';

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
}

@Component({
  selector: 'app-admin-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-chat-widget.html',
  styleUrls: ['./admin-chat-widget.css']
})
export class AdminChatWidget implements OnInit, OnDestroy, AfterViewChecked {
  private readonly adminService = inject(AdminService);
  readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);
  private readonly signalR = inject(SignalRService);
  private readonly chatService = inject(ChatService);

  @ViewChild('messagesContainer') private messagesContainer?: ElementRef;

  readonly isOpen = signal<boolean>(false);
  readonly unreadCount = signal<number>(0);
  readonly messageText = signal<string>('');
  readonly isSending = signal<boolean>(false);

  readonly shops = signal<AdminChatShop[]>([]);
  readonly selectedShop = signal<AdminChatShop | null>(null);
  readonly sellerSearchTerm = signal<string>('');
  readonly currentView = signal<'directory' | 'chat'>('directory');
  readonly messagesMap = signal<Record<string, AdminToSellerMessage[]>>({});
  readonly isLoadingShops = signal<boolean>(false);

  readonly filteredShops = computed(() => {
    const list = this.shops();
    const term = this.sellerSearchTerm().trim().toLowerCase();
    if (!term) return list;
    return list.filter(s =>
      s.name.toLowerCase().includes(term) ||
      (s.city && s.city.toLowerCase().includes(term))
    );
  });

  private shouldScrollToBottom = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private joinedRoomId: string | null = null;
  private unsubscribeSignalR?: () => void;

  ngOnInit(): void {
    this.loadShops();
    this.refreshUnreadBadge();

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

        // Drop temp optimistic seller echoes if any
        this.messagesMap.update(map => {
          const list = (map[shopId] || []).filter(m =>
            !(m.sender === 'seller' && m.message === incoming.message && String(m.id).startsWith('tmp-'))
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
                })
              }
            ]
          };
        });

        if (!this.isOpen() || this.selectedShop()?.id?.toLowerCase() !== shopId.toLowerCase()) {
          this.unreadCount.update(c => c + 1);
          this.toast.show(`New chat from ${shopName}`, 'info');
        }
        this.shouldScrollToBottom = true;
      });
    }).catch(() => {});

    this.pollTimer = setInterval(() => {
      this.refreshUnreadBadge();
      if (this.isOpen() && this.selectedShop()) {
        this.fetchLiveMessages(this.selectedShop()!.id);
      }
    }, 8000);
  }

  private refreshUnreadBadge(): void {
    this.chatService.getUnreadCount().subscribe({
      next: (res) => {
        const n = Number(res?.unreadCount || 0);
        if (!this.isOpen() && n > this.unreadCount()) {
          this.unreadCount.set(n);
        } else if (!this.isOpen()) {
          this.unreadCount.set(n);
        }
      },
      error: () => {}
    });
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
    this.chatService.markConversationAsRead(shop.id).subscribe({
      next: () => this.refreshUnreadBadge(),
      error: () => {}
    });
    this.fetchLiveMessages(shop.id);
    this.shouldScrollToBottom = true;
  }

  backToDirectory(): void {
    this.currentView.set('directory');
  }

  toggleChat(): void {
    const nextState = !this.isOpen();
    this.isOpen.set(nextState);
    if (nextState) {
      this.unreadCount.set(0);
      this.shouldScrollToBottom = true;
      if (!this.shops().length) this.loadShops();
    }
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
            })
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

  sendMessage(): void {
    const text = this.messageText().trim();
    const shop = this.selectedShop();
    if (!text || !shop || this.isSending()) return;

    this.isSending.set(true);
    const tempId = `tmp-${Date.now()}`;

    this.messagesMap.update(map => ({
      ...map,
      [shop.id]: [
        ...(map[shop.id] || []),
        {
          id: tempId,
          sender: 'admin',
          senderName: 'Super Admin',
          message: text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    }));
    this.messageText.set('');
    this.shouldScrollToBottom = true;

    this.adminService.sendChatMessage(shop.id, text).subscribe({
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
                message: text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
        text = `Please upload your bank transfer / EasyPaisa / JazzCash confirmation slip here.`;
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
