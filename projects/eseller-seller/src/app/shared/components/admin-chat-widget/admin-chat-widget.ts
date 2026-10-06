import { Component, OnInit, OnDestroy, inject, signal, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthStore, ToastService, SignalRService, ChatService, SignalRIncomingMessage } from 'eseller-shared';
import { SellerService, ShopDto } from '../../../core/services/seller.service';

export interface AdminChatMessage {
  id: string;
  sender: 'admin' | 'seller';
  senderName: string;
  message: string;
  timestamp: string;
  isQuickAction?: boolean;
  attachmentUrl?: string | null;
  attachmentFileName?: string | null;
  attachmentContentType?: string | null;
}

interface PendingAttachment {
  url: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

@Component({
  selector: 'app-admin-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-chat-widget.html',
  styleUrls: ['./admin-chat-widget.css']
})
export class AdminChatWidget implements OnInit, OnDestroy, AfterViewChecked {
  private readonly sellerSvc = inject(SellerService);
  readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);
  private readonly signalR = inject(SignalRService);
  private readonly chatService = inject(ChatService);

  @ViewChild('messagesContainer') private messagesContainer?: ElementRef;

  readonly isOpen = signal<boolean>(false);
  readonly unreadCount = signal<number>(0);
  readonly isTyping = signal<boolean>(false);
  readonly shop = signal<ShopDto | null>(null);
  readonly messageText = signal<string>('');
  readonly isSending = signal<boolean>(false);
  readonly uploadingFile = signal<boolean>(false);
  readonly pendingAttachment = signal<PendingAttachment | null>(null);
  readonly messages = signal<AdminChatMessage[]>([]);
  readonly isLoading = signal<boolean>(false);

  private shouldScrollToBottom = false;
  private joinedRoomId: string | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeSignalR?: () => void;

