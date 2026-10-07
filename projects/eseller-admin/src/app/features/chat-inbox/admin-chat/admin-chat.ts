import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastService, SignalRService, SignalRIncomingMessage, ChatService, SkeletonLayout } from 'eseller-shared';
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
}

@Component({
  selector: 'app-admin-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
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

  readonly isLoading = signal<boolean>(true);
  readonly conversations = signal<any[]>([]);
  readonly activeConversation = signal<any | null>(null);
  readonly messages = signal<AdminDisplayMessage[]>([]);
  readonly newMessage = signal<string>('');
  readonly sendingMessage = signal<boolean>(false);
  readonly uploadingFile = signal<boolean>(false);
  readonly searchTerm = signal<string>('');
  readonly pendingAttachment = signal<{
    url: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  } | null>(null);

  readonly filteredConversations = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    // Depend on shared map so Live Chat list badges update when FAB/sidebar poll bumps
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
    if (term) {
      list = list.filter(c => {
        const name = (c.customerName || c.participantName || c.shopName || '').toLowerCase();
        const last = (c.lastMessage || '').toLowerCase();
        const status = (c.orderStatus || '').toLowerCase();
        return name.includes(term) || last.includes(term) || status.includes(term);
      });
    }

    // WhatsApp-style ordering: unread threads first, then most-recently active.
    return [...list].sort((a, b) => {
      const aUnread = (a.unreadCount || 0) > 0 ? 1 : 0;
      const bUnread = (b.unreadCount || 0) > 0 ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      const aTime = new Date(a.lastMessageAt || a.orderCreatedAt || 0).getTime();
      const bTime = new Date(b.lastMessageAt || b.orderCreatedAt || 0).getTime();
      return bTime - aTime;
    });
  });

  private unsubscribeSignalR?: () => void;

  ngOnInit(): void {
    this.initSignalR();
    this.loadConversations();
  }

  ngOnDestroy(): void {
    const convo = this.activeConversation();
    if (convo) {
      const orderId = convo.orderRequestId || convo.id;
      if (orderId) {
        this.signalRService.leaveOrderRoom(orderId).catch(() => {});
      }
    }
    this.unsubscribeSignalR?.();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.shouldScrollToBottom = false;
      const el = this.messagesContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }

  private initSignalR(): void {
    this.signalRService.startChatConnection()
      .then(() => {
        this.unsubscribeSignalR = this.signalRService.onReceiveMessage((incoming: SignalRIncomingMessage) => {
          this.handleIncomingMessage(incoming);
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
    const senderDisplayName = isFromAdmin ? 'Super Admin' : (isShopkeeper ? (active?.shopName || active?.customerName || 'Merchant Store') : (active?.customerName || 'Customer'));
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
      this.shouldScrollToBottom = true;
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
    const prevConvo = this.activeConversation();
    if (prevConvo) {
      const prevId = prevConvo.orderRequestId || prevConvo.id;
      if (prevId) {
        this.signalRService.leaveOrderRoom(prevId).catch(() => {});
      }
    }

    this.activeConversation.set(convo);
    this.messages.set([]);

    // Mark as read immediately in the sidebar (WhatsApp-style — opening a thread clears its unread badge).
    const convoId = convo.orderRequestId || convo.id;
    this.conversations.update(list => list.map(c => {
      const id = c.orderRequestId || c.id;
      return id && convoId && String(id).toLowerCase() === String(convoId).toLowerCase()
        ? { ...c, unreadCount: 0 }
        : c;
    }));
    if (convoId) {
      this.chatUnread.markConversationRead(convoId);
    }

    const targetId = convo.orderRequestId || convo.id;
    if (targetId) {
      this.signalRService.joinOrderRoom(targetId).catch(() => {});
      this.adminService.getConversationMessages(targetId).subscribe({
        next: (msgs: any) => {
          const list = Array.isArray(msgs) ? msgs : (msgs?.items || msgs?.messages || []);
          this.messages.set(list.map((m: any) => {
            const roleLower = String(m.senderRole || '').toLowerCase();
            const isFromAdmin = roleLower.includes('superadmin') || roleLower.includes('admin') || roleLower.includes('partner');
            const isShopkeeper = roleLower.includes('shopkeeper') || roleLower.includes('seller') || roleLower === '2';
            const senderDisplayName = isFromAdmin ? 'Super Admin' : (isShopkeeper ? (convo.shopName || convo.customerName || 'Merchant Store') : (convo.customerName || 'Customer'));
            return {
              id: m.id,
              senderName: senderDisplayName,
              content: m.message || m.content || '',
              createdAt: m.sentAt || m.createdAt || new Date().toISOString(),
              isFromAdmin: isFromAdmin,
              attachmentUrl: m.attachmentUrl || null,
              attachmentFileName: m.attachmentFileName || null,
              attachmentContentType: m.attachmentContentType || null
            };
          }));
          this.shouldScrollToBottom = true;
        },
        error: () => {
          this.messages.set([]);
        }
      });
    }
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

  sendMessage(): void {
    const text = this.newMessage().trim();
    const attachment = this.pendingAttachment();
    const convo = this.activeConversation();
    if ((!text && !attachment) || !convo) return;

    const targetId = convo.orderRequestId || convo.id;
    if (!targetId) return;

    this.sendingMessage.set(true);
    const tempId = `tmp-${Date.now()}`;
    const preview = text || (attachment ? `📎 ${attachment.fileName}` : '');
    this.messages.update(prev => [...prev, {
      id: tempId,
      senderName: 'Super Admin',
      content: text,
      createdAt: new Date().toISOString(),
      isFromAdmin: true,
      attachmentUrl: attachment?.url || null,
      attachmentFileName: attachment?.fileName || null,
      attachmentContentType: attachment?.contentType || null
    }]);
    this.newMessage.set('');
    this.pendingAttachment.set(null);
    this.shouldScrollToBottom = true;

    this.adminService.sendMessage(targetId, text, attachment ? {
      attachmentUrl: attachment.url,
      attachmentFileName: attachment.fileName,
      attachmentContentType: attachment.contentType,
      attachmentSizeBytes: attachment.sizeBytes
    } : null).subscribe({
      next: (msg) => {
        this.sendingMessage.set(false);
        const realId = msg?.messageId ? String(msg.messageId) : tempId;
        this.messages.update(prev => {
          const withoutDupes = prev.filter(m =>
            m.id !== tempId && String(m.id).toLowerCase() !== realId.toLowerCase()
          );
          return [...withoutDupes, {
            id: realId,
            senderName: 'Super Admin',
            content: text,
            createdAt: new Date().toISOString(),
            isFromAdmin: true,
            attachmentUrl: attachment?.url || null,
            attachmentFileName: attachment?.fileName || null,
            attachmentContentType: attachment?.contentType || null
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
}
