import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, HostListener, inject, signal, computed } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ToastService, SignalRService, SignalRIncomingMessage, SignalRMessageEdited, SignalRMessageDeleted, ChatService, SkeletonLayout, ParsedReply, parseMessageReply, buildReplyMessage } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminChatUnreadService } from '../../../core/services/admin-chat-unread.service';

export interface AdminDisplayMessage {
  id: string;
  senderName: string;
  content: string;
  createdAt: string | Date;
  isFromAdmin: boolean;
  attachmentUrl?: string | null;
  attachmentFileName?: string | null;
  attachmentContentType?: string | null;
  isEdited?: boolean;
  editedAt?: string | Date | null;
  isDeletedForEveryone?: boolean;
  isDelivered?: boolean;
  deliveredAt?: string | Date | null;
  isRead?: boolean;
  readAt?: string | Date | null;
}

@Component({
  selector: 'app-admin-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, NgTemplateOutlet, SkeletonLayout],
  templateUrl: './admin-chat.html'
})
export class AdminChat implements OnInit, OnDestroy, AfterViewChecked {
  private readonly route = inject(ActivatedRoute);
  private readonly adminService = inject(AdminService);
  private readonly signalRService = inject(SignalRService);
  private readonly chatService = inject(ChatService);
  private readonly chatUnread = inject(AdminChatUnreadService);
  private readonly toast = inject(ToastService);

  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;
  private shouldScrollToBottom = false;
  private activeMessageRequestId: string | null = null;
  private messagesSub?: Subscription;

  readonly isLoading = signal<boolean>(true);
  readonly isLoadingMessages = signal<boolean>(false);
  readonly conversations = signal<any[]>([]);
  readonly activeConversation = signal<any | null>(null);
  readonly messages = signal<AdminDisplayMessage[]>([]);
  readonly newMessage = signal<string>('');
  readonly sendingMessage = signal<boolean>(false);
  readonly uploadingFile = signal<boolean>(false);
  readonly searchTerm = signal<string>('');
  /** Inbox filter: Support | Customers only */
  readonly filterTab = signal<'support' | 'customers'>('support');
  readonly pendingAttachment = signal<{
    url: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  } | null>(null);
  readonly editingMessage = signal<AdminDisplayMessage | null>(null);
  readonly replyingTo = signal<ParsedReply | null>(null);
  readonly deleteModalMessage = signal<AdminDisplayMessage | null>(null);
  readonly activeMenuMessageId = signal<string | null>(null);
  readonly menuOpenUpwards = signal<boolean>(false);
  readonly isSelectionMode = signal<boolean>(false);
  readonly selectedMessageIds = signal<string[]>([]);
  readonly batchDeleteModalOpen = signal<boolean>(false);

  readonly selectedCount = computed(() => this.selectedMessageIds().length);

  readonly canDeleteSelectedForEveryone = computed(() => {
    const selectedIds = new Set(this.selectedMessageIds());
    if (selectedIds.size === 0) return false;
    const allSelected = this.messages().filter(m => selectedIds.has(m.id));
    if (allSelected.length === 0) return false;
    return allSelected.every(m => m.isFromAdmin && !m.isDeletedForEveryone);
  });

  readonly enrichedConversations = computed(() => {
    void this.chatUnread.byConversationId();
    const activeId = String(
      this.activeConversation()?.orderRequestId || this.activeConversation()?.id || ''
    ).toLowerCase();
    let list = this.conversations().map(c => {
      const id = String(c.orderRequestId || c.id || '');
      if (activeId && id.toLowerCase() === activeId) {
        return { ...c, unreadCount: 0 };
      }
      const shared = id ? this.chatUnread.unreadFor(id) : 0;
      const unreadCount = Math.max(Number(c.unreadCount || 0), shared);
      return { ...c, unreadCount };
    });

    const term = this.searchTerm().trim().toLowerCase();
    if (term) {
      list = list.filter(c => {
        const name = (c.customerName || c.participantName || c.shopName || '').toLowerCase();
        const last = (c.lastMessage || '').toLowerCase();
        const status = (c.orderStatus || '').toLowerCase();
        return name.includes(term) || last.includes(term) || status.includes(term);
      });
    }

    return [...list].sort((a, b) => {
      const aUnread = (a.unreadCount || 0) > 0 ? 1 : 0;
      const bUnread = (b.unreadCount || 0) > 0 ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      const aTime = new Date(a.lastMessageAt || a.orderCreatedAt || 0).getTime();
      const bTime = new Date(b.lastMessageAt || b.orderCreatedAt || 0).getTime();
      return bTime - aTime;
    });
  });