  ngOnInit(): void {
    this.refreshUnreadBadge();

    this.sellerSvc.getMyShop().subscribe({
      next: (shop) => {
        this.shop.set(shop);
        if (shop?.id) {
          this.joinAndLoad(shop.id);
        }
      },
      error: () => {}
    });

    this.signalR.startChatConnection().then(() => {
      const shopId = this.shop()?.id;
      if (shopId) {
        this.signalR.joinOrderRoom(shopId).catch(() => {});
        this.joinedRoomId = shopId;
      }

      this.unsubscribeSignalR = this.signalR.onReceiveMessage((incoming: SignalRIncomingMessage) => {
        const roomId = this.shop()?.id;
        if (!roomId || incoming.orderRequestId?.toLowerCase() !== roomId.toLowerCase()) {
          return;
        }

        const role = String(incoming.senderRole || '');
        if (this.isShopkeeperRole(role)) {
          return;
        }

        const exists = this.messages().some(m =>
          m.id && incoming.messageId && m.id.toLowerCase() === String(incoming.messageId).toLowerCase()
        );
        if (exists) return;

        this.messages.update(list => {
          const cleaned = list.filter(m =>
            !(m.sender === 'admin' && String(m.id).startsWith('tmp-')
              && (m.message === incoming.message
                || (!!incoming.attachmentUrl && m.attachmentUrl === incoming.attachmentUrl)))
          );
          return [
            ...cleaned,
            {
              id: incoming.messageId || `m-${Date.now()}`,
              sender: 'admin' as const,
              senderName: 'Super Admin',
              message: incoming.message,
              timestamp: new Date(incoming.sentAt || Date.now()).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              }),
              attachmentUrl: incoming.attachmentUrl || null,
              attachmentFileName: incoming.attachmentFileName || null,
              attachmentContentType: incoming.attachmentContentType || null
            }
          ];
        });

        if (this.isOpen()) {
          this.chatService.markConversationAsRead(roomId).subscribe({
            next: () => this.refreshUnreadBadge(),
            error: () => {}
          });
        } else {
          this.unreadCount.update(c => c + 1);
          this.toast.show('New message from Super Admin', 'info');
        }
        this.shouldScrollToBottom = true;
      });
    }).catch(() => {});

    this.pollTimer = setInterval(() => {
      this.refreshUnreadBadge();
      if (this.isOpen() && this.shop()?.id) {
        this.fetchMessages(this.shop()!.id);
      }
    }, 8000);
  }

  private refreshUnreadBadge(): void {
    this.chatService.getUnreadCount().subscribe({
      next: (res) => {
        if (!this.isOpen()) {
          this.unreadCount.set(Number(res?.unreadCount || 0));
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

  toggleChat(): void {
    const nextState = !this.isOpen();
    this.isOpen.set(nextState);
    if (nextState) {
      this.unreadCount.set(0);
      const shopId = this.shop()?.id;
      if (shopId) {
        this.joinAndLoad(shopId);
      }
      this.shouldScrollToBottom = true;
    }
  }

  closeChat(): void {
    this.isOpen.set(false);
  }

  sendQuickAction(actionType: 'gold' | 'diamond' | 'payment' | 'limit'): void {
    let msg = '';
    if (actionType === 'gold') {
      msg = 'Hello Admin, I would like to request an upgrade to Gold ($1000 / 1,000 product limit) for my store. Please provide payment verification details.';
    } else if (actionType === 'diamond') {
      msg = 'Hello Admin, I would like to request an upgrade to Diamond ($2000 / 5,000 product limit) for my store.';
    } else if (actionType === 'payment') {
      msg = 'I have submitted payment for my Tier Upgrade via Bank Transfer / Raast. Please reply with the payment details you need, and I will share my real transfer reference for verification.';
    } else if (actionType === 'limit') {
      msg = 'My store is reaching the 200 product limit on the Bronze plan. I would like to expand my catalog capacity.';
    }

    this.sendMessageDirect(msg);
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
    if ((!text && !attachment) || this.isSending()) return;
    this.sendMessageDirect(text, attachment);
    this.messageText.set('');
    this.pendingAttachment.set(null);
  }

  private joinAndLoad(shopId: string): void {
    this.chatService.markConversationAsRead(shopId).subscribe({
      next: () => this.refreshUnreadBadge(),
      error: () => {}
    });
    this.signalR.joinOrderRoom(shopId).then(() => {
      this.joinedRoomId = shopId;
    }).catch(() => {});
    this.fetchMessages(shopId);
  }

  private fetchMessages(shopId: string): void {
    this.isLoading.set(true);
    this.sellerSvc.getOrderMessages(shopId, 1, 50).subscribe({
      next: (res: any) => {
        this.isLoading.set(false);
        const list: any[] = Array.isArray(res) ? res : (res?.items ?? []);
        if (!list.length) {
          if (this.messages().length === 0) {
            this.messages.set([{
              id: 'm-welcome',
              sender: 'admin',
              senderName: 'System',
              message: 'Support chat is ready. Send a message to Super Admin about verification, tier upgrades, or store questions.',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isQuickAction: true
            }]);
          }
          return;
        }

        const formatted: AdminChatMessage[] = list.map((m: any) => {
          const role = String(m.senderRole || '');
          const isSeller = this.isShopkeeperRole(role);
          return {
            id: m.id || `msg-${Math.random()}`,
            sender: isSeller ? 'seller' : 'admin',
            senderName: isSeller
              ? (this.shop()?.name || 'Merchant')
              : 'Super Admin',
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

        this.messages.set(formatted);
        this.shouldScrollToBottom = true;
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  private sendMessageDirect(text: string, attachment?: PendingAttachment | null): void {
    const shopId = this.shop()?.id;
    if (!shopId) {
      this.toast.show('Shop profile not loaded yet. Please try again.', 'error');
      return;
    }

    const myName = this.shop()?.name || this.authStore.currentAccount()?.username || 'Merchant';
    const tempId = `tmp-${Date.now()}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const preview = text || (attachment ? `📎 ${attachment.fileName}` : '');

    this.messages.update(list => [
      ...list,
      {
        id: tempId,
        sender: 'seller',
        senderName: myName,
        message: preview,
        timestamp: nowTime,
        attachmentUrl: attachment?.url || null,
        attachmentFileName: attachment?.fileName || null,
        attachmentContentType: attachment?.contentType || null
      }
    ]);
    this.shouldScrollToBottom = true;
    this.isSending.set(true);

    this.chatService.sendMessage(shopId, text, attachment ? {
      attachmentUrl: attachment.url,
      attachmentFileName: attachment.fileName,
      attachmentContentType: attachment.contentType,
      attachmentSizeBytes: attachment.sizeBytes
    } : null).subscribe({
      next: (res) => {
        this.isSending.set(false);
        const realId = res?.messageId ? String(res.messageId) : tempId;
        this.messages.update(list => {
          const without = list.filter(m =>
            m.id !== tempId && String(m.id).toLowerCase() !== realId.toLowerCase()
          );
          return [
            ...without,
            {
              id: realId,
              sender: 'seller',
              senderName: myName,
              message: preview,
              timestamp: nowTime,
              attachmentUrl: attachment?.url || null,
              attachmentFileName: attachment?.fileName || null,
              attachmentContentType: attachment?.contentType || null
            }
          ];
        });
      },
      error: (err) => {
        this.isSending.set(false);
        this.messages.update(list => list.filter(m => m.id !== tempId));
        this.toast.show(err?.error?.error || 'Failed to send message to Super Admin.', 'error');
      }
    });
  }

  attachmentHref(url: string | null | undefined): string {
    if (!url) return '#';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    const api = String((window as any).__ESELLER_API_URL__ || '').replace(/\/api\/v1\/?$/i, '').replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return api ? `${api}${path}` : path;
  }

  isImageAttachment(msg: AdminChatMessage): boolean {
    const ct = (msg.attachmentContentType || '').toLowerCase();
    return ct.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(msg.attachmentFileName || '');
  }

  private isShopkeeperRole(role: string): boolean {
    const r = role.toLowerCase();
    return r.includes('shopkeeper') || r.includes('seller') || r === '2';
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch {}
  }
}
