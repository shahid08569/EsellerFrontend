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
  isRead?: boolean;
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

const WIDGET_SUPPORT_ROOM_KEY = 'eseller_seller_support_room';

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

  private supportRoomId: string | null = null;
  private shouldScrollToBottom = false;
  private joinedRoomId: string | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeSignalR?: () => void;
  private unsubscribeMessageRead?: () => void;
  private realtimeHooksAttached = false;

  tickState(msg: AdminChatMessage): 'pending' | 'sent' | 'read' {
    if (msg.sender !== 'seller') return 'sent';
    const id = String(msg.id || '');
    if (!id || id.startsWith('tmp-')) return 'pending';
    return msg.isRead ? 'read' : 'sent';
  }

  ngOnInit(): void {
    this.refreshUnreadBadge();

    this.sellerSvc.getMyShop().subscribe({
      next: (shop) => this.shop.set(shop),
      error: () => {}
    });

    this.attachRealtimeHooks();

    this.chatService.getShopSupportSession().subscribe({
      next: (session) => {
        const roomId = session.orderRequestId || session.conversationId;
        if (!roomId) return;
        this.supportRoomId = roomId;
        this.persistRoomId(roomId);
        this.signalR.joinOrderRoom(roomId).catch(() => {});
        this.joinedRoomId = roomId;
        if (this.isOpen()) {
          this.joinAndLoad(roomId);
        }
      },
      error: () => {
        this.toast.show('Could not connect to Support Team chat.', 'error');
      }
    });

    this.pollTimer = setInterval(() => {
      this.refreshUnreadBadge();
      if (this.isOpen() && this.supportRoomId) {
        this.fetchMessages(this.supportRoomId, false);
      }
    }, 8000);
  }

  private persistRoomId(roomId: string): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(WIDGET_SUPPORT_ROOM_KEY, roomId);
      } catch { /* ignore */ }
    }
  }

  private attachRealtimeHooks(): void {
    if (this.realtimeHooksAttached) return;
    this.realtimeHooksAttached = true;

    this.signalR.startChatConnection().then(() => {
      this.unsubscribeSignalR = this.signalR.onReceiveMessage((incoming: SignalRIncomingMessage) => {
        const roomId = this.supportRoomId;
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
              senderName: 'Support Team',
              message: incoming.message,
              timestamp: new Date(incoming.sentAt || Date.now()).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              }),
              isRead: true,
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
          this.toast.show('New message from Support Team', 'info');
        }
        this.queueScrollToLatest();
      });

      this.unsubscribeMessageRead = this.signalR.onMessageRead((messageId) => {
        const id = messageId.toLowerCase();
        this.messages.update(list =>
          list.map(m =>
            m.sender === 'seller' && m.id && m.id.toLowerCase() === id ? { ...m, isRead: true } : m
          )
        );
      });
    }).catch(() => {});
  }

  private ensureSupportRoom(onReady: (roomId: string) => void): void {
    if (this.supportRoomId) {
      onReady(this.supportRoomId);
      return;
    }
    this.chatService.getShopSupportSession().subscribe({
      next: (session) => {
        const id = session.orderRequestId || session.conversationId;
        if (!id) return;
        this.supportRoomId = id;
        this.persistRoomId(id);
        this.signalR.joinOrderRoom(id).catch(() => {});
        this.joinedRoomId = id;
        onReady(id);
      },
      error: () => this.toast.show('Could not open support chat.', 'error')
    });
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

  toggleChat(): void {
    const nextState = !this.isOpen();
    this.isOpen.set(nextState);
    if (nextState) {
      this.unreadCount.set(0);
      this.ensureSupportRoom((roomId) => this.joinAndLoad(roomId));
      this.queueScrollToLatest();
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
      msg = 'I have submitted payment for my Tier Upgrade via Bank Transfer / ACH or Wire. Please reply with the payment details you need, and I will share my real transfer reference for verification.';
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

  private joinAndLoad(roomId: string): void {
    this.chatService.markConversationAsRead(roomId).subscribe({
      next: () => this.refreshUnreadBadge(),
      error: () => {}
    });
    this.signalR.joinOrderRoom(roomId).then(() => {
      this.joinedRoomId = roomId;
    }).catch(() => {});
    this.fetchMessages(roomId, true);
  }

  private fetchMessages(roomId: string, showLoading: boolean): void {
    if (showLoading) this.isLoading.set(true);
    this.chatService.getMessages(roomId, 1, 100).subscribe({
      next: (page) => {
        this.isLoading.set(false);
        const list: any[] = page?.items ?? [];
        const formatted: AdminChatMessage[] = list.map((m: any) => {
          const role = String(m.senderRole || '');
          const isSeller = this.isShopkeeperRole(role);
          return {
            id: m.id || `msg-${Math.random()}`,
            sender: isSeller ? 'seller' : 'admin',
            senderName: isSeller
              ? (this.shop()?.name || 'Merchant')
              : 'Support Team',
            message: m.message || m.content || '',
            timestamp: new Date(m.sentAt || m.createdAt || Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            }),
            isRead: !!m.isRead,
            attachmentUrl: m.attachmentUrl || null,
            attachmentFileName: m.attachmentFileName || null,
            attachmentContentType: m.attachmentContentType || null
          };
        });

        this.messages.set(formatted);
        this.queueScrollToLatest();
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  private sendMessageDirect(text: string, attachment?: PendingAttachment | null): void {
    const roomId = this.supportRoomId;
    if (!roomId) {
      this.toast.show('Support chat is still loading. Please try again.', 'error');
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
        isRead: false,
        attachmentUrl: attachment?.url || null,
        attachmentFileName: attachment?.fileName || null,
        attachmentContentType: attachment?.contentType || null
      }
    ]);
    this.queueScrollToLatest();
    this.isSending.set(true);

    this.chatService.sendMessage(roomId, text, attachment ? {
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
              isRead: false,
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
        this.toast.show(err?.error?.error || 'Failed to send message to Support Team.', 'error');
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

  /** WhatsApp-style: pin to latest messages when chat opens / messages load. */
  private queueScrollToLatest(): void {
    this.shouldScrollToBottom = true;
    this.scrollToBottom();
    // Keep forcing for a short window until layout settles
    setTimeout(() => this.scrollToBottom(), 0);
    setTimeout(() => this.scrollToBottom(), 50);
    setTimeout(() => this.scrollToBottom(), 150);
    setTimeout(() => {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }, 350);
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
