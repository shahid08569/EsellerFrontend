import { Injectable, OnDestroy, inject, signal, computed } from '@angular/core';
import { ChatService } from 'eseller-shared';
import { AdminService } from './admin.service';

/**
 * Shared WhatsApp-style unread state for Management:
 * - total badge (sidebar Live Chat + floating FAB)
 * - per-conversation counts (inbox list + widget directory)
 */
@Injectable({ providedIn: 'root' })
export class AdminChatUnreadService implements OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly adminService = inject(AdminService);

  readonly byConversationId = signal<Record<string, number>>({});
  readonly totalUnread = computed(() =>
    Object.values(this.byConversationId()).reduce((sum, n) => sum + (Number(n) || 0), 0)
  );

  private started = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  /** Ids cleared locally while mark-read API is in flight (poll must not resurrect them). */
  private readonly pendingClears = new Set<string>();

  /** Call once from admin layout. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.refresh();
    this.pollTimer = setInterval(() => this.refresh(), 10000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  unreadFor(conversationId: string | null | undefined): number {
    if (!conversationId) return 0;
    const key = conversationId.toLowerCase();
    if (this.pendingClears.has(key)) return 0;
    const map = this.byConversationId();
    const hit = Object.entries(map).find(([k]) => k.toLowerCase() === key);
    return hit ? Number(hit[1]) || 0 : 0;
  }

  /** Replace map from conversations API (authoritative). */
  applyFromConversations(list: Array<{ orderRequestId?: string; id?: string; unreadCount?: number }>): void {
    const next: Record<string, number> = {};
    for (const c of list || []) {
      const id = String(c.orderRequestId || c.id || '').trim();
      if (!id) continue;
      const key = id.toLowerCase();
      if (this.pendingClears.has(key)) continue;
      const n = Number(c.unreadCount || 0);
      if (n > 0) next[id] = n;
    }
    this.byConversationId.set(next);
  }

  refresh(): void {
    this.adminService.getConversations(1, 500).subscribe({
      next: (list) => this.applyFromConversations(list),
      error: () => {
        // Fallback: total-only API
        this.chatService.getUnreadCount().subscribe({
          next: (res) => {
            const n = Number(res?.unreadCount || 0);
            if (n <= 0) {
              this.byConversationId.set({});
              return;
            }
            // Keep existing per-id map if present; only seed a synthetic total bucket when empty
            if (Object.keys(this.byConversationId()).length === 0) {
              this.byConversationId.set({ __total__: n });
            }
          },
          error: () => {}
        });
      }
    });
  }

  bump(conversationId: string, by = 1): void {
    if (!conversationId || by <= 0) return;
    const key = conversationId.toLowerCase();
    this.pendingClears.delete(key);
    this.byConversationId.update((map) => {
      const existing = Object.keys(map).find((k) => k.toLowerCase() === key) || conversationId;
      return { ...map, [existing]: (Number(map[existing]) || 0) + by };
    });
  }

  /** Optimistic clear + API mark-read + refresh. */
  markConversationRead(conversationId: string): void {
    if (!conversationId) return;
    const key = conversationId.toLowerCase();
    this.pendingClears.add(key);
    this.byConversationId.update((map) => {
      const next = { ...map };
      for (const k of Object.keys(next)) {
        if (k.toLowerCase() === key || k === '__total__') {
          delete next[k];
        }
      }
      return next;
    });
    this.chatService.markConversationAsRead(conversationId).subscribe({
      next: () => {
        this.pendingClears.delete(key);
        this.refresh();
      },
      error: () => {
        this.pendingClears.delete(key);
        this.refresh();
      }
    });
  }
}
