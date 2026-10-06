import { Component, inject, signal, OnInit, OnDestroy, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { SellerService, ShopDto, LowStockVariantDto, OrderDto } from '../../core/services/seller.service';
import { SellerProductService } from '../../core/services/product.service';
import { TierModal } from '../../shared/components/tier-modal/tier-modal';
import { WarehouseProductDetailModal } from '../../shared/components/warehouse-product-detail-modal/warehouse-product-detail-modal';
import { ImageUrlPipe } from '../../shared/pipes/image-url.pipe';
import { ApiService, ToastService, ProductListDto, PagedList, HomeService, CategoryTreeDto, SignalRService } from 'eseller-shared';

export interface CategoryStat {
  name: string;
  count: number;
  percentage: number;
  imageUrl?: string | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TierModal, WarehouseProductDetailModal, ImageUrlPipe],
  templateUrl: './dashboard.html'
})
export class Dashboard implements OnInit, OnDestroy {
  private readonly sellerSvc = inject(SellerService);
  private readonly productService = inject(SellerProductService);
  private readonly homeService = inject(HomeService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly signalR = inject(SignalRService);
  private unsubNotif: (() => void) | null = null;

  @ViewChild('warehouseSlider') warehouseSliderRef?: ElementRef<HTMLDivElement>;

  readonly loading = signal<boolean>(true);
  readonly shop = signal<ShopDto | null>(null);
  readonly pendingOrders = signal<number>(0);
  readonly recentOrders = signal<OrderDto[]>([]);
  readonly myProducts = signal<ProductListDto[]>([]);
  readonly mySellerProducts = signal<ProductListDto[]>([]);
  readonly myStoreProductIds = signal<Set<string>>(new Set());
  readonly pendingProductIds = signal<Set<string>>(new Set());

  // Top 10 Master Warehouse Catalog Products
  readonly topWarehouseProducts = signal<ProductListDto[]>([]);
  readonly categories = signal<CategoryTreeDto[]>([]);
  readonly isAddingProduct = signal<string | null>(null);

  // Calculated Sales & Flat 20% Commission Stats
  readonly totalGrossSales = signal<number>(0);
  readonly totalNetCommission = signal<number>(0); // 20% of gross sales
  readonly todaySales = signal<number>(0);
  readonly todayCommission = signal<number>(0);
  readonly weeklySales = signal<number>(0);
  readonly monthlySales = signal<number>(0);

  // Current Plan & Tier State (Default Bronze Free - 200 products capacity)
  readonly currentTier = signal<string>('Bronze (Free)');
  readonly maxProductLimit = signal<number>(200);
  readonly isTierModalOpen = signal<boolean>(false);
  readonly pendingTierUpgrade = signal<{ tier: string; price: number } | null>(null);

  // Category-wise Breakdown Computed
  readonly categoryStats = computed<CategoryStat[]>(() => {
    const products = this.myProducts();
    const tree = this.categories();

    const findImage = (name: string): string | null => {
      const walk = (nodes: CategoryTreeDto[]): string | null => {
        for (const n of nodes || []) {
          if (n.name === name) return n.imageUrl || null;
          const nested = walk(n.children || []);
          if (nested) return nested;
        }
        return null;
      };
      return walk(tree);
    };

    if (!products.length) {
      return [];
    }

    const counts: Record<string, number> = {};
    products.forEach(p => {
      const cat = p.categoryName || 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const total = products.length;
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
        imageUrl: findImage(name)
      }))
      .sort((a, b) => b.count - a.count);
  });