  readonly filteredConversations = computed(() => {
    const tab = this.filterTab();
    const list = this.enrichedConversations();
    if (tab === 'customers') return list.filter(c => !this.isSellerSupport(c));
    return list.filter(c => this.isSellerSupport(c));
  });

  readonly supportTabCount = computed(() =>
    this.enrichedConversations().filter(c => this.isSellerSupport(c)).length
  );

  readonly customerTabCount = computed(() =>
    this.enrichedConversations().filter(c => !this.isSellerSupport(c)).length
  );

  private unsubscribeSignalR?: () => void;
  private unsubscribeEdited?: () => void;
  private unsubscribeDeleted?: () => void;
  private unsubscribeMessageDelivered?: () => void;
  private unsubscribeMessageRead?: () => void;

  ngOnInit(): void {
    this.initSignalR();
    this.loadConversations();
  }

  ngOnDestroy(): void {
    this.messagesSub?.unsubscribe();
    const convo = this.activeConversation();
    if (convo) {
      const orderId = convo.orderRequestId || convo.id;
      if (orderId) {
        this.signalRService.leaveOrderRoom(orderId).catch(() => {});
      }
    }
    this.unsubscribeSignalR?.();
    this.unsubscribeEdited?.();
    this.unsubscribeDeleted?.();
    this.unsubscribeMessageDelivered?.();
    this.unsubscribeMessageRead?.();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
    }
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

  private initSignalR(): void {
    this.signalRService.startChatConnection()
      .then(() => {
        this.unsubscribeSignalR = this.signalRService.onReceiveMessage((incoming: SignalRIncomingMessage) => {
          this.handleIncomingMessage(incoming);
        });
        this.unsubscribeEdited = this.signalRService.onMessageEdited((payload) => {
          this.messages.update(list => list.map(m =>
            String(m.id).toLowerCase() === payload.messageId.toLowerCase()
              ? { ...m, content: payload.newContent, isEdited: true, editedAt: payload.editedAt }
              : m
          ));
        });
        this.unsubscribeDeleted = this.signalRService.onMessageDeleted((payload) => {
          if (payload.isDeletedForEveryone) {
            this.messages.update(list => list.map(m =>
              String(m.id).toLowerCase() === payload.messageId.toLowerCase()
                ? { ...m, content: 'This message was deleted', isDeletedForEveryone: true, attachmentUrl: null, attachmentFileName: null }
                : m
            ));
          } else {
            this.messages.update(list => list.filter(m =>
              String(m.id).toLowerCase() !== payload.messageId.toLowerCase()
            ));
          }
        });
        this.unsubscribeMessageDelivered = this.signalRService.onMessageDelivered((messageId, deliveredAt) => {
          this.messages.update(list => list.map(m =>
            String(m.id).toLowerCase() === String(messageId).toLowerCase()
              ? { ...m, isDelivered: true, deliveredAt }
              : m
          ));
        });
        this.unsubscribeMessageRead = this.signalRService.onMessageRead((messageId, readAt) => {
          this.messages.update(list => list.map(m =>
            String(m.id).toLowerCase() === String(messageId).toLowerCase()
              ? { ...m, isRead: true, isDelivered: true, readAt }
              : m
          ));
        });
        const active = this.activeConversation();
        if (active) {
          const orderId = active.orderRequestId || active.id;
          if (orderId) {
            this.signalRService.joinOrderRoom(orderId).catch(() => {});
          }
        }
      })
      .catch((err) => {
        console.warn('SignalR chat connection warning in AdminChat:', err);
      });
  }

