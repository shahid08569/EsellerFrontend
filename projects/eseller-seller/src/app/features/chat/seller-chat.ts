import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SellerService } from '../../core/services/seller.service';
import { SignalRService, AuthStore, ToastService, ChatService, SignalRIncomingMessage, ChatMessageDto, SkeletonLayout } from 'eseller-shared';

interface ChatMessage {
  id?: string;
  senderRole?: string;
  message: string;
  createdAt: string;
  isMe?: boolean;
  isRead?: boolean;
  attachmentUrl?: string | null;
  attachmentFileName?: string | null;
  attachmentContentType?: string | null;
}

interface ChatConversation {
  roomId: string;
  title: string;
  lastMessage?: string;
  lastMessageTime?: string;
}

interface PendingAttachment {
  url: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

const SELLER_SUPPORT_ROOM_KEY = 'eseller_seller_support_room';

@Component({
  selector: 'app-seller-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
  templateUrl: './seller-chat.html'
})
export class SellerChat implements OnInit, OnDestroy, AfterViewChecked {
  private readonly sellerSvc = inject(SellerService);
  private readonly chatService = inject(ChatService);
  private readonly signalR = inject(SignalRService);
  private readonly route = inject(ActivatedRoute);
  readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);

  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;
  private shouldScrollToBottom = false;
  private receiveMessageUnsubscribe: (() => void) | null = null;
  private messageReadUnsubscribe: (() => void) | null = null;

  readonly isLoading = signal<boolean>(true);
  readonly conversations = signal<ChatConversation[]>([]);
  readonly selectedRoomId = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly messageText = signal<string>('');
  readonly isSending = signal<boolean>(false);
  readonly uploadingFile = signal<boolean>(false);
  readonly pendingAttachment = signal<PendingAttachment | null>(null);
  readonly searchTerm = signal<string>('');

  readonly selectedConversation = computed(() => {
    const id = this.selectedRoomId();
    if (!id) return null;
    return this.conversations().find(c => c.roomId === id) || null;
  });

