import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthStore, AuthService, ToastService } from 'eseller-shared';
import { AdminService } from '../../core/services/admin.service';
import { filter } from 'rxjs/operators';
import { AdminChatWidget } from '../../shared/components/admin-chat-widget/admin-chat-widget';
import { NotificationBell } from '../../shared/components/notification-bell/notification-bell';
import { AdminChatUnreadService } from '../../core/services/admin-chat-unread.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AdminChatWidget, NotificationBell],
  templateUrl: './admin-layout.html'
})
export class AdminLayout implements OnInit {
  readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdminService);
  readonly chatUnread = inject(AdminChatUnreadService);
  readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly customerUrl = environment.customerUrl;
  readonly sellerUrl = environment.sellerUrl;
  readonly customerPortalUrl = environment.customerPortalUrl;

  readonly mobileMenuOpen = signal<boolean>(false);
  readonly desktopSidebarCollapsed = signal<boolean>(false);

  /** NEW / unread-style counts only — used for nav badges */
  readonly pendingShopsCount = signal<number>(0);
  readonly pendingTierCount = signal<number>(0);
  readonly pendingProductsCount = signal<number>(0);
  readonly pendingGlobalCount = signal<number>(0);
  readonly pendingOwnCount = signal<number>(0);
  readonly pendingOrdersCount = signal<number>(0);
  readonly pendingReviewsCount = signal<number>(0);
  readonly pendingCustomersCount = signal<number>(0);
  readonly pendingSellersCount = signal<number>(0);
  readonly pendingWithdrawalsCount = signal<number>(0);

  /** Full totals for pages / reference (not shown as nav badges) */
  readonly totalShopsCount = signal<number>(0);

  readonly usersNewCount = computed(
    () => this.pendingCustomersCount() + this.pendingSellersCount() + this.pendingShopsCount()
  );
  readonly shopsNewCount = computed(
    () => this.pendingShopsCount() + this.pendingTierCount()
  );
  readonly financeNewCount = computed(() => this.pendingWithdrawalsCount());

  /** Tracks full URL (incl. query) so sidebar active styles update on tab/view changes */
  readonly currentUrl = signal<string>('');

  /** Compact nav badge: exact under 100, else 100+ — NEW items only */
  formatNavBadge(count: number): string {
    const n = Number(count) || 0;
    if (n <= 0) return '';
    return n > 100 ? '100+' : String(n);
  }

  // Active accordion dropdowns: multi-open supported so opening one doesn't auto-close another
  readonly openDropdowns = signal<Record<string, boolean>>({
    dashboard: true,
    shops: false,
    products: false,
    orders: false,
    catalog: false,
    homepage: false,
    users: false,
    finance: false
  });

  ngOnInit(): void {
    this.refreshBadges();
    this.chatUnread.start();
    this.currentUrl.set(this.router.url || '');
    this.autoExpandActiveDropdown(this.router.url);

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      const url = e.urlAfterRedirects || e.url || '';
      this.currentUrl.set(url);
      this.autoExpandActiveDropdown(url);
      this.mobileMenuOpen.set(false);
    });
  }

  toggleDesktopSidebar(): void {
    this.desktopSidebarCollapsed.update(v => !v);
  }

  toggleDropdown(name: string): void {
    this.openDropdowns.update(curr => ({
      ...curr,
      [name]: !curr[name]
    }));
  }

  isDropdownOpen(name: string): boolean {
    return !!this.openDropdowns()[name];
  }

  isDashboardActive(): boolean {
    return this.router.url.startsWith('/dashboard');
  }

  isProductNav(item: 'all' | 'listing' | 'own-req' | 'live' | 'rejected'): boolean {
    const url = this.currentUrl() || this.router.url || '';
    if (!url.startsWith('/products')) return false;

    const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
    const params = new URLSearchParams(q);
    let status = (params.get('status') || 'all').toLowerCase();
    const kind = (params.get('kind') || '').toLowerCase();
    const tab = (params.get('tab') || 'pending').toLowerCase();

    if (status === 'pending') {
      status = kind === 'own' || kind === 'seller' || kind === 'new' ? 'own-req' : 'listing';
    } else if (status === 'approved') {
      status = 'live';
    }

    switch (item) {
      case 'all':
        return status === 'all';
      case 'listing':
        return status === 'listing';
      case 'own-req':
        return status === 'own-req';
      case 'live':
        return status === 'live';
      case 'rejected':
        return status === 'rejected';
      default:
        return false;
    }
  }

  isOrderNav(item: 'list' | 'create'): boolean {
    const url = this.currentUrl() || this.router.url || '';
    if (!url.startsWith('/orders')) return false;
    const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
    const params = new URLSearchParams(q);
    const action = (params.get('action') || '').toLowerCase();
    if (item === 'create') return action === 'create';
    return action !== 'create';
  }

  /** Shop Management submenu — match by view (+ tab for applications). */
  isShopNav(item: 'pending' | 'stores' | 'tiers' | 'all'): boolean {
    const url = this.currentUrl() || this.router.url || '';
    if (!url.startsWith('/shops')) return false;

    const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
    const params = new URLSearchParams(q);
    const view = (params.get('view') || '').toLowerCase();
    const tab = (params.get('tab') || '').toLowerCase();

    if (item === 'tiers') return view === 'tiers';
    if (item === 'stores') return view === 'stores' || (!view && !tab);
    if (item === 'pending') {
      return view === 'applications' && (tab === 'pending' || tab === '');
    }
    if (item === 'all') {
      return view === 'applications' && (tab === 'all' || tab === 'approved' || tab === 'rejected');
    }
    return false;
  }

  private autoExpandActiveDropdown(url: string): void {
    if (url.startsWith('/dashboard')) {
      this.openDropdowns.update(c => ({ ...c, dashboard: true }));
    } else if (url.startsWith('/shops')) {
      this.openDropdowns.update(c => ({ ...c, shops: true }));
    } else if (url.startsWith('/products')) {
      this.openDropdowns.update(c => ({ ...c, products: true }));
    } else if (url.startsWith('/orders')) {
      this.openDropdowns.update(c => ({ ...c, orders: true }));
    } else if (url.startsWith('/categories') || url.startsWith('/brands') || url.startsWith('/promotions')) {
      this.openDropdowns.update(c => ({ ...c, catalog: true }));
    } else if (url.startsWith('/homepage')) {
      this.openDropdowns.update(c => ({ ...c, homepage: true }));
    } else if (url.startsWith('/users') || url.startsWith('/partners') || url.startsWith('/affiliates') || url.startsWith('/customers') || url.startsWith('/sellers')) {
      this.openDropdowns.update(c => ({ ...c, users: true }));
    } else if (url.startsWith('/finance') || url.startsWith('/reports') || url.startsWith('/audit-logs')) {
      this.openDropdowns.update(c => ({ ...c, finance: true }));
    }
  }

  /** Load NEW-item badge counts only (pending / unread). Totals belong on pages. */
  refreshBadges(): void {
    this.adminService.getPlatformDashboard().subscribe({
      next: (d) => {
        if (!d) return;
        this.pendingShopsCount.set(d.pendingShops || 0);
        this.pendingProductsCount.set(d.pendingProducts || 0);
        this.pendingOrdersCount.set(d.pendingOrders || d.newOrders || 0);
        this.pendingWithdrawalsCount.set(d.pendingWithdrawals || 0);
        this.totalShopsCount.set(d.totalShops || d.activeShops || 0);
      },
      error: () => {}
    });

    this.adminService.getShopkeepers().subscribe({
      next: (list) => {
        const pending = (list || []).filter(s => String(s.status || '').toLowerCase() === 'pending');
        this.pendingShopsCount.set(pending.length);
        this.pendingSellersCount.set(pending.length);
      },
      error: () => {}
    });

    this.adminService.getShops(1, 1).subscribe({
      next: (res) => this.totalShopsCount.set(res?.totalCount || 0),
      error: () => {}
    });

    this.adminService.getPendingProducts(1, 1, 'global').subscribe({
      next: (res) => {
        this.pendingGlobalCount.set(res?.totalCount || 0);
        this.pendingProductsCount.set((res?.totalCount || 0) + this.pendingOwnCount());
      },
      error: () => {}
    });
    this.adminService.getPendingProducts(1, 1, 'own').subscribe({
      next: (res) => {
        this.pendingOwnCount.set(res?.totalCount || 0);
        this.pendingProductsCount.set(this.pendingGlobalCount() + (res?.totalCount || 0));
      },
      error: () => {}
    });

    this.adminService.getOrders(1, 1, 'pending').subscribe({
      next: (res) => this.pendingOrdersCount.set(res?.totalCount || 0),
      error: () => {}
    });

    this.adminService.getReviews('pending', 1, 1).subscribe({
      next: (res) => this.pendingReviewsCount.set(res?.totalCount || 0),
      error: () => {}
    });

    this.adminService.getTierUpgradeRequests().subscribe({
      next: (list) => {
        const pending = (list || []).filter((r: any) => {
          const s = String(r?.status || r?.Status || '').toLowerCase();
          return s === 'pending' || s === '1' || s === '';
        });
        this.pendingTierCount.set(pending.length);
      },
      error: () => {}
    });

    this.adminService.getCustomers(1, 200).subscribe({
      next: (res) => {
        const items = res?.items || (Array.isArray(res) ? res : []);
        const pending = items.filter((c: any) => String(c.status || '').toLowerCase() === 'pending');
        this.pendingCustomersCount.set(pending.length);
      },
      error: () => {}
    });
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }

  readonly logoutModalOpen = signal<boolean>(false);

  openLogoutModal(): void {
    this.logoutModalOpen.set(true);
  }

  cancelLogout(): void {
    this.logoutModalOpen.set(false);
  }

  confirmLogout(): void {
    this.logoutModalOpen.set(false);
    const loginUrl = `${environment.customerUrl}/auth/login?logout=true`;
    this.authService.logout().subscribe({
      next: () => {
        this.authStore.clearAuth();
        this.toast.show('Signed out successfully.', 'info');
        window.location.href = loginUrl;
      },
      error: () => {
        this.authStore.clearAuth();
        window.location.href = loginUrl;
      }
    });
  }

  logout(): void {
    this.openLogoutModal();
  }
}
