import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthStore, AuthService, ToastService } from 'eseller-shared';
import { AdminService } from '../../core/services/admin.service';
import { filter } from 'rxjs/operators';
import { AdminChatWidget } from '../../shared/components/admin-chat-widget/admin-chat-widget';
import { NotificationBell } from '../../shared/components/notification-bell/notification-bell';
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
  readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly customerUrl = environment.customerUrl;
  readonly sellerUrl = environment.sellerUrl;

  readonly mobileMenuOpen = signal<boolean>(false);
  readonly desktopSidebarCollapsed = signal<boolean>(false);
  readonly pendingShopsCount = signal<number>(0);
  readonly totalShopsCount = signal<number>(0);
  readonly pendingProductsCount = signal<number>(0);

  // Active accordion dropdowns: multi-open supported so opening one doesn't auto-close another
  readonly openDropdowns = signal<Record<string, boolean>>({
    dashboard: true,
    shops: false,
    products: false,
    catalog: false,
    homepage: false,
    users: false,
    finance: false
  });

  ngOnInit(): void {
    this.refreshBadges();
    this.autoExpandActiveDropdown(this.router.url);

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.autoExpandActiveDropdown(e.urlAfterRedirects || e.url);
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

  isProductNav(status: 'all' | 'pending' | 'approved' | 'rejected'): boolean {
    const url = this.router.url || '';
    if (!url.startsWith('/products')) return false;
    if (status === 'all') {
      return !url.includes('status=') || url.includes('status=all');
    }
    return url.includes(`status=${status}`);
  }

  private autoExpandActiveDropdown(url: string): void {
    if (url.startsWith('/dashboard')) {
      this.openDropdowns.update(c => ({ ...c, dashboard: true }));
    } else if (url.startsWith('/shops')) {
      this.openDropdowns.update(c => ({ ...c, shops: true }));
    } else if (url.startsWith('/products')) {
      this.openDropdowns.update(c => ({ ...c, products: true }));
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

  refreshBadges(): void {
    this.adminService.getShopkeepers().subscribe({
      next: (list) => {
        const pending = (list || []).filter(s => s.status?.toLowerCase() === 'pending');
        this.pendingShopsCount.set(pending.length);
      },
      error: () => {}
    });

    this.adminService.getShops(1, 1).subscribe({
      next: (res) => {
        this.totalShopsCount.set(res?.totalCount || 0);
      },
      error: () => {}
    });

    this.adminService.getPendingProducts(1, 1).subscribe({
      next: (res) => {
        this.pendingProductsCount.set(res?.totalCount || 0);
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
