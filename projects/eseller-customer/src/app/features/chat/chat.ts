import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  HostListener,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AuthStore,
  SignalRService,
  ChatService,
  OrderService,
  SignalRIncomingMessage,
  SignalRMessageEdited,
  SignalRMessageDeleted,
  SkeletonLayout
} from 'eseller-shared';
import { HubConnectionState } from '@microsoft/signalr';

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'seller' | 'superadmin' | 'system';
  text: string;
  timestamp: Date;
  isEdited?: boolean;
  editedAt?: Date | string | null;
  isDeletedForEveryone?: boolean;
}

export interface ChatThread {
  orderRequestId: string;
  threadType: 'Shop' | 'Order' | 'Support' | string;
  shopId?: string | null;
  shopName: string;
  lastMessage?: string | null;
  lastMessageTime?: string | null;
  unreadCount?: number;
}

export interface StoredOrder {
  orderRef: string;
  createdAt: string;
  shopId: string;
  shopName: string;
  customer: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
    province: string;
    state?: string;
    country?: string;
    notes?: string;
  };
  items: Array<{
    id: string;
    productId: string;
    productSlug: string;
    name: string;
    imageUrl: string | null;
    shopId: string;
    shopName: string;
    price: number;
    quantity: number;
    variantId?: string | null;
    variantName?: string | null;
    sku?: string | null;
  }>;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  status: string;
}

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule, RouterLink, SkeletonLayout],
  templateUrl: './chat.html',
  styleUrl: './chat.css'
})
export class Chat implements OnInit, OnDestroy, AfterViewChecked {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly authStore = inject(AuthStore);
  readonly signalRService = inject(SignalRService);
  readonly chatService = inject(ChatService);
  readonly orderService = inject(OrderService);

  @ViewChild('chatFeedContainer') private chatFeedContainer?: ElementRef<HTMLDivElement>;
  private shouldScrollToBottom = false;
  private unsubscribeReceiveMessage?: () => void;
  private unsubscribeMessageEdited?: () => void;
  private unsubscribeMessageDeleted?: () => void;

  readonly isLoadingInbox = signal(true);
  readonly threads = signal<ChatThread[]>([]);
  readonly searchTerm = signal('');
  readonly selectedThreadId = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly messageText = signal('');
  readonly isSending = signal(false);
  private pendingAutosend = false;
  readonly feedbackMessage = signal<string | null>(null);
  readonly isFeedbackError = signal(false);
  readonly order = signal<StoredOrder | null>(null);
  readonly mobileShowChat = signal(false);
  readonly editingMessage = signal<ChatMessage | null>(null);
  readonly deleteModalMessage = signal<ChatMessage | null>(null);
  readonly activeMenuMessageId = signal<string | null>(null);
  readonly menuOpenUpwards = signal<boolean>(false);
  readonly isSelectionMode = signal<boolean>(false);
  readonly selectedMessageIds = signal<string[]>([]);
  readonly batchDeleteModalOpen = signal<boolean>(false);

  readonly selectedCount = computed(() => this.selectedMessageIds().length);
  readonly canDeleteSelectedForEveryone = computed(() => {
    const ids = this.selectedMessageIds();
    if (ids.length === 0) return false;
    const msgs = this.messages();
    const idSet = new Set(ids);
    const selected = msgs.filter(m => idSet.has(m.id));
    return selected.length > 0 && selected.every(m => m.sender === 'customer' && !m.isDeletedForEveryone);
  });

  readonly selectedThread = computed(() => {
    const id = this.selectedThreadId();
    if (!id) return null;
    return this.threads().find((t) => t.orderRequestId.toLowerCase() === id.toLowerCase()) || null;
  });

