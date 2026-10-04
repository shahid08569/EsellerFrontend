import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DashboardService, DashboardNotificationDto, SignalRService, ToastService } from 'eseller-shared';

/**
 * Header notification bell: polls unread + listens to NotificationHub for realtime pushes.
 */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.html'
})
export class NotificationBell implements OnInit, OnDestroy {
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly signalR = inject(SignalRService);
  private readonly toast = inject(ToastService);

  readonly isOpen = signal<boolean>(false);
  readonly notifications = signal<DashboardNotificationDto[]>([]);
  readonly unreadCount = signal<number>(0);
  readonly isLoading = signal<boolean>(false);

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private unsubHub: (() => void) | null = null;

  ngOnInit(): void {
    this.refreshUnread();
    this.pollHandle = setInterval(() => this.refreshUnread(), 10000);

    void this.signalR.startNotificationConnection().catch(() => {});
    this.unsubHub = this.signalR.onReceiveNotification((payload) => {
      this.toast.show(payload.title || 'New notification', 'info');
      this.refreshUnread();
    });
  }

  ngOnDestroy(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    this.unsubHub?.();
    this.unsubHub = null;
  }

  refreshUnread(): void {
    this.dashboardService.getNotifications(true, 1, 20).subscribe({
      next: (res) => {
        const items = res?.items || [];
        this.notifications.set(items);
        this.unreadCount.set(res?.totalCount ?? items.length);
      },
      error: () => {}
    });
  }

  toggleOpen(): void {
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.refreshUnread();
    }
  }

  close(): void {
    this.isOpen.set(false);
  }

  markRead(notification: DashboardNotificationDto): void {
    const openChat = String(notification.type || '').toLowerCase().includes('chat');
    if (notification.isRead) {
      if (openChat) this.goToChat();
      return;
    }
    this.dashboardService.markNotificationRead(notification.id).subscribe({
      next: () => {
        this.notifications.update(list => list.filter(n => n.id !== notification.id));
        this.unreadCount.update(c => Math.max(0, c - 1));
        if (openChat) this.goToChat();
      },
      error: () => {
        if (openChat) this.goToChat();
      }
    });
  }

  markAllRead(): void {
    this.dashboardService.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.set([]);
        this.unreadCount.set(0);
      },
      error: () => {}
    });
  }

  goToChat(): void {
    this.close();
    this.router.navigate(['/chat']);
  }
}