  private handleIncomingMessage(incoming: SignalRIncomingMessage): void {
    const active = this.activeConversation();
    const activeOrderId = active ? (active.orderRequestId || active.id) : null;
    const roleLower = String(incoming.senderRole || '').toLowerCase();
    const isFromAdmin = roleLower.includes('superadmin') || roleLower.includes('admin') || roleLower.includes('partner');
    const isShopkeeper = roleLower.includes('shopkeeper') || roleLower.includes('seller');
    const senderDisplayName = isFromAdmin ? 'Management' : (isShopkeeper ? (active?.shopName || active?.customerName || 'Merchant Store') : (active?.customerName || 'Customer'));
    const incomingId = String(incoming.messageId || '').toLowerCase();

    // If message belongs to active thread, append (dedupe by id / temp optimistic)
    if (activeOrderId && incoming.orderRequestId && incoming.orderRequestId.toLowerCase() === activeOrderId.toLowerCase()) {
      this.messages.update((list) => {
        if (incomingId && list.some(m => String(m.id).toLowerCase() === incomingId)) {
          return list;
        }
        // Drop matching optimistic temp bubble
        const withoutTemp = list.filter(m =>
          !(String(m.id).startsWith('tmp-') && m.isFromAdmin === isFromAdmin
            && (m.content === incoming.message
              || (!!incoming.attachmentUrl && m.attachmentUrl === incoming.attachmentUrl)))
        );
        return [
          ...withoutTemp,
          {
            id: incoming.messageId || ('msg-' + Date.now()),
            senderName: senderDisplayName,
            content: incoming.message,
            createdAt: incoming.sentAt || new Date().toISOString(),
            isFromAdmin: isFromAdmin,
            attachmentUrl: incoming.attachmentUrl || null,
            attachmentFileName: incoming.attachmentFileName || null,
            attachmentContentType: incoming.attachmentContentType || null
          }
        ];
      });
      this.queueScrollToLatest();
      // Thread is open — mark read so badges don't stick on already-seen messages
      if (!isFromAdmin && activeOrderId) {
        this.chatUnread.markConversationRead(activeOrderId);
      }
    }

    // Update conversation sidebar preview — bump unreadCount (WhatsApp-style) unless the thread is open & it's our own message.
    const isActiveThread = !!activeOrderId && incoming.orderRequestId?.toLowerCase() === activeOrderId.toLowerCase();
    const found = this.conversations().some(c => (c.orderRequestId || c.id)?.toLowerCase() === incoming.orderRequestId?.toLowerCase());
    if (found) {
      this.conversations.update(list => list.map(c => {
        if ((c.orderRequestId || c.id)?.toLowerCase() === incoming.orderRequestId?.toLowerCase()) {
          return {
            ...c,
            lastMessage: incoming.message,
            lastMessageAt: incoming.sentAt || new Date().toISOString(),
            unreadCount: (!isFromAdmin && !isActiveThread) ? (c.unreadCount || 0) + 1 : (isActiveThread ? 0 : c.unreadCount)
          };
        }
        return c;
      }));
      if (!isFromAdmin && !isActiveThread && incoming.orderRequestId) {
        this.chatUnread.bump(incoming.orderRequestId, 1);
      }
    } else {
      // New conversation from new customer — reload list immediately
      this.loadConversations(false);
    }

    // Notify even when another thread is open / inbox in background
    if (!activeOrderId || incoming.orderRequestId?.toLowerCase() !== activeOrderId.toLowerCase()) {
      if (!isFromAdmin) {
        this.toast.show(`New chat: ${incoming.message?.slice(0, 80) || 'message'}`, 'info');
      }
    }
  }

  loadConversations(selectFirst = true): void {
    this.isLoading.set(true);
    const targetId =
      this.route.snapshot.queryParamMap.get('targetId') ||
      this.route.snapshot.queryParamMap.get('c');
    const targetName = this.route.snapshot.queryParamMap.get('name');

    this.adminService.getConversations().subscribe({
      next: (list: any) => {
        let convos = Array.isArray(list) ? list : (list?.items || list?.conversations || []);

        if (targetId) {
          const found = convos.find((c: any) => (c.orderRequestId || c.id)?.toLowerCase() === targetId.toLowerCase());
          if (found) {
            this.conversations.set(convos);
            this.chatUnread.applyFromConversations(convos);
            this.isLoading.set(false);
            this.selectConversation(found);
            return;
          } else {
            const virtualConvo = {
              id: targetId,
              orderRequestId: targetId,
              customerName: targetName || 'Merchant Partner',
              shopName: targetName || 'Merchant Store',
              lastMessage: 'Direct Support Channel',
              orderStatus: 'Active Partner'
            };
            convos = [virtualConvo, ...convos];
            this.conversations.set(convos);
            this.chatUnread.applyFromConversations(convos);
            this.isLoading.set(false);
            this.selectConversation(virtualConvo);
            return;
          }
        }

        this.conversations.set(convos);
        this.chatUnread.applyFromConversations(convos);
        this.isLoading.set(false);

        // Do NOT auto-open first thread — that clears unread before admin chooses who messaged.
        // Only open a thread when deep-linked (?targetId=) or when selectFirst is used after targetId path above.
        if (selectFirst && targetId && convos.length > 0 && !this.activeConversation()) {
          const match = convos.find((c: any) =>
            (c.orderRequestId || c.id)?.toLowerCase() === targetId.toLowerCase());
          if (match) this.selectConversation(match);
        }
      },
      error: () => {
        if (targetId) {
          const virtualConvo = {
            id: targetId,
            orderRequestId: targetId,
            customerName: targetName || 'Merchant Partner',
            shopName: targetName || 'Merchant Store',
            lastMessage: 'Direct Support Channel',
            orderStatus: 'Active Partner'
          };
          this.conversations.set([virtualConvo]);
          this.isLoading.set(false);
          this.selectConversation(virtualConvo);
        } else {
          this.conversations.set([]);
          this.isLoading.set(false);
        }
      }
    });
  }

