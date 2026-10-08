import { Component, inject, signal, computed, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthStore, AuthService, ToastService } from 'eseller-shared';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { TierModal } from '../../shared/components/tier-modal/tier-modal';
import { AdminChatWidget } from '../../shared/components/admin-chat-widget/admin-chat-widget';
import { NotificationBell } from '../../shared/components/notification-bell/notification-bell';
import { filter } from 'rxjs/operators';
import { SellerService, ShopDto } from '../../core/services/seller.service';
import { ImageUrlPipe } from '../../shared/pipes/image-url.pipe';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ConfirmModal, TierModal, AdminChatWidget, NotificationBell, ImageUrlPipe],
  templateUrl: './main-layout.html'
})
export class MainLayout implements OnInit, OnDestroy {
  readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly sellerService = inject(SellerService);
  private readonly toast = inject(ToastService);

  readonly shop = signal<ShopDto | null>(null);
  readonly isSidebarOpen = signal<boolean>(true);
  readonly isMobile = signal<boolean>(false);
  readonly showLogoutModal = signal<boolean>(false);
  readonly dismissWarning = signal<boolean>(false);
  readonly isTierModalOpen = signal<boolean>(false);
  readonly packagesMenuOpen = signal<boolean>(false);
  /** NEW / pending counts for nav badges only */
  readonly pendingProductsCount = signal<number>(0);
  readonly pendingOrdersCount = signal<number>(0);
  /** Full totals for pages */
  readonly productsCount = signal<number>(0);
  readonly ordersCount = signal<number>(0);

  /** Compact nav badge: exact under 100, else 100+ — NEW items only */
  formatNavBadge(count: number): string {
    const n = Number(count) || 0;
    if (n <= 0) return '';
    return n > 100 ? '100+' : String(n);
  }

  readonly showPendingBanner = computed(
    () => !!this.shop() && !this.shop()!.isApproved && !this.dismissWarning()
  );

  readonly headerTierLabel = computed(() => {
    const raw = String(this.shop()?.tierName || this.shop()?.badgeText || 'Bronze').trim();
    const lower = raw.toLowerCase();
    if (lower.includes('diamond')) return 'Diamond';
    if (lower.includes('gold')) return 'Gold';
    if (lower.includes('bronze')) return 'Bronze';
    if (lower.includes('silver')) return 'Silver';
    if (lower.includes('platinum') || lower.includes('platnium')) return 'Platinum';
    const first = raw.split(/[\s($/]/).find((w) => w.length > 0);
    return first || 'Bronze';
  });

  readonly headerTierStyles = computed(() => {
    const label = this.headerTierLabel().toLowerCase();
    if (label.includes('diamond')) return { bg: '#ECFEFF', color: '#0E7490', border: '#A5F3FC' };
    if (label.includes('gold')) return { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' };
    if (label.includes('platinum')) return { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' };
    if (label.includes('silver')) return { bg: '#F1F5F9', color: '#334155', border: '#CBD5E1' };
    return { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' };
  });

  readonly headerRating = computed(() => {
    const r = Number(this.shop()?.rating ?? 0);
    if (!Number.isFinite(r) || r < 0) return 0;
    return Math.min(5, Math.round(r * 10) / 10);
  });

  // Dark Mode Toggle
  readonly isDarkMode = signal<boolean>(false);

  private previousIsMobile: boolean | null = null;

  /** Always viewport-fixed so sidebar never scrolls away (same pattern as SuperAdmin). */
  readonly sidebarClass = computed(() => {
    const open = this.isSidebarOpen();
    const mobile = this.isMobile();
    const base =
      'bg-slate-950 text-white flex flex-col shrink-0 transition-all duration-300 ease-in-out shadow-2xl z-50 fixed inset-y-0 left-0 overflow-hidden';

    if (mobile) {
      return `${base} w-72 max-w-[85vw] ${open ? 'translate-x-0' : '-translate-x-full'}`;
    }
    return `${base} ${open ? 'w-64 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full pointer-events-none border-0'}`;
  });

  ngOnInit() {
    this.checkScreenSize();
    this.loadShopInfo();
    this.refreshNavCounts();

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

  refreshNavCounts(): void {
    this.sellerService.getMyProducts(1, 200).subscribe({
      next: (res) => {
        const items = res?.items || [];
        this.productsCount.set(res?.totalCount ?? items.length);
        const pending = items.filter((p: any) =>
          !p.isApproved && !p.rejectionReason && !p.sourceProductId
        );
        this.pendingProductsCount.set(pending.length);
      },
      error: () => {}
    });
    this.sellerService.getSellerOrders(1, 200).subscribe({
      next: (res) => {
        const items = res?.items || [];
        this.ordersCount.set(res?.totalCount ?? items.length);
        const pending = items.filter((o: any) => {
          const s = String(o.status || '').toLowerCase();
          return s === 'pending' || s === '1';
        });
        this.pendingOrdersCount.set(pending.length);
      },
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    // Notification hub lifecycle is owned by NotificationBell
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
    this.packagesMenuOpen.set(false);
    this.isTierModalOpen.set(true);
  }

  closeTierModal() {
    this.isTierModalOpen.set(false);
  }

  togglePackagesMenu(): void {
    this.packagesMenuOpen.update(v => !v);
  }

  openShopUpgrade(): void {
    this.openTierModal();
    this.closeSidebarOnMobile();
  }

  onTierRequested(data: { tier: string; price: number; note: string; receiptUrl?: string; categoryId?: string }) {
    this.sellerService.requestTierUpgrade({
      requestedTier: data.tier,
      price: data.price,
      referenceNote: data.note,
      paymentMethod: data.price === 0 ? 'Free Default' : 'Online Merchant Transfer',
      receiptUrl: data.receiptUrl || null,
      requestedCategoryId: data.categoryId || null
    }).subscribe({
      next: (res) => {
        this.toast.show(
          res?.message || `Tier Upgrade request for ${data.tier} (${data.price === 0 ? 'Free' : '$' + data.price}) submitted to Management!`,
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
    const loginUrl = `${environment.customerUrl}/auth/login?logout=true`;
    this.authService.logout().subscribe({
      next: () => {
        this.authStore.clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = loginUrl;
        }
      },
      error: () => {
        this.authStore.clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = loginUrl;
        }
      }
    });
  }
}
