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

  /** Maps canonical conversation ID -> unread count (single source of truth, no double-counting) */
  readonly byConversationId = signal<Record<string, number>>({});

  /** Maps aliases (shopId, participantId, userId) -> canonical conversation ID */
  readonly aliasMap = signal<Record<string, string>>({});

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
    // 1. Direct match by canonical ID
    for (const [k, count] of Object.entries(map)) {
      if (k.toLowerCase() === key) return Number(count) || 0;
    }

    // 2. Check alias map (e.g. shopId, participantId, userId)
    const canonical = this.aliasMap()[key];
    if (canonical) {
      if (this.pendingClears.has(canonical.toLowerCase())) return 0;
      for (const [k, count] of Object.entries(map)) {
        if (k.toLowerCase() === canonical.toLowerCase()) return Number(count) || 0;
      }
    }

    return 0;
  }

  /** Replace map from conversations API (authoritative). */
  applyFromConversations(list: Array<{ orderRequestId?: string; id?: string; unreadCount?: number }>): void {
    const nextConvos: Record<string, number> = {};
    const nextAliases: Record<string, string> = {};

    for (const c of list || []) {
      const canonicalId = String(c.orderRequestId || c.id || '').trim();
      if (!canonicalId) continue;

      const n = Number(c.unreadCount || 0);
      const canonicalKey = canonicalId.toLowerCase();

      if (!this.pendingClears.has(canonicalKey) && n > 0) {
        nextConvos[canonicalId] = n;
      }

      // Record lookup aliases without duplicating unread count totals
      const otherIds = [
        String((c as any).participantId || '').trim(),
        String((c as any).shopId || '').trim(),
        String((c as any).userId || '').trim()
      ].filter(Boolean);

      for (const alt of otherIds) {
        nextAliases[alt.toLowerCase()] = canonicalId;
      }
    }

    this.aliasMap.set(nextAliases);
    this.byConversationId.set(nextConvos);
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
              this.aliasMap.set({});
              return;
            }
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
    const canonicalId = this.aliasMap()[key] || conversationId;
    this.pendingClears.delete(canonicalId.toLowerCase());

    this.byConversationId.update((map) => {
      const existingKey = Object.keys(map).find((k) => k.toLowerCase() === canonicalId.toLowerCase()) || canonicalId;
      return { ...map, [existingKey]: (Number(map[existingKey]) || 0) + by };
    });
  }

  /** Optimistic clear + API mark-read + refresh. */
  markConversationRead(conversationId: string): void {
    if (!conversationId) return;
    const key = conversationId.toLowerCase();
    const canonicalId = this.aliasMap()[key] || conversationId;

    this.pendingClears.add(key);
    this.pendingClears.add(canonicalId.toLowerCase());

    this.byConversationId.update((map) => {
      const next = { ...map };
      for (const k of Object.keys(next)) {
        if (
          k.toLowerCase() === key ||
          k.toLowerCase() === canonicalId.toLowerCase() ||
          k === '__total__'
        ) {
          delete next[k];
        }
      }
      return next;
    });

    this.chatService.markConversationAsRead(canonicalId).subscribe({
      next: () => {
        this.pendingClears.delete(key);
        this.pendingClears.delete(canonicalId.toLowerCase());
        this.refresh();
      },
      error: () => {
        this.pendingClears.delete(key);
        this.pendingClears.delete(canonicalId.toLowerCase());
        this.refresh();
      }
    });
  }
}
