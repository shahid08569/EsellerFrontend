import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastService, AuthStore } from 'eseller-shared';
import { AdminService } from '../../core/services/admin.service';
import {
  AdminShopkeeperDto,
  AdminShopDto,
  AdminProductDto,
  PlatformDashboardDto
} from '../../core/models/admin.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './dashboard.html'
})
export class Dashboard implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);
  readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Active View: 'dashboard' (Screenshot Design) | 'operations' (Moderation & Queues)
  readonly activeView = signal<'dashboard' | 'operations'>('dashboard');

  readonly isLoading = signal<boolean>(true);
  readonly platformStats = signal<PlatformDashboardDto | null>(null);
  readonly totalShops = signal<number>(0);
  readonly pendingShops = signal<AdminShopkeeperDto[]>([]);
  readonly totalProducts = signal<number>(0);
  readonly pendingProducts = signal<AdminProductDto[]>([]);

  // Filterable list panels (replaced graphs)
  readonly revenueMonthsFilter = signal<number>(9);
  readonly weeklyFilter = signal<'this' | 'busy' | 'quiet'>('this');
  readonly lowStockMin = signal<number>(5);

  readonly filteredMonthlyRevenue = computed(() => {
    const list = this.platformStats()?.monthlyRevenue || [];
    const take = this.revenueMonthsFilter();
    return list.slice(-take).map(r => ({
      month: r.month,
      revenue: r.revenue,
      growthPercent: r.growthPercent ?? 0
    }));
  });

  readonly filteredWeeklyOrders = computed(() => {
    const rows = (this.platformStats()?.weeklyOrders || []).map(w => ({
      day: w.day,
      orders: w.orders
    }));

    const mode = this.weeklyFilter();
    if (mode === 'busy') return rows.filter(r => r.orders >= 10);
    if (mode === 'quiet') return rows.filter(r => r.orders < 10);
    return rows;
  });

  readonly dynamicLowStockItems = computed(() => {
    const min = this.lowStockMin();
    const alerts = this.platformStats()?.lowStockAlerts || [];
    return alerts
      .filter(a => a.stock <= min)
      .map(a => ({
        name: a.name,
        code: a.sku,
        category: a.categoryName,
        left: a.stock,
        imageUrl: a.imageUrl || null
      }));
  });

  formatMoney(amount: number): string {
    const n = Number(amount) || 0;
    if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
    return `$${n.toLocaleString('en-US')}`;
  }

  formatImageUrl(url: string | null | undefined): string {
    return this.adminService.formatImageUrl(url);
  }

  onImgError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.style.display = 'none';
      const fallback = target.nextElementSibling as HTMLElement;
      if (fallback) fallback.style.display = 'flex';
    }
  }

  // Action states
  readonly actionInProgress = signal<string | null>(null);

  // Approve Modal state (Points 4 & 5)
  readonly approveModalOpen = signal<boolean>(false);
  readonly approveTarget = signal<{ type: 'shop' | 'product'; id: string; name: string; item: any } | null>(null);

  // Reject Modal state
  readonly rejectModalOpen = signal<boolean>(false);
  readonly rejectTarget = signal<{ type: 'shop' | 'product'; id: string; name: string } | null>(null);
  readonly rejectReason = signal<string>('');

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const v = params['view'];
      if (v === 'operations' || v === 'overview') {
        this.activeView.set('operations');
      } else {
        this.activeView.set('dashboard');
      }
    });
    this.loadData();
  }

  switchDashboardView(view: 'dashboard' | 'operations'): void {
    this.activeView.set(view);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view },
      queryParamsHandling: 'merge'
    });
  }

  openApproveModal(type: 'shop' | 'product', id: string, name: string, item: any): void {
    this.approveTarget.set({ type, id, name, item });
    this.approveModalOpen.set(true);
  }

  closeApproveModal(): void {
    this.approveModalOpen.set(false);
    this.approveTarget.set(null);
  }

  confirmApprove(): void {
    const target = this.approveTarget();
    if (!target) return;
    this.closeApproveModal();
    if (target.type === 'shop') {
      this.approveShop(target.item);
    } else {
      this.approveProduct(target.item);
    }
  }

  loadData(): void {
    this.isLoading.set(true);

    // Fetch complete platform dashboard statistics
    this.adminService.getPlatformDashboard().subscribe({
      next: (stats) => {
        this.platformStats.set(stats);
      },
      error: () => {}
    });

    // Fetch pending shopkeepers
    this.adminService.getShopkeepers().subscribe({
      next: (list) => {
        const pending = (list || []).filter(s => s.status === 'Pending');
        this.pendingShops.set(pending);
      },
      error: () => {}
    });

    // Fetch total active shops count
    this.adminService.getShops(1, 1).subscribe({
      next: (res) => {
        this.totalShops.set(res?.totalCount || 0);
      },
      error: () => {}
    });

    // Fetch pending products
    this.adminService.getPendingProducts(1, 10).subscribe({
      next: (res) => {
        this.pendingProducts.set(res?.items || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });

    // Fetch total products count
    this.adminService.getProducts(undefined, undefined, 1, 1).subscribe({
      next: (res) => {
        this.totalProducts.set(res?.totalCount || 0);
      },
      error: () => {}
    });
  }

  // Approve Shopkeeper
  approveShop(shop: AdminShopkeeperDto): void {
    this.actionInProgress.set(shop.id);
    this.adminService.approveShopkeeper(shop.id).subscribe({
      next: () => {
        this.toast.show(`Shop "${shop.storeName}" has been approved!`, 'success');
        this.actionInProgress.set(null);
        this.loadData();
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to approve shop.', 'error');
      }
    });
  }

  // Approve Product
  approveProduct(product: AdminProductDto): void {
    this.actionInProgress.set(product.id);
    this.adminService.approveProduct(product.id).subscribe({
      next: () => {
        this.toast.show(`Product "${product.name}" has been approved!`, 'success');
        this.actionInProgress.set(null);
        this.loadData();
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to approve product.', 'error');
      }
    });
  }

  // Open Reject Modal
  openRejectModal(type: 'shop' | 'product', id: string, name: string): void {
    this.rejectTarget.set({ type, id, name });
    this.rejectReason.set('');
    this.rejectModalOpen.set(true);
  }

  closeRejectModal(): void {
    this.rejectModalOpen.set(false);
    this.rejectTarget.set(null);
    this.rejectReason.set('');
  }

  confirmReject(): void {
    const target = this.rejectTarget();
    const reason = this.rejectReason().trim();

    if (!target) return;
    if (!reason) {
      this.toast.show('Please provide a reason for rejection.', 'error');
      return;
    }

    this.actionInProgress.set(target.id);
    this.closeRejectModal();

    if (target.type === 'shop') {
      this.adminService.rejectShopkeeper(target.id, reason).subscribe({
        next: () => {
          this.toast.show(`Shop "${target.name}" rejected.`, 'info');
          this.actionInProgress.set(null);
          this.loadData();
        },
        error: (err) => {
          this.actionInProgress.set(null);
          this.toast.show(err?.error?.error || 'Failed to reject shop.', 'error');
        }
      });
    } else {
      this.adminService.rejectProduct(target.id, reason).subscribe({
        next: () => {
          this.toast.show(`Product "${target.name}" rejected.`, 'info');
          this.actionInProgress.set(null);
          this.loadData();
        },
        error: (err) => {
          this.actionInProgress.set(null);
          this.toast.show(err?.error?.error || 'Failed to reject product.', 'error');
        }
      });
    }
  }
}
