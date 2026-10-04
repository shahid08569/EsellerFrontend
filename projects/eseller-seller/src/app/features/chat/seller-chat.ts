import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SellerService } from '../../core/services/seller.service';
import { SignalRService, AuthStore, ToastService, ChatService } from 'eseller-shared';

interface ChatMessage {
  id?: string;
  senderRole?: string;
  message: string;
  createdAt: string;
  isMe?: boolean;
}

interface ChatConversation {
  roomId: string;
  title: string;
  lastMessage?: string;
  lastMessageTime?: string;
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
    const supportId = this.route.snapshot.queryParamMap.get('support');
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

  private hasRecentOptimisticMatch(message: string, isMe: boolean, sentAt: string): boolean {
    const sentTime = new Date(sentAt).getTime();
    return this.messages().some(m =>
      !m.id &&
      m.isMe === isMe &&
      m.message === message &&
      Math.abs(new Date(m.createdAt).getTime() - sentTime) <= 5000
    );
  }

  private initSignalR(): void {
    this.signalR.startChatConnection().then(() => {
      this.receiveMessageUnsubscribe = this.signalR.onReceiveMessage((incoming) => {
        const roomId = this.selectedRoomId();
        if (!roomId || incoming.orderRequestId?.toLowerCase() !== roomId.toLowerCase()) {
          return;
        }

        const roleLower = String(incoming.senderRole || '').toLowerCase();
        const isMe =
          roleLower.includes('shopkeeper') ||
          roleLower.includes('seller') ||
          roleLower === '4' ||
          roleLower === '2';

        if (isMe && this.hasRecentOptimisticMatch(incoming.message, true, incoming.sentAt || new Date().toISOString())) {
          return;
        }

        const exists = this.messages().some(m =>
          m.id && incoming.messageId && m.id.toLowerCase() === String(incoming.messageId).toLowerCase()
        );
        if (exists) return;

        this.messages.update(list => [
          ...list,
          {
            id: incoming.messageId,
            senderRole: incoming.senderRole,
            message: incoming.message,
            createdAt: incoming.sentAt || new Date().toISOString(),
            isMe
          }
        ]);
        this.shouldScrollToBottom = true;

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
        // Fallback: resolve shop id and open room directly
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

    this.signalR.joinOrderRoom(roomId).catch(() => {});
    this.chatService.markConversationAsRead(roomId).subscribe({ error: () => {} });

    this.sellerSvc.getOrderMessages(roomId).subscribe({
      next: (res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.items ?? []);
        const mapped = list.map(m => {
          const roleLower = String(m.senderRole || '').toLowerCase();
          const isMe =
            roleLower.includes('shopkeeper') ||
            roleLower.includes('seller') ||
            roleLower === '4' ||
            roleLower === '2' ||
            m.senderRole === 4 ||
            m.senderRole === 2;
          return {
            id: m.id,
            senderRole: m.senderRole,
            message: m.message || m.content,
            createdAt: m.createdAt || m.sentAt || new Date().toISOString(),
            isMe
          };
        });
        this.messages.set(mapped);
        this.shouldScrollToBottom = true;
      },
      error: () => {}
    });
  }

  sendMessage(): void {
    const text = this.messageText().trim();
    const roomId = this.selectedRoomId();
    if (!text || !roomId || this.isSending()) return;

    this.isSending.set(true);
    const optimisticMsg: ChatMessage = {
      message: text,
      createdAt: new Date().toISOString(),
      isMe: true,
      senderRole: 'Shopkeeper'
    };

    this.messages.update(m => [...m, optimisticMsg]);
    this.messageText.set('');
    this.shouldScrollToBottom = true;

    this.sellerSvc.sendMessage(roomId, text).subscribe({
      next: () => {
        this.isSending.set(false);
      },
      error: (err) => {
        this.isSending.set(false);
        this.toast.show(err?.error?.error || 'Failed to send message', 'error');
      }
    });
  }
}
