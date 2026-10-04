import { Component, inject, signal, computed, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthStore, AuthService, ToastService, SignalRService } from 'eseller-shared';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { TierModal } from '../../shared/components/tier-modal/tier-modal';
import { AdminChatWidget } from '../../shared/components/admin-chat-widget/admin-chat-widget';
import { NotificationBell } from '../../shared/components/notification-bell/notification-bell';
import { filter } from 'rxjs/operators';
import { SellerService, ShopDto } from '../../core/services/seller.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ConfirmModal, TierModal, AdminChatWidget, NotificationBell],
  templateUrl: './main-layout.html'
})
export class MainLayout implements OnInit, OnDestroy {
  readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly sellerService = inject(SellerService);
  private readonly toast = inject(ToastService);
  private readonly signalR = inject(SignalRService);

  readonly shop = signal<ShopDto | null>(null);
  readonly isSidebarOpen = signal<boolean>(true);
  readonly isMobile = signal<boolean>(false);
  readonly showLogoutModal = signal<boolean>(false);
  readonly dismissWarning = signal<boolean>(false);
  readonly isTierModalOpen = signal<boolean>(false);

  private unsubNotification: (() => void) | null = null;

  readonly showPendingBanner = computed(
    () => !!this.shop() && !this.shop()!.isApproved && !this.dismissWarning()
  );

  // Dark Mode Toggle
  readonly isDarkMode = signal<boolean>(false);

  private previousIsMobile: boolean | null = null;

  readonly sidebarClass = computed(() => {
    const open = this.isSidebarOpen();
    const mobile = this.isMobile();
    const base = 'bg-slate-950 text-white flex flex-col shrink-0 transition-all duration-300 ease-in-out shadow-2xl z-50 fixed inset-y-0 left-0 lg:static overflow-hidden';

    if (mobile) {
      return `${base} w-72 max-w-[85vw] ${open ? 'translate-x-0' : '-translate-x-full'}`;
    } else {
      return `${base} ${open ? 'w-64 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full lg:translate-x-0 pointer-events-none'}`;
    }
  });

  ngOnInit() {
    this.checkScreenSize();
    this.loadShopInfo();
    this.connectNotifications();

    // Check saved theme preference
    if (typeof localStorage !== 'undefined') {
      const savedTheme = localStorage.getItem('seller_theme_dark');
      if (savedTheme === 'true') {
        this.isDarkMode.set(true);
      }
    }

    // Auto close sidebar on mobile when navigating to another route
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      if (this.isMobile()) {
        this.isSidebarOpen.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubNotification?.();
    this.unsubNotification = null;
    void this.signalR.stopNotificationConnection();
  }

  private connectNotifications(): void {
    void this.signalR.startNotificationConnection().catch(() => {
      // Polling bell still works if hub URL is unavailable
    });

    this.unsubNotification = this.signalR.onReceiveNotification((payload) => {
      // 6 = ShopApproved, 7 = ShopRejected
      if (payload.type === 6) {
        this.toast.show(payload.message || 'Your store has been verified!', 'success');
        this.dismissWarning.set(false);
        this.loadShopInfo();
      } else if (payload.type === 7) {
        this.toast.show(payload.message || 'Your store verification was rejected.', 'error');
        this.loadShopInfo();
      } else {
        this.toast.show(payload.title || 'New notification', 'info');
      }
    });
  }

  dismissPendingBanner(): void {
    this.dismissWarning.set(true);
  }

  contactSupportFromBanner(): void {
    void this.router.navigateByUrl('/chat');
  }

  toggleTheme() {
    this.isDarkMode.update(v => !v);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('seller_theme_dark', String(this.isDarkMode()));
    }
  }

  loadShopInfo() {
    this.sellerService.getMyShop().subscribe({
      next: (s) => {
        this.shop.set(s);
      },
      error: () => {}
    });
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    if (typeof window !== 'undefined') {
      const mobile = window.innerWidth < 1024;
      this.isMobile.set(mobile);
      if (this.previousIsMobile === null || this.previousIsMobile !== mobile) {
        this.previousIsMobile = mobile;
        this.isSidebarOpen.set(!mobile);
      }
    }
  }

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  closeSidebarOnMobile() {
    if (this.isMobile()) {
      this.isSidebarOpen.set(false);
    }
  }

  openTierModal() {
    this.isTierModalOpen.set(true);
  }

  closeTierModal() {
    this.isTierModalOpen.set(false);
  }

  onTierRequested(data: { tier: string; price: number; note: string; receiptUrl?: string }) {
    this.sellerService.requestTierUpgrade({
      requestedTier: data.tier,
      price: data.price,
      referenceNote: data.note,
      paymentMethod: data.price === 0 ? 'Free Default' : 'Online Merchant Transfer',
      receiptUrl: data.receiptUrl || null
    }).subscribe({
      next: (res) => {
        this.toast.show(
          res?.message || `Tier Upgrade request for ${data.tier} (${data.price === 0 ? 'Free' : '$' + data.price}) submitted to Super Admin!`,
          'success'
        );
      },
      error: (err) => {
        this.toast.show(err?.error?.error || 'Failed to submit tier upgrade request.', 'error');
      }
    });
  }

  promptLogout() {
    this.showLogoutModal.set(true);
  }

  cancelLogout() {
    this.showLogoutModal.set(false);
  }

  confirmLogout() {
    this.showLogoutModal.set(false);
    this.authService.logout().subscribe({
      next: () => {
        this.authStore.clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = 'http://localhost:4200/auth/login?logout=true';
        }
      },
      error: () => {
        this.authStore.clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = 'http://localhost:4200/auth/login?logout=true';
        }
      }
    });
  }
}
