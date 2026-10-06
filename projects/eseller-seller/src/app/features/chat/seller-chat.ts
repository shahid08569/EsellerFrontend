import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SellerService } from '../../core/services/seller.service';
import { SignalRService, AuthStore, ToastService, ChatService, SignalRIncomingMessage } from 'eseller-shared';

interface ChatMessage {
  id?: string;
  senderRole?: string;
  message: string;
  createdAt: string;
  isMe?: boolean;
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

@Component({
  selector: 'app-seller-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
    this.receiveMessageUnsubscribe = null;
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.shouldScrollToBottom = false;
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  private isMyRole(role: string | undefined): boolean {
    const roleLower = String(role || '').toLowerCase();
    return roleLower.includes('shopkeeper') || roleLower.includes('seller') || roleLower === '2';
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
              attachmentUrl: incoming.attachmentUrl || null,
              attachmentFileName: incoming.attachmentFileName || null,
              attachmentContentType: incoming.attachmentContentType || null
            }
          ];
        });
        this.shouldScrollToBottom = true;

        // Open thread — clear unread chat notifications for this conversation
        if (!isMe) {
          this.chatService.markConversationAsRead(roomId).subscribe({ error: () => {} });
        }

        this.conversations.update(list => list.map(c => {
          if (c.roomId === roomId) {
            return {
              ...c,
              lastMessage: incoming.message,
              lastMessageTime: incoming.sentAt || new Date().toISOString()
            };
          }
          return c;
        }));
      });
    }).catch(() => {});
  }

  loadConversations(productId?: string | null): void {
    this.isLoading.set(true);

    this.chatService.getShopSupportSession(productId).subscribe({
      next: (session) => {
        const roomId = session.orderRequestId || session.shopId;
        const supportConvo: ChatConversation = {
          roomId,
          title: 'Super Admin Support',
          lastMessage: productId
            ? 'Product inquiry attached for Super Admin'
            : 'Direct chat with Platform Super Admin',
          lastMessageTime: new Date().toISOString()
        };

        this.conversations.set([supportConvo]);
        this.isLoading.set(false);
        this.selectConversation(this.selectedRoomId() || roomId);
      },
      error: () => {
        this.sellerSvc.getMyShop().subscribe({
          next: (shop) => {
            const roomId = shop?.id;
            if (!roomId) {
              this.isLoading.set(false);
              this.toast.show('Failed to open Super Admin support chat', 'error');
              return;
            }
            const supportConvo: ChatConversation = {
              roomId,
              title: 'Super Admin Support',
              lastMessage: 'Direct chat with Platform Super Admin',
              lastMessageTime: new Date().toISOString()
            };
            this.conversations.set([supportConvo]);
            this.isLoading.set(false);
            this.selectConversation(this.selectedRoomId() || roomId);
          },
          error: () => {
            this.isLoading.set(false);
            this.toast.show('Failed to open Super Admin support chat', 'error');
          }
        });
      }
    });
  }

  selectConversation(roomId: string): void {
    const prev = this.selectedRoomId();
    if (prev && prev !== roomId) {
      this.signalR.leaveOrderRoom(prev).catch(() => {});
    }

    this.selectedRoomId.set(roomId);
    this.messages.set([]);
    this.pendingAttachment.set(null);

    this.signalR.joinOrderRoom(roomId).catch(() => {});
    this.chatService.markConversationAsRead(roomId).subscribe({ error: () => {} });

    this.sellerSvc.getOrderMessages(roomId).subscribe({
      next: (res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.items ?? []);
        const mapped = list.map(m => ({
          id: m.id,
          senderRole: m.senderRole,
          message: m.message || m.content || '',
          createdAt: m.createdAt || m.sentAt || new Date().toISOString(),
          isMe: this.isMyRole(m.senderRole) || m.senderRole === 2,
          attachmentUrl: m.attachmentUrl || null,
          attachmentFileName: m.attachmentFileName || null,
          attachmentContentType: m.attachmentContentType || null
        }));
        this.messages.set(mapped);
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
      senderRole: 'Shopkeeper',
      attachmentUrl: attachment?.url || null,
      attachmentFileName: attachment?.fileName || null,
      attachmentContentType: attachment?.contentType || null
    };

    this.messages.update(m => [...m, optimisticMsg]);
    this.messageText.set('');
    this.pendingAttachment.set(null);
    this.shouldScrollToBottom = true;

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
          return [...without, { ...optimisticMsg, id: realId }];
        });
        this.conversations.update(list => list.map(c =>
          c.roomId === roomId
            ? { ...c, lastMessage: preview, lastMessageTime: new Date().toISOString() }
            : c
        ));
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