  selectConversation(convo: any): void {
    const targetId = convo.orderRequestId || convo.id;
    if (!targetId) return;

    const normalizedTargetId = String(targetId).toLowerCase();

    // Cancel any inflight message request
    this.messagesSub?.unsubscribe();
    this.activeMessageRequestId = normalizedTargetId;
    this.isLoadingMessages.set(true);

    const prevConvo = this.activeConversation();
    if (prevConvo) {
      const prevId = prevConvo.orderRequestId || prevConvo.id;
      if (prevId && String(prevId).toLowerCase() !== normalizedTargetId) {
        this.signalRService.leaveOrderRoom(prevId).catch(() => {});
      }
    }

    this.exitSelectionMode();
    this.cancelEdit();
    this.cancelReply();
    this.activeConversation.set(convo);
    this.messages.set([]);

    // Mark as read immediately in the sidebar (WhatsApp-style — opening a thread clears its unread badge).
    this.conversations.update(list => list.map(c => {
      const id = c.orderRequestId || c.id;
      return id && String(id).toLowerCase() === normalizedTargetId
        ? { ...c, unreadCount: 0 }
        : c;
    }));
    this.chatUnread.markConversationRead(targetId);

    this.signalRService.joinOrderRoom(targetId).catch(() => {});
    this.messagesSub = this.adminService.getConversationMessages(targetId).subscribe({
      next: (msgs: any) => {
        // Race condition guard: ignore if user switched conversations
        if (this.activeMessageRequestId !== normalizedTargetId) {
          return;
        }
        this.isLoadingMessages.set(false);
        const list = Array.isArray(msgs) ? msgs : (msgs?.items || msgs?.messages || []);
        this.messages.set(list.map((m: any) => {
          const roleLower = String(m.senderRole || '').toLowerCase();
          const isFromAdmin = roleLower.includes('superadmin') || roleLower.includes('admin') || roleLower.includes('partner');
          const isShopkeeper = roleLower.includes('shopkeeper') || roleLower.includes('seller') || roleLower === '2';
          const senderDisplayName = isFromAdmin ? 'Management' : (isShopkeeper ? (convo.shopName || convo.customerName || 'Merchant Store') : (convo.customerName || 'Customer'));
          const isDel = !!(m.isDeletedForEveryone ?? m.IsDeletedForEveryone);
          return {
            id: m.id || m.Id,
            senderName: senderDisplayName,
            content: isDel ? 'This message was deleted' : (m.message || m.content || m.Message || m.Content || ''),
            createdAt: m.sentAt || m.createdAt || m.SentAt || m.CreatedAt || new Date().toISOString(),
            isFromAdmin: isFromAdmin,
            attachmentUrl: isDel ? null : (m.attachmentUrl || m.AttachmentUrl || null),
            attachmentFileName: isDel ? null : (m.attachmentFileName || m.AttachmentFileName || null),
            attachmentContentType: isDel ? null : (m.attachmentContentType || m.AttachmentContentType || null),
            isEdited: !!(m.isEdited ?? m.IsEdited),
            editedAt: m.editedAt || m.EditedAt || null,
            isDeletedForEveryone: isDel,
            isRead: !!(m.isRead ?? m.IsRead),
            readAt: m.readAt || m.ReadAt || null,
            isDelivered: !!(m.deliveredAt || m.DeliveredAt || m.isRead || m.IsRead),
            deliveredAt: m.deliveredAt || m.DeliveredAt || null
          };
        }));
        this.queueScrollToLatest();
      },
      error: () => {
        if (this.activeMessageRequestId === normalizedTargetId) {
          this.isLoadingMessages.set(false);
          this.messages.set([]);
        }
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploadingFile.set(true);
    this.adminService.uploadChatAttachment(file).subscribe({
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

  startReply(msg: AdminDisplayMessage): void {
    if (msg.isDeletedForEveryone) return;
    const clean = this.getCleanMessage(msg.content);
    const sName = msg.isFromAdmin ? 'Management' : (msg.senderName || 'Customer');
    this.replyingTo.set({
      id: msg.id,
      senderName: sName,
      text: clean || (msg.attachmentFileName ? `📎 ${msg.attachmentFileName}` : 'Message')
    });
    this.activeMenuMessageId.set(null);
    setTimeout(() => {
      const inp = document.getElementById('admin-chat-inbox-input') as HTMLInputElement | null;
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

  startEditMessage(msg: AdminDisplayMessage): void {
    if (msg.isDeletedForEveryone) return;
    this.editingMessage.set(msg);
    this.newMessage.set(this.getCleanMessage(msg.content));
    this.cancelReply();
    this.activeMenuMessageId.set(null);
  }

  cancelEdit(): void {
    this.editingMessage.set(null);
    this.newMessage.set('');
  }

  submitEditMessage(): void {
    const msg = this.editingMessage();
    const newContent = this.newMessage().trim();
    if (!msg || !newContent) return;

    if (newContent === msg.content) {
      this.cancelEdit();
      return;
    }

    this.sendingMessage.set(true);
    this.adminService.editChatMessage(msg.id, newContent).subscribe({
      next: () => {
        this.sendingMessage.set(false);
        const now = new Date().toISOString();
        this.messages.update(list => list.map(m =>
          m.id === msg.id ? { ...m, content: newContent, isEdited: true, editedAt: now } : m
        ));
        this.cancelEdit();
      },
      error: (err) => {
        this.sendingMessage.set(false);
        this.toast.show(err?.error?.error || 'Failed to edit message', 'error');
      }
    });
  }

  openDeleteModal(msg: AdminDisplayMessage): void {
    this.deleteModalMessage.set(msg);
    this.activeMenuMessageId.set(null);
  }

  closeDeleteModal(): void {
    this.deleteModalMessage.set(null);
  }

  confirmDelete(forEveryone: boolean): void {
    const msg = this.deleteModalMessage();
    if (!msg) return;

    this.adminService.deleteChatMessage(msg.id, forEveryone).subscribe({
      next: () => {
        if (forEveryone) {
          this.messages.update(list => list.map(m =>
            m.id === msg.id
              ? { ...m, content: 'This message was deleted', isDeletedForEveryone: true, attachmentUrl: null, attachmentFileName: null }
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

    this.adminService.batchDeleteChatMessages(ids, forEveryone).subscribe({
      next: () => {
        const idSet = new Set(ids);
        if (forEveryone) {
          this.messages.update(list => list.map(m =>
            idSet.has(m.id)
              ? { ...m, content: 'This message was deleted', isDeletedForEveryone: true, attachmentUrl: null, attachmentFileName: null }
              : m
          ));
        } else {
          this.messages.update(list => list.filter(m => !idSet.has(m.id)));
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

    const rawText = this.newMessage().trim();
    const reply = this.replyingTo();
    const text = buildReplyMessage(reply, rawText);
    const attachment = this.pendingAttachment();
    const convo = this.activeConversation();
    if ((!text && !attachment) || !convo) return;

    const targetId = convo.orderRequestId || convo.id;
    if (!targetId) return;

    this.sendingMessage.set(true);
    this.cancelReply();
    const tempId = `tmp-${Date.now()}`;
    const preview = rawText || (attachment ? `📎 ${attachment.fileName}` : '');
    this.messages.update(prev => [...prev, {
      id: tempId,
      senderName: 'Management',
      content: text,
      createdAt: new Date().toISOString(),
      isFromAdmin: true,
      attachmentUrl: attachment?.url || null,
      attachmentFileName: attachment?.fileName || null,
      attachmentContentType: attachment?.contentType || null,
      isDelivered: false,
      isRead: false
    }]);
    this.newMessage.set('');
    this.pendingAttachment.set(null);
    this.queueScrollToLatest();

    this.adminService.sendMessage(targetId, text, attachment ? {
      attachmentUrl: attachment.url,
      attachmentFileName: attachment.fileName,
      attachmentContentType: attachment.contentType,
      attachmentSizeBytes: attachment.sizeBytes
    } : null).subscribe({
      next: (msg) => {
        this.sendingMessage.set(false);
        const realId = msg?.messageId ? String(msg.messageId) : tempId;
        const isDelivered = !!(msg?.isDelivered);
        const deliveredAt = msg?.deliveredAt || null;
        this.messages.update(prev => {
          const withoutDupes = prev.filter(m =>
            m.id !== tempId && String(m.id).toLowerCase() !== realId.toLowerCase()
          );
          return [...withoutDupes, {
            id: realId,
            senderName: 'Management',
            content: text,
            createdAt: new Date().toISOString(),
            isFromAdmin: true,
            attachmentUrl: attachment?.url || null,
            attachmentFileName: attachment?.fileName || null,
            attachmentContentType: attachment?.contentType || null,
            isDelivered: isDelivered,
            deliveredAt: deliveredAt,
            isRead: false
          }];
        });

        this.conversations.update(list => list.map(c => {
          const id = c.orderRequestId || c.id;
          if (id && String(id).toLowerCase() === String(targetId).toLowerCase()) {
            return {
              ...c,
              lastMessage: preview,
              lastMessageAt: new Date().toISOString()
            };
          }
          return c;
        }));
      },
      error: (err) => {
        this.sendingMessage.set(false);
        this.messages.update(prev => prev.filter(m => m.id !== tempId));
        this.toast.show(err?.error?.error || 'Failed to send message', 'error');
      }
    });
  }

  attachmentHref(url: string | null | undefined): string {
    if (!url) return '#';
    if (url.startsWith('http')) return url;
    return this.adminService.formatImageUrl(url) || url;
  }

  isImageAttachment(msg: AdminDisplayMessage): boolean {
    const ct = (msg.attachmentContentType || '').toLowerCase();
    return ct.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(msg.attachmentFileName || '');
  }

  statusBadgeClass(status: string | null | undefined): string {
    const s = String(status || '').toLowerCase();
    if (s.includes('verified') || s.includes('approved') || s.includes('confirmed') || s.includes('active')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (s.includes('reject')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (s.includes('pending')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-slate-50 text-slate-600 border-slate-200';
  }

  productContextImage(): string | null {
    const c = this.activeConversation();
    const raw = c?.contextProductImageUrl || c?.ContextProductImageUrl || null;
    if (!raw) return null;
    return this.adminService.formatImageUrl(raw) || null;
  }

  isSellerSupport(convo: any): boolean {
    const pt = String(convo?.participantType || convo?.ParticipantType || '').toLowerCase();
    if (pt === 'seller' || pt === '2' || pt === 'shopkeeper') return true;
    if (pt === 'customer' || pt === '1' || pt === 'user') return false;
    const s = String(convo?.orderStatus || '');
    return s.includes('Merchant') || s.includes('Partner') || s.includes('Verification')
      || s.includes('Active Partner') || s.includes('Seller');
  }

  displayName(convo: any): string {
    return convo?.customerName || convo?.participantName || convo?.shopName || 'Conversation';
  }

  initials(convo: any): string {
    const name = this.displayName(convo).trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return (name.charAt(0) || '?').toUpperCase();
  }

  relativeTime(iso: string | Date | null | undefined): string {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '';
    const diffMs = Date.now() - t;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d`;
    const months = Math.floor(days / 30);
    return `${months}mo`;
  }

  setFilterTab(tab: 'support' | 'customers'): void {
    this.filterTab.set(tab);
  }

  isActiveConvo(convo: any): boolean {
    const a = this.activeConversation();
    if (!a) return false;
    return String(a.orderRequestId || a.id || '').toLowerCase()
      === String(convo?.orderRequestId || convo?.id || '').toLowerCase();
  }

  formatImageUrl(url?: string | null): string {
    return this.adminService.formatImageUrl(url);
  }

  onImgError(event: Event, name?: string): void {
    const img = event.target as HTMLImageElement;
    img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Shop')}&background=EA580C&color=fff&bold=true`;
  }
}
