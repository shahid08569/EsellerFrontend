import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  NotificationService,
  AppNotificationDto,
  SignalRService,
  ToastService,
  normalizeNotificationPath
} from 'eseller-shared';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.html'
})
export class NotificationBell implements OnInit, OnDestroy {
  private readonly notificationsApi = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly signalR = inject(SignalRService);
  private readonly toast = inject(ToastService);

  readonly isOpen = signal<boolean>(false);
  readonly notifications = signal<AppNotificationDto[]>([]);
  readonly unreadCount = signal<number>(0);

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private unsubHub: (() => void) | null = null;
  private unsubCount: (() => void) | null = null;
  private suppressUntil = 0;

  ngOnInit(): void {
    this.refreshUnread();
    this.pollHandle = setInterval(() => this.refreshUnread(), 30000);

    void this.signalR.startNotificationConnection().catch(() => {});
    this.unsubHub = this.signalR.onReceiveNotification((payload) => {
      if (Date.now() < this.suppressUntil) return;
      this.toast.show(payload.title || 'New notification', 'info');
      this.refreshUnread();
    });
    this.unsubCount = this.signalR.onUnreadCountChanged((count) => {
      if (Date.now() < this.suppressUntil) return;
      this.unreadCount.set(count);
      // Keep dropdown list in sync when chat marks NewMessage notifs read
      if (this.isOpen() || count === 0) {
        this.refreshUnread();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    this.unsubHub?.();
    this.unsubHub = null;
    this.unsubCount?.();
    this.unsubCount = null;
  }

  refreshUnread(): void {
    if (Date.now() < this.suppressUntil) return;
    this.notificationsApi.getNotifications(true, 1, 20).subscribe({
      next: (res) => {
        if (Date.now() < this.suppressUntil) return;
        const items = res?.items || [];
        this.notifications.set(items);
        this.unreadCount.set(res?.totalCount ?? items.length);
      },
      error: () => {}
    });
  }

  toggleOpen(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.refreshUnread();
    }
  }

  close(): void {
    this.isOpen.set(false);
  }

  markRead(notification: AppNotificationDto): void {
    const go = () => this.navigateFor(notification);
    if (notification.isRead) {
      go();
      return;
    }
    this.notificationsApi.markRead(notification.id).subscribe({
      next: () => {
        this.notifications.update((list) => list.filter((n) => n.id !== notification.id));
        this.unreadCount.update((c) => Math.max(0, c - 1));
        go();
      },
      error: () => go()
    });
  }

  markAllRead(): void {
    this.suppressUntil = Date.now() + 3000;
    this.notifications.set([]);
    this.unreadCount.set(0);
    this.notificationsApi.markAllRead().subscribe({
      next: () => {
        this.notifications.set([]);
        this.unreadCount.set(0);
      },
      error: () => {
        this.suppressUntil = 0;
        this.refreshUnread();
      }
    });
  }

  navigateFor(n: AppNotificationDto): void {
    this.close();
    const path = normalizeNotificationPath(
      n.navigationUrl || n.linkPath || this.fallbackPath(n.type),
      'seller'
    );
    if (!path) return;
    if (path.includes('?')) {
      const [route, qs] = path.split('?');
      const queryParams: Record<string, string> = {};
      for (const part of qs.split('&')) {
        const [k, v] = part.split('=');
        if (k) queryParams[k] = decodeURIComponent(v || '');
      }
      void this.router.navigate([route], { queryParams });
    } else {
      void this.router.navigateByUrl(path);
    }
  }

  private fallbackPath(type?: string): string {
    const t = String(type || '').toLowerCase();
    if (t.includes('message') || t.includes('chat')) return '/chat';
    if (t.includes('order') || t.includes('deliver')) return '/orders';
    if (t.includes('product') || t.includes('listing')) return '/products';
    if (t.includes('payment') || t.includes('commission') || t.includes('earning')) return '/earnings';
    if (t.includes('tier') || t.includes('shop')) return '/settings';
    return '/dashboard';
  }
}