  ngOnInit(): void {
    this.loadDashboardData();
    void this.signalR.startNotificationConnection().catch(() => {});
    this.unsubNotif = this.signalR.onReceiveNotification((payload) => {
      const title = String(payload?.title || '').toLowerCase();
      const msg = String(payload?.message || '').toLowerCase();
      if (title.includes('tier') || msg.includes('tier') || msg.includes('plan')) {
        this.pendingTierUpgrade.set(null);
        this.loadDashboardData();
        this.toast.show(payload.title || 'Your package was updated.', 'success');
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubNotif?.();
    this.unsubNotif = null;
  }

  loadDashboardData(): void {
    this.loading.set(true);

    this.sellerSvc.getMyShop(true).subscribe({
      next: (shop) => {
        this.shop.set(shop);
        this.loading.set(false);
        if (shop?.maxProductLimit) this.maxProductLimit.set(shop.maxProductLimit);
        if (shop?.tierName || shop?.badgeText) {
          this.currentTier.set(shop.tierName || shop.badgeText || 'Bronze (Free)');
        }

        if (shop?.id) {
          // Load my products for category breakdown and store matching
          this.productService.getSellerProducts(shop.id, 1, 500).subscribe({
            next: (res) => {
              const items = res.items || [];
              this.mySellerProducts.set(items);
              // Live store inventory = admin-approved only
              this.myProducts.set(items.filter(p => p.isApproved));
              this.syncWarehouseButtonState();
            },
            error: () => {}
          });
        }
      },
      error: () => this.loading.set(false)
    });

    this.homeService.getCategories(true).subscribe({
      next: (cats) => this.categories.set(cats || []),
      error: () => {}
    });

    // Load Top 10 Warehouse Catalog Products for the Slider
    this.api.get<PagedList<ProductListDto>>('/Products/catalog?pageNumber=1&pageSize=10').subscribe({
      next: (res) => {
        this.topWarehouseProducts.set(res.items || []);
        this.syncWarehouseButtonState();
      },
      error: () => {}
    });

    this.sellerSvc.getSellerOrders(1, 50).subscribe({
      next: (res: any) => {
        const orders: OrderDto[] = (Array.isArray(res) ? res : (res?.items ?? [])).map((o: any) => ({
          ...o,
          id: o.id,
          orderRequestId: o.orderRequestId,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          status: o.status,
          totalAmount: Number(o.totalAmount) || 0,
          totalItems: Number(o.totalItems) || 0,
          items: o.items || [],
          createdAt: o.createdAt
        }));
        this.recentOrders.set(orders.slice(0, 6));

        const pendingCount = orders.filter((o: any) =>
          String(o.status || '').toLowerCase() === 'pending'
        ).length;
        this.pendingOrders.set(pendingCount);

        // Calculate sales & 20% flat commissions
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        let grossTotal = 0;
        let todaySum = 0;
        let weekSum = 0;
        let monthSum = 0;

        orders.forEach(o => {
          if (String(o.status || '').toLowerCase() !== 'cancelled') {
            const orderDate = new Date(o.createdAt);
            const amount = Number(o.totalAmount) || 0;
            grossTotal += amount;
            if (o.createdAt?.startsWith(todayStr)) {
              todaySum += amount;
            }
            if (orderDate >= oneWeekAgo) {
              weekSum += amount;
            }
            if (orderDate >= oneMonthAgo) {
              monthSum += amount;
            }
          }
        });

        this.totalGrossSales.set(grossTotal);
        this.totalNetCommission.set(Math.round(grossTotal * 0.20));
        this.todaySales.set(todaySum);
        this.todayCommission.set(Math.round(todaySum * 0.20));
        this.weeklySales.set(weekSum);
        this.monthlySales.set(monthSum);
      },
      error: () => {}
    });
  }

  // Verification Pending Guard Modal
  readonly showPendingVerificationModal = signal<boolean>(false);

  // Slider Horizontal Scroll Controls
  scrollSliderLeft(): void {
    if (this.warehouseSliderRef?.nativeElement) {
      this.warehouseSliderRef.nativeElement.scrollBy({ left: -320, behavior: 'smooth' });
    }
  }

  scrollSliderRight(): void {
    if (this.warehouseSliderRef?.nativeElement) {
      this.warehouseSliderRef.nativeElement.scrollBy({ left: 320, behavior: 'smooth' });
    }
  }

  private syncWarehouseButtonState(): void {
    const approvedSourceIds = new Set<string>();
    const pendingSourceIds = new Set<string>();

    for (const p of this.mySellerProducts()) {
      const sourceId = p.sourceProductId || '';
      if (!sourceId) continue;
      if (p.isApproved) approvedSourceIds.add(sourceId);
      else if (!p.rejectionReason) pendingSourceIds.add(sourceId);
    }

    const approvedIds = new Set<string>();
    const pendingIds = new Set<string>();
    for (const wp of this.topWarehouseProducts()) {
      if (approvedSourceIds.has(wp.id)) approvedIds.add(wp.id);
      else if (pendingSourceIds.has(wp.id)) pendingIds.add(wp.id);
    }

    this.myStoreProductIds.set(approvedIds);
    this.pendingProductIds.set(pendingIds);
  }

  readonly requestSuccessProduct = signal<ProductListDto | null>(null);
  readonly detailProduct = signal<ProductListDto | null>(null);

  openProductDetail(product: ProductListDto): void {
    this.detailProduct.set(product);
  }

  closeProductDetail(): void {
    this.detailProduct.set(null);
  }

  canRequestFromDetail(product: ProductListDto | null): boolean {
    if (!product) return false;
    return !this.isAddedToStore(product.id) && !this.isPendingApproval(product.id);
  }

  requestLabelFor(product: ProductListDto | null): string {
    if (!product) return 'Add to List';
    if (this.isAddedToStore(product.id)) return 'Live in Your Store';
    if (this.isPendingApproval(product.id)) return 'Approval In Progress';
    return 'Add to List';
  }

  onDetailRequestList(product: ProductListDto): void {
    this.closeProductDetail();
    this.addToStoreFromWarehouse(product);
  }

  /** Seller requests Super Admin approval to list a warehouse product on their shop. */
  addToStoreFromWarehouse(product: ProductListDto): void {
    const shop = this.shop();

    if (!shop || !shop.isApproved) {
      this.showPendingVerificationModal.set(true);
      return;
    }

    if (this.isAddedToStore(product.id) || this.isPendingApproval(product.id)) {
      this.toast.show(
        this.isPendingApproval(product.id)
          ? 'Approval already in progress for this product.'
          : 'This product is already live in your store.',
        'warning'
      );
      return;
    }

    const usedSlots = this.myStoreProductIds().size + this.pendingProductIds().size;
    if (usedSlots >= this.maxProductLimit()) {
      this.toast.show(
        `Package capacity reached (${this.maxProductLimit()} products). Upgrade your plan to list more.`,
        'warning'
      );
      return;
    }

    this.isAddingProduct.set(product.id);
    this.api.post<{ productId: string; message: string; isPendingApproval?: boolean }>('/Products/add-to-store', {
      sourceProductId: product.id,
      shopId: shop.id
    }).subscribe({
      next: (res) => {
        this.isAddingProduct.set(null);
        this.pendingProductIds.update(set => {
          const next = new Set(set);
          next.add(product.id);
          return next;
        });
        this.requestSuccessProduct.set(product);
        this.toast.show(
          res?.message || `"${product.name}" listing request submitted. Approval in progress.`,
          'success'
        );
      },
      error: (err) => {
        this.isAddingProduct.set(null);
        const code = err?.error?.errorCode;
        if (code === 'STORE_NOT_VERIFIED') {
          this.showPendingVerificationModal.set(true);
          return;
        }
        if (code === 'PRODUCT_ALREADY_REQUESTED') {
          this.pendingProductIds.update(set => {
            const next = new Set(set);
            next.add(product.id);
            return next;
          });
          this.toast.show('This product is already awaiting Super Admin approval.', 'warning');
          return;
        }
        this.toast.show(err?.error?.error || 'Failed to submit listing request.', 'error');
      }
    });
  }

  closeRequestSuccessModal(): void {
    this.requestSuccessProduct.set(null);
  }

  closePendingVerificationModal(): void {
    this.showPendingVerificationModal.set(false);
  }

  contactSupport(): void {
    this.showPendingVerificationModal.set(false);
    this.router.navigateByUrl('/chat');
  }

  isAddedToStore(productId: string): boolean {
    return this.myStoreProductIds().has(productId);
  }

  isPendingApproval(productId: string): boolean {
    return this.pendingProductIds().has(productId);
  }

  getCommission(amount: number): number {
    return Math.round((Number(amount) || 0) * 0.20);
  }

  navigateTo(path: string): void {
    this.router.navigateByUrl(path);
  }

  openTierModal(): void {
    this.isTierModalOpen.set(true);
  }

  closeTierModal(): void {
    this.isTierModalOpen.set(false);
  }

  onTierRequested(data: { tier: string; price: number; note: string; receiptUrl?: string; categoryId?: string }): void {
    this.pendingTierUpgrade.set({ tier: data.tier, price: data.price });
    
    this.sellerSvc.requestTierUpgrade({
      requestedTier: data.tier,
      price: data.price,
      referenceNote: data.note,
      paymentMethod: data.price === 0 ? 'Free Default' : 'Online Merchant Transfer',
      receiptUrl: data.receiptUrl || null,
      requestedCategoryId: data.categoryId || null
    }).subscribe({
      next: (res) => {
        this.toast.show(
          res?.message || `Upgrade request for ${data.tier} ($${data.price}) submitted to Super Admin for verification!`,
          'success'
        );
      },
      error: (err) => {
        this.pendingTierUpgrade.set(null);
        this.toast.show(err?.error?.error || 'Failed to submit tier upgrade request.', 'error');
      }
    });
  }

  statusBadgeClass(status: string): string {
    const s = status?.toLowerCase() || '';
    if (s === 'pending') return 'bg-amber-50 text-amber-800 border border-amber-300';
    if (s === 'confirmed' || s === 'processing' || s === 'packed') return 'bg-blue-50 text-blue-800 border border-blue-200';
    if (s === 'shipped' || s === 'outfordelivery') return 'bg-purple-50 text-purple-800 border border-purple-200';
    if (s === 'delivered') return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    if (s === 'cancelled' || s === 'returned') return 'bg-red-50 text-red-800 border border-red-200';
    return 'bg-slate-100 text-slate-700';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-PK', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }
}