  readonly filteredThreads = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    let list = [...this.threads()];
    if (term) {
      list = list.filter(
        (t) =>
          t.shopName.toLowerCase().includes(term) ||
          (t.lastMessage || '').toLowerCase().includes(term) ||
          t.orderRequestId.toLowerCase().includes(term)
      );
    }
    return list.sort((a, b) => {
      const au = (a.unreadCount || 0) > 0 ? 1 : 0;
      const bu = (b.unreadCount || 0) > 0 ? 1 : 0;
      if (au !== bu) return bu - au;
      return new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime();
    });
  });

  readonly isSellerChat = computed(() => {
    const t = this.selectedThread();
    return !!t && t.threadType !== 'Support';
  });

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    this.initSignalR();
    this.loadInbox(() => {
      this.route.queryParamMap.subscribe((params) => {
        const orderRef = params.get('orderRef');
        const shopId = params.get('shopId');
        const productId = params.get('productId');
        this.pendingAutosend = params.get('autosend') === '1';
        void this.openFromQuery(orderRef, shopId, productId);
      });
    });
  }

  ngOnDestroy(): void {
    const id = this.selectedThreadId();
    if (id) {
      this.signalRService.leaveOrderRoom(id).catch(() => {});
    }
    this.unsubscribeReceiveMessage?.();
    this.unsubscribeMessageEdited?.();
    this.unsubscribeMessageDeleted?.();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.shouldScrollToBottom = false;
      this.scrollToBottom();
    }
  }

  private initSignalR(): void {
    if (!this.authStore.isAuthenticated()) return;
    this.signalRService
      .startChatConnection()
      .then(() => {
        this.unsubscribeReceiveMessage = this.signalRService.onReceiveMessage((incoming) => {
          this.handleIncoming(incoming);
        });

        this.unsubscribeMessageEdited = this.signalRService.onMessageEdited((payload) => {
          this.messages.update((list) =>
            list.map((m) =>
              m.id && String(m.id).toLowerCase() === payload.messageId.toLowerCase()
                ? { ...m, text: payload.newContent, isEdited: true, editedAt: payload.editedAt }
                : m
            )
          );
        });

        this.unsubscribeMessageDeleted = this.signalRService.onMessageDeleted((payload) => {
          if (payload.isDeletedForEveryone) {
            this.messages.update((list) =>
              list.map((m) =>
                m.id && String(m.id).toLowerCase() === payload.messageId.toLowerCase()
                  ? { ...m, text: 'This message was deleted', isDeletedForEveryone: true }
                  : m
              )
            );
          } else {
            this.messages.update((list) =>
              list.filter((m) => !m.id || String(m.id).toLowerCase() !== payload.messageId.toLowerCase())
            );
          }
        });

        const id = this.selectedThreadId();
        if (id) {
          this.signalRService.joinOrderRoom(id).catch(() => {});
        }
      })
      .catch((err) => console.warn('SignalR chat connection warning:', err));
  }

  private handleIncoming(incoming: SignalRIncomingMessage): void {
    const active = this.selectedThreadId();
    const room = incoming.orderRequestId;

    // Update inbox preview for any thread
    this.threads.update((list) => {
      const idx = list.findIndex((t) => t.orderRequestId.toLowerCase() === room.toLowerCase());
      if (idx < 0) {
        // Unknown thread — refresh inbox
        this.loadInbox();
        return list;
      }
      const copy = [...list];
      const isActive = !!active && active.toLowerCase() === room.toLowerCase();
      copy[idx] = {
        ...copy[idx],
        lastMessage: incoming.message,
        lastMessageTime: incoming.sentAt,
        unreadCount: isActive ? 0 : (copy[idx].unreadCount || 0) + 1
      };
      return copy;
    });

    if (!active || room.toLowerCase() !== active.toLowerCase()) return;

    const myId = this.authStore.currentAccount()?.accountId;
    if (myId && incoming.senderAccountId?.toLowerCase() === myId.toLowerCase()) return;
    if (incoming.messageId && this.messages().some((m) => m.id === incoming.messageId)) return;

    this.messages.update((list) => [
      ...list,
      {
        id: incoming.messageId,
        sender: this.mapSenderRole(incoming.senderRole),
        text: incoming.message,
        timestamp: new Date(incoming.sentAt)
      }
    ]);
    this.shouldScrollToBottom = true;
  }

  private mapSenderRole(role: string | number | null | undefined): ChatMessage['sender'] {
    const r = String(role ?? '').toLowerCase();
    if (r === '1' || r.includes('user') || r.includes('customer')) return 'customer';
    if (r === '4' || r.includes('shopkeeper') || r.includes('seller')) return 'seller';
    if (r === '2' || r.includes('superadmin') || r === '3' || r.includes('partner')) return 'superadmin';
    return this.isSellerChat() ? 'seller' : 'superadmin';
  }

  private isValidGuid(val: string | null | undefined): boolean {
    return !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  }

  shortOrderRef(ref: string | null | undefined): string {
    if (!ref) return '';
    if (this.isValidGuid(ref)) return `ORD-${ref.substring(0, 8).toUpperCase()}`;
    return ref;
  }

  loadInbox(done?: () => void): void {
    if (!this.authStore.isAuthenticated()) {
      this.isLoadingInbox.set(false);
      done?.();
      return;
    }
    this.isLoadingInbox.set(true);
    // Customers chat only with Customer Support (platform support).
    this.chatService.getSupportSession().subscribe({
      next: async (sess) => {
        const supportThread: ChatThread = {
          orderRequestId: sess.orderRequestId,
          threadType: 'Support',
          shopId: null,
          shopName: 'Customer Support',
          lastMessage: 'Direct chat with Customer Support',
          lastMessageTime: new Date().toISOString(),
          unreadCount: 0
        };
        this.threads.set([supportThread]);
        this.isLoadingInbox.set(false);
        done?.();
      },
      error: () => {
        this.isLoadingInbox.set(false);
        done?.();
      }
    });
  }

  private async openFromQuery(
    orderRef: string | null,
    shopId: string | null,
    _productId: string | null
  ): Promise<void> {
    // Load latest finalized order so WhatsApp-style template can prefill
    this.attachLocalOrder(orderRef, shopId);

    // Always route customer chat to Customer Support
    this.chatService.getSupportSession().subscribe({
      next: async (sess) => {
        if (!sess?.orderRequestId) return;
        await this.selectConversation(sess.orderRequestId, {
          shopName: 'Customer Support',
          threadType: 'Support',
          shopId: null
        });
      },
      error: () => this.showFeedback('Please sign in to chat with Customer Support.', true)
    });
  }

  private attachLocalOrder(orderRef: string | null, shopId: string | null): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const latestStr = window.localStorage.getItem('eseller_latest_order');
      if (!latestStr) return;
      const latest: StoredOrder = JSON.parse(latestStr);
      if (
        !orderRef ||
        latest.orderRef === orderRef ||
        (this.isValidGuid(orderRef) &&
          (latest.orderRef === this.shortOrderRef(orderRef) ||
            latest.orderRef?.toLowerCase() === orderRef.toLowerCase()))
      ) {
        if (orderRef && this.isValidGuid(orderRef)) {
          latest.orderRef = orderRef;
        }
        this.order.set(latest);
        return;
      }
      if (shopId && latest.shopId === shopId) {
        this.order.set(latest);
      }
    } catch {
      /* ignore */
    }
  }

  async selectConversation(
    orderRequestId: string,
    seed?: { shopName: string; threadType: string; shopId?: string | null }
  ): Promise<void> {
    const prev = this.selectedThreadId();
    if (prev && prev.toLowerCase() !== orderRequestId.toLowerCase()) {
      this.signalRService.leaveOrderRoom(prev).catch(() => {});
    }

    this.cancelEdit();
    this.exitSelectionMode();
    this.selectedThreadId.set(orderRequestId);
    this.mobileShowChat.set(true);
    this.messages.set([]);

    // Ensure thread appears in inbox
    if (!this.threads().some((t) => t.orderRequestId.toLowerCase() === orderRequestId.toLowerCase())) {
      this.threads.update((list) => [
        {
          orderRequestId,
          threadType: seed?.threadType || 'Shop',
          shopId: seed?.shopId || null,
          shopName: seed?.shopName || 'Seller',
          lastMessage: null,
          lastMessageTime: new Date().toISOString(),
          unreadCount: 0
        },
        ...list
      ]);
    }

    if (this.signalRService.chatState() === HubConnectionState.Connected) {
      await this.signalRService.joinOrderRoom(orderRequestId).catch(() => {});
    }

    this.chatService.markConversationAsRead(orderRequestId).subscribe({
      next: () => {
        this.threads.update((list) =>
          list.map((t) =>
            t.orderRequestId.toLowerCase() === orderRequestId.toLowerCase()
              ? { ...t, unreadCount: 0 }
              : t
          )
        );
      },
      error: () => {}
    });

    this.chatService.getMessages(orderRequestId, 1, 80).subscribe({
      next: (paged) => {
        const items = paged?.items || [];
        if (items.length === 0) {
          const name = this.selectedThread()?.shopName || 'seller';
          this.messages.set([
            {
              id: 'sys-empty',
              sender: 'system',
              text: `Chat with ${name}. Messages stay in this conversation only — like WhatsApp.`,
              timestamp: new Date()
            }
          ]);
        } else {
          this.messages.set(
            items.map((m) => {
              const isDel = !!m.isDeletedForEveryone;
              return {
                id: m.id,
                sender: this.mapSenderRole(m.senderRole),
                text: isDel ? 'This message was deleted' : m.message,
                timestamp: new Date(m.sentAt),
                isEdited: !!m.isEdited,
                editedAt: m.editedAt,
                isDeletedForEveryone: isDel
              };
            })
          );
        }
        this.shouldScrollToBottom = true;

        // Prefill order WhatsApp-style template for Super Admin
        const ord = this.order();
        if (ord && !this.messageText().trim()) {
          this.prefillOrderTemplate(ord);
          if (this.pendingAutosend) {
            this.pendingAutosend = false;
            // One-click send after finalize checkout
            setTimeout(() => this.sendOrderConfirmationNow(), 250);
          }
        }
      },
      error: () => {}
    });
  }

  private prefillOrderTemplate(ord: StoredOrder): void {
    const displayRef = this.shortOrderRef(ord.orderRef);
    const shop = ord.shopName || 'Store';
    const itemsSummary = ord.items
      .map(
        (i) =>
          `• ${i.name}${i.variantName ? ' (' + i.variantName + ')' : ''} × ${i.quantity} — $ ${(Number(i.price) * Number(i.quantity)).toLocaleString()}`
      )
      .join('\n');
    const country = ord.customer.country || '';
    const state = ord.customer.state || ord.customer.province || '';
    const addressSummary = [ord.customer.address, ord.customer.city, state, country]
      .filter(Boolean)
      .join(', ');

    this.messageText.set(
      `Hello Support Team! Please confirm my order.

🛒 Order #${displayRef}
🏪 Shop: ${shop}

📦 Products:
${itemsSummary}

📍 Delivery:
${ord.customer.fullName}
${ord.customer.phone}
${addressSummary}${ord.customer.notes ? '\nNote: ' + ord.customer.notes : ''}

💰 Total Amount (COD): $ ${Number(ord.totalAmount).toLocaleString()}

Please verify payment / dispatch. Thank you.`
    );
  }

  backToInbox(): void {
    this.cancelEdit();
    this.exitSelectionMode();
    this.mobileShowChat.set(false);
  }

  startEditMessage(msg: ChatMessage): void {
    if (msg.isDeletedForEveryone) return;
    this.editingMessage.set(msg);
    this.messageText.set(msg.text);
    this.activeMenuMessageId.set(null);
  }

  cancelEdit(): void {
    this.editingMessage.set(null);
    this.messageText.set('');
  }

  submitEditMessage(): void {
    const msg = this.editingMessage();
    const newContent = this.messageText().trim();
    if (!msg || !newContent || !msg.id) return;

    if (newContent === msg.text) {
      this.cancelEdit();
      return;
    }

    this.isSending.set(true);
    this.chatService.editMessage(msg.id, newContent).subscribe({
      next: () => {
        this.isSending.set(false);
        const now = new Date().toISOString();
        this.messages.update((list) =>
          list.map((m) =>
            m.id === msg.id ? { ...m, text: newContent, isEdited: true, editedAt: now } : m
          )
        );
        this.cancelEdit();
      },
      error: () => {
        this.isSending.set(false);
        this.showFeedback('Failed to edit message. Please try again.', true);
      }
    });
  }

  openDeleteModal(msg: ChatMessage): void {
    this.deleteModalMessage.set(msg);
    this.activeMenuMessageId.set(null);
  }

  closeDeleteModal(): void {
    this.deleteModalMessage.set(null);
  }

  confirmDelete(forEveryone: boolean): void {
    const msg = this.deleteModalMessage();
    if (!msg || !msg.id) return;

    this.chatService.deleteMessage(msg.id, forEveryone).subscribe({
      next: () => {
        if (forEveryone) {
          this.messages.update((list) =>
            list.map((m) =>
              m.id === msg.id
                ? { ...m, text: 'This message was deleted', isDeletedForEveryone: true }
                : m
            )
          );
        } else {
          this.messages.update((list) => list.filter((m) => m.id !== msg.id));
        }
        this.closeDeleteModal();
      },
      error: () => {
        this.showFeedback('Failed to delete message.', true);
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
      const container = this.chatFeedContainer?.nativeElement;
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
    if (!ids || ids.length === 0) return;

    this.chatService.batchDeleteMessages(ids, forEveryone).subscribe({
      next: () => {
        const idSet = new Set(ids);
        if (forEveryone) {
          this.messages.update(list => list.map(m =>
            idSet.has(m.id)
              ? { ...m, text: 'This message was deleted', isDeletedForEveryone: true }
              : m
          ));
        } else {
          this.messages.update(list => list.filter(m => !idSet.has(m.id)));
        }
        this.exitSelectionMode();
      },
      error: () => {
        this.showFeedback('Failed to delete selected messages.', true);
        this.closeBatchDeleteModal();
      }
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeMenuMessageId.set(null);
  }

  sendMessage(presetText?: string): void {
    if (this.editingMessage()) {
      this.submitEditMessage();
      return;
    }

    const text = (presetText || this.messageText()).trim();
    const orderId = this.selectedThreadId();
    if (!text || !orderId || this.isSending()) return;

    this.isSending.set(true);
    const tempId = 'tmp-' + Date.now();
    this.messages.update((list) => [
      ...list,
      { id: tempId, sender: 'customer', text, timestamp: new Date() }
    ]);
    if (!presetText) this.messageText.set('');
    this.shouldScrollToBottom = true;

    this.chatService.sendMessage(orderId, text).subscribe({
      next: (res) => {
        this.isSending.set(false);
        if (res?.messageId) {
          this.messages.update((list) =>
            list.map((m) => (m.id === tempId ? { ...m, id: res.messageId } : m))
          );
        }
        this.threads.update((list) =>
          list.map((t) =>
            t.orderRequestId.toLowerCase() === orderId.toLowerCase()
              ? { ...t, lastMessage: text, lastMessageTime: new Date().toISOString() }
              : t
          )
        );
      },
      error: () => {
        this.isSending.set(false);
        this.showFeedback('Failed to send message. Please try again.', true);
      }
    });
  }

  sendOrderConfirmationNow(): void {
    const text = this.messageText().trim();
    if (text) this.sendMessage(text);
  }

  onEnterKey(event: Event): void {
    const ke = event as KeyboardEvent;
    if (ke.key === 'Enter' && !ke.shiftKey) {
      ke.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    const el = this.chatFeedContainer?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private showFeedback(msg: string, isError = false): void {
    this.isFeedbackError.set(isError);
    this.feedbackMessage.set(msg);
    setTimeout(() => this.feedbackMessage.set(null), 3500);
  }
}
