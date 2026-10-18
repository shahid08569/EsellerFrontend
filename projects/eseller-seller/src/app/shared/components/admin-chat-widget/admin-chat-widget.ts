import { Component, OnInit, OnDestroy, HostListener, inject, signal, computed, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthStore, ToastService, SignalRService, ChatService, SignalRIncomingMessage, SignalRMessageEdited, SignalRMessageDeleted, ParsedReply, parseMessageReply, buildReplyMessage, SkeletonLayout } from 'eseller-shared';
import { SellerService, ShopDto } from '../../../core/services/seller.service';

export interface SellerWidgetChannel {
  id: string;
  title: string;
  type: 'partner' | 'support';
}

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
  isEdited?: boolean;
  editedAt?: string | Date | null;
  isDeletedForEveryone?: boolean;
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
  imports: [CommonModule, FormsModule, SkeletonLayout],
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
  readonly channels = signal<SellerWidgetChannel[]>([]);
  readonly activeChannel = signal<SellerWidgetChannel | null>(null);
  readonly messageText = signal<string>('');
  readonly isSending = signal<boolean>(false);
  readonly uploadingFile = signal<boolean>(false);
  readonly pendingAttachment = signal<PendingAttachment | null>(null);
  readonly messages = signal<AdminChatMessage[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly editingMessage = signal<AdminChatMessage | null>(null);
  readonly replyingTo = signal<ParsedReply | null>(null);
  readonly deleteModalMessage = signal<AdminChatMessage | null>(null);
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
    const selected = msgs.filter(m => m.id && idSet.has(m.id));
    return selected.length > 0 && selected.every(m => m.sender === 'seller' && !m.isDeletedForEveryone);
  });

  private supportRoomId: string | null = null;
  private shouldScrollToBottom = false;
  private joinedRoomId: string | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeSignalR?: () => void;
  private unsubscribeMessageRead?: () => void;
  private unsubscribeMessageEdited?: () => void;
  private unsubscribeMessageDeleted?: () => void;
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

    // Check cached roomId for immediate instant load
    const cachedRoom = typeof window !== 'undefined'
      ? (window.sessionStorage?.getItem(WIDGET_SUPPORT_ROOM_KEY) || window.localStorage?.getItem(WIDGET_SUPPORT_ROOM_KEY))
      : null;
    if (cachedRoom) {
      this.supportRoomId = cachedRoom;
      this.fetchMessages(cachedRoom, false);
    }

    this.loadChannels();

    this.pollTimer = setInterval(() => {
      this.refreshUnreadBadge();
      if (this.isOpen() && this.supportRoomId) {
        this.fetchMessages(this.supportRoomId, false);
      }
    }, 8000);
  }

  loadChannels(): void {
    forkJoin({
      support: this.chatService.getShopSupportSession().pipe(catchError(() => of(null))),
      partner: this.chatService.getShopPartnerSession().pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ support, partner }) => {
        const chs: SellerWidgetChannel[] = [];
        if (partner && partner.conversationId) {
          chs.push({
            id: partner.conversationId,
            title: 'Customer Service',
            type: 'partner'
          });
          if (support) {
            const suppId = support.orderRequestId || support.conversationId;
            if (suppId) {
              chs.push({
                id: suppId,
                title: 'Management Service',
                type: 'support'
              });
            }
          }
        } else if (support) {
          const suppId = support.orderRequestId || support.conversationId;
          if (suppId) {
            chs.push({
              id: suppId,
              title: 'Customer Service',
              type: 'support'
            });
          }
        }

        this.channels.set(chs);
        if (chs.length > 0) {
          const currentId = this.supportRoomId;
          const match = currentId ? chs.find(c => c.id.toLowerCase() === currentId.toLowerCase()) : null;
          const chosen = match || chs[0];
          this.switchChannel(chosen, false);
        }
      }
    });
  }

  switchChannel(ch: SellerWidgetChannel, reload: boolean = true): void {
    if (this.joinedRoomId && this.joinedRoomId.toLowerCase() !== ch.id.toLowerCase()) {
      this.signalR.leaveOrderRoom(this.joinedRoomId).catch(() => {});
    }
    this.cancelEdit();
    this.cancelReply();
    this.exitSelectionMode();
    this.activeChannel.set(ch);
    this.supportRoomId = ch.id;
    this.persistRoomId(ch.id);
    this.joinedRoomId = ch.id;
    this.signalR.joinOrderRoom(ch.id).catch(() => {});
    if (reload || this.messages().length === 0) {
      this.fetchMessages(ch.id, this.isOpen());
    }
    this.queueScrollToLatest();
  }

  private persistRoomId(roomId: string): void {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.setItem(WIDGET_SUPPORT_ROOM_KEY, roomId);
        window.localStorage?.setItem(WIDGET_SUPPORT_ROOM_KEY, roomId);
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
              senderName: 'Customer Service',
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
          this.toast.show('New message from Customer Service', 'info');
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

      this.unsubscribeMessageEdited = this.signalR.onMessageEdited((payload) => {
        this.messages.update(list => list.map(m =>
          m.id && m.id.toLowerCase() === payload.messageId.toLowerCase()
            ? { ...m, message: payload.newContent, isEdited: true, editedAt: payload.editedAt }
            : m
        ));
      });

      this.unsubscribeMessageDeleted = this.signalR.onMessageDeleted((payload) => {
        if (payload.isDeletedForEveryone) {
          this.messages.update(list => list.map(m =>
            m.id && m.id.toLowerCase() === payload.messageId.toLowerCase()
              ? { ...m, message: 'This message was deleted', isDeletedForEveryone: true, attachmentUrl: null, attachmentFileName: null }
              : m
          ));
        } else {
          this.messages.update(list => list.filter(m =>
            !m.id || m.id.toLowerCase() !== payload.messageId.toLowerCase()
          ));
        }
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
      error: () => this.toast.show('Could not open Customer Support chat.', 'error')
    });
  }

  private refreshUnreadBadge(): void {
    this.chatService.getUnreadCount().subscribe({
      next: (res) => {
        if (this.isOpen()) {
          this.unreadCount.set(0);
        } else {
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
    this.unsubscribeMessageEdited?.();
    this.unsubscribeMessageDeleted?.();
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
      this.isLoading.set(true);
      if (this.supportRoomId) {
        this.fetchMessages(this.supportRoomId, true);
        this.chatService.markConversationAsRead(this.supportRoomId).subscribe({
          next: () => this.refreshUnreadBadge(),
          error: () => {}
        });
      } else {
        this.ensureSupportRoom((roomId) => this.joinAndLoad(roomId));
      }
      this.queueScrollToLatest();
    }
  }

  closeChat(): void {
    this.cancelEdit();
    this.cancelReply();
    this.exitSelectionMode();
    this.isOpen.set(false);
    this.unreadCount.set(0);
    if (this.supportRoomId) {
      this.chatService.markConversationAsRead(this.supportRoomId).subscribe({
        next: () => this.refreshUnreadBadge(),
        error: () => {}
      });
    }
  }

  sendQuickAction(actionType: 'gold' | 'diamond' | 'payment' | 'limit'): void {
    let msg = '';
    if (actionType === 'gold') {
      msg = 'Hello Admin, I would like to request an upgrade to Gold ($1000) for my store. Please provide payment verification details.';
    } else if (actionType === 'diamond') {
      msg = 'Hello Admin, I would like to request an upgrade to Diamond ($2000) for my store.';
    } else if (actionType === 'payment') {
      msg = 'I have submitted payment for my Tier Upgrade via Bank Transfer / ACH or Wire. Please reply with the payment details you need, and I will share my real transfer reference for verification.';
    } else if (actionType === 'limit') {
      msg = 'My store would like to expand catalog capacity on the Bronze plan.';
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

  getReplyInfo(raw: string | null | undefined): ParsedReply | null {
    return parseMessageReply(raw).reply;
  }

  getCleanMessage(raw: string | null | undefined): string {
    return parseMessageReply(raw).cleanText;
  }

  startReply(msg: AdminChatMessage): void {
    if (msg.isDeletedForEveryone) return;
    const clean = this.getCleanMessage(msg.message);
    const sName = msg.sender === 'seller' ? (this.shop()?.name || 'You') : 'Customer Service';
    this.replyingTo.set({
      id: msg.id,
      senderName: sName,
      text: clean || (msg.attachmentFileName ? `📎 ${msg.attachmentFileName}` : 'Message')
    });
    this.activeMenuMessageId.set(null);
    setTimeout(() => {
      const inp = document.getElementById('seller-chat-input') as HTMLInputElement | null;
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

  startEditMessage(msg: AdminChatMessage): void {
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
    if (!msg || !newContent || !msg.id) return;

    if (newContent === msg.message) {
      this.cancelEdit();
      return;
    }

    this.isSending.set(true);
    this.chatService.editMessage(msg.id, newContent).subscribe({
      next: () => {
        this.isSending.set(false);
        const now = new Date().toISOString();
        this.messages.update(list => list.map(m =>
          m.id === msg.id ? { ...m, message: newContent, isEdited: true, editedAt: now } : m
        ));
        this.cancelEdit();
      },
      error: (err) => {
        this.isSending.set(false);
        this.toast.show(err?.error?.error || 'Failed to edit message', 'error');
      }
    });
  }

  openDeleteModal(msg: AdminChatMessage): void {
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
          this.messages.update(list => list.map(m =>
            m.id === msg.id
              ? { ...m, message: 'This message was deleted', isDeletedForEveryone: true, attachmentUrl: null, attachmentFileName: null }
              : m
          ));
        } else {
          this.messages.update(list => list.filter(m => m.id !== msg.id));
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
    if (!ids || ids.length === 0) return;

    this.chatService.batchDeleteMessages(ids, forEveryone).subscribe({
      next: () => {
        const idSet = new Set(ids);
        if (forEveryone) {
          this.messages.update(list => list.map(m =>
            m.id && idSet.has(m.id)
              ? { ...m, message: 'This message was deleted', isDeletedForEveryone: true, attachmentUrl: null, attachmentFileName: null }
              : m
          ));
        } else {
          this.messages.update(list => list.filter(m => !m.id || !idSet.has(m.id)));
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
    if ((!text && !attachment) || this.isSending()) return;

    const reply = this.replyingTo();
    const payloadText = reply ? buildReplyMessage(reply, text) : text;

    this.sendMessageDirect(payloadText, attachment);
    this.messageText.set('');
    this.pendingAttachment.set(null);
    this.cancelReply();
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
          const isDel = !!(m.isDeletedForEveryone ?? m.IsDeletedForEveryone);
          return {
            id: m.id || `msg-${Math.random()}`,
            sender: isSeller ? 'seller' : 'admin',
            senderName: isSeller
              ? (this.shop()?.name || 'Merchant')
              : 'Customer Service',
            message: isDel ? 'This message was deleted' : (m.message || m.content || ''),
            timestamp: new Date(m.sentAt || m.createdAt || Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            }),
            isRead: !!m.isRead,
            attachmentUrl: isDel ? null : (m.attachmentUrl || null),
            attachmentFileName: isDel ? null : (m.attachmentFileName || null),
            attachmentContentType: isDel ? null : (m.attachmentContentType || null),
            isEdited: !!(m.isEdited ?? m.IsEdited),
            editedAt: m.editedAt || m.EditedAt || null,
            isDeletedForEveryone: isDel
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
        this.toast.show(err?.error?.error || 'Failed to send message to Customer Service.', 'error');
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