  readonly filteredConversations = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.conversations();
    if (!term) return list;
    return list.filter(c =>
      c.title.toLowerCase().includes(term) ||
      c.roomId.toLowerCase().includes(term) ||
      (c.lastMessage && c.lastMessage.toLowerCase().includes(term))
    );
  });

  ngOnInit(): void {
    const supportId =
      this.route.snapshot.queryParamMap.get('support') ||
      this.route.snapshot.queryParamMap.get('c');
    const productId = this.route.snapshot.queryParamMap.get('productId');
    if (supportId) {
      this.selectedRoomId.set(supportId);
    }
    this.loadConversations(productId);
    this.initSignalR();
  }

  ngOnDestroy(): void {
    const id = this.selectedRoomId();
    if (id) {
      this.signalR.leaveOrderRoom(id).catch(() => {});
    }
    this.receiveMessageUnsubscribe?.();
    this.messageReadUnsubscribe?.();
    this.receiveMessageUnsubscribe = null;
    this.messageReadUnsubscribe = null;
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
    }
  }

  /** WhatsApp-style: pending (no id) → single ✓ → double ✓ when read */
  tickState(msg: ChatMessage): 'pending' | 'sent' | 'read' {
    if (!msg.isMe) return 'sent';
    const id = String(msg.id || '');
    if (!id || id.startsWith('tmp-')) return 'pending';
    return msg.isRead ? 'read' : 'sent';
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

  private isMyRole(role: string | undefined): boolean {
    const roleLower = String(role || '').toLowerCase();
    return roleLower.includes('shopkeeper') || roleLower.includes('seller') || roleLower === '2';
  }

  private mapApiMessage(m: ChatMessageDto | any): ChatMessage {
    const role = m.senderRole ?? m.SenderRole;
    return {
      id: m.id,
      senderRole: role,
      message: m.message || m.content || m.Message || '',
      createdAt: m.sentAt || m.createdAt || new Date().toISOString(),
      isMe: this.isMyRole(String(role)) || role === 2,
      isRead: !!m.isRead,
      attachmentUrl: m.attachmentUrl || null,
      attachmentFileName: m.attachmentFileName || null,
      attachmentContentType: m.attachmentContentType || null
    };
  }

  private applyMessageRead(messageId: string, readAt: string): void {
    const id = messageId.toLowerCase();
    this.messages.update(list =>
      list.map(m =>
        m.id && m.id.toLowerCase() === id ? { ...m, isRead: true, createdAt: m.createdAt || readAt } : m
      )
    );
  }

  private persistRoomId(roomId: string): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(SELLER_SUPPORT_ROOM_KEY, roomId);
      } catch { /* ignore */ }
    }
  }

  private initSignalR(): void {
    this.signalR.startChatConnection().then(() => {
      this.receiveMessageUnsubscribe = this.signalR.onReceiveMessage((incoming: SignalRIncomingMessage) => {
        const roomId = this.selectedRoomId();
        if (!roomId || incoming.orderRequestId?.toLowerCase() !== roomId.toLowerCase()) {
          return;
        }

        const isMe = this.isMyRole(incoming.senderRole);
        const incomingId = String(incoming.messageId || '').toLowerCase();

        if (incomingId && this.messages().some(m => m.id && m.id.toLowerCase() === incomingId)) {
          return;
        }

        this.messages.update(list => {
          const withoutTemp = list.filter(m =>
            !(String(m.id || '').startsWith('tmp-') && m.isMe === isMe
              && (m.message === incoming.message
                || (!!incoming.attachmentUrl && m.attachmentUrl === incoming.attachmentUrl)))
          );
          return [
            ...withoutTemp,
            {
              id: incoming.messageId,
              senderRole: incoming.senderRole,
              message: incoming.message,
              createdAt: incoming.sentAt || new Date().toISOString(),
              isMe,
              isRead: false,
              attachmentUrl: incoming.attachmentUrl || null,
              attachmentFileName: incoming.attachmentFileName || null,
              attachmentContentType: incoming.attachmentContentType || null
            }
          ];
        });
        this.queueScrollToLatest();

        if (!isMe) {
          this.chatService.markConversationAsRead(roomId).subscribe({ error: () => {} });
        }

        this.updateConversationPreview(roomId, incoming.message, incoming.sentAt);
      });

      this.messageReadUnsubscribe = this.signalR.onMessageRead((messageId, readAt) => {
        this.applyMessageRead(messageId, readAt);
      });

      const roomId = this.selectedRoomId();
      if (roomId) {
        this.signalR.joinOrderRoom(roomId).catch(() => {});
      }
    }).catch(() => {});
  }

  loadConversations(productId?: string | null): void {
    this.isLoading.set(true);

    this.chatService.getShopSupportSession(productId).subscribe({
      next: (session) => {
        const roomId = session.orderRequestId || session.conversationId;
        if (!roomId) {
          this.isLoading.set(false);
          this.toast.show('Could not open customer support chat.', 'error');
          return;
        }

        this.persistRoomId(roomId);

        const supportConvo: ChatConversation = {
          roomId,
          title: 'Customer Support',
          lastMessage: 'Loading…',
          lastMessageTime: undefined
        };

        this.conversations.set([supportConvo]);
        this.isLoading.set(false);

        const preferred =
          this.selectedRoomId() ||
          (typeof window !== 'undefined' ? window.sessionStorage.getItem(SELLER_SUPPORT_ROOM_KEY) : null) ||
          roomId;
        this.selectConversation(preferred);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.show('Failed to open Customer Support chat', 'error');
      }
    });
  }

  private updateConversationPreview(roomId: string, preview: string, time?: string): void {
    this.conversations.update(list => list.map(c => {
      if (c.roomId === roomId) {
        return {
          ...c,
          lastMessage: preview,
          lastMessageTime: time || new Date().toISOString()
        };
      }
      return c;
    }));
  }

  selectConversation(roomId: string): void {
    const prev = this.selectedRoomId();
    if (prev && prev !== roomId) {
      this.signalR.leaveOrderRoom(prev).catch(() => {});
    }

    this.selectedRoomId.set(roomId);
    this.persistRoomId(roomId);
    this.messages.set([]);
    this.pendingAttachment.set(null);

    this.signalR.joinOrderRoom(roomId).catch(() => {});
    this.chatService.markConversationAsRead(roomId).subscribe({ error: () => {} });

    this.chatService.getMessages(roomId, 1, 100).subscribe({
      next: (page) => {
        const list = page?.items ?? [];
        const mapped = list.map(m => this.mapApiMessage(m));
        this.messages.set(mapped);
        this.queueScrollToLatest();

        const last = mapped[mapped.length - 1];
        if (last) {
          const preview = last.message || (last.attachmentFileName ? `📎 ${last.attachmentFileName}` : '');
          this.updateConversationPreview(roomId, preview, last.createdAt);
        } else {
          this.updateConversationPreview(roomId, 'Chat with Support Team', undefined);
        }
      },
      error: () => {
        this.toast.show('Could not load chat history.', 'error');
      }
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
    const roomId = this.selectedRoomId();
    if ((!text && !attachment) || !roomId || this.isSending()) return;

    this.isSending.set(true);
    const tempId = `tmp-${Date.now()}`;
    const preview = text || (attachment ? `📎 ${attachment.fileName}` : '');
    const optimisticMsg: ChatMessage = {
      id: tempId,
      message: text,
      createdAt: new Date().toISOString(),
      isMe: true,
      isRead: false,
      senderRole: 'Shopkeeper',
      attachmentUrl: attachment?.url || null,
      attachmentFileName: attachment?.fileName || null,
      attachmentContentType: attachment?.contentType || null
    };

    this.messages.update(m => [...m, optimisticMsg]);
    this.messageText.set('');
    this.pendingAttachment.set(null);
    this.queueScrollToLatest();

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
            m.id !== tempId && String(m.id || '').toLowerCase() !== realId.toLowerCase()
          );
          return [...without, { ...optimisticMsg, id: realId, isRead: false }];
        });
        this.updateConversationPreview(roomId, preview, new Date().toISOString());
      },
      error: (err) => {
        this.isSending.set(false);
        this.messages.update(m => m.filter(x => x.id !== tempId));
        this.toast.show(err?.error?.error || 'Failed to send message', 'error');
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

  isImageAttachment(msg: ChatMessage): boolean {
    const ct = (msg.attachmentContentType || '').toLowerCase();
    return ct.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(msg.attachmentFileName || '');
  }
}
