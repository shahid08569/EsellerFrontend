import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { ToastService, SkeletonLayout, SearchableSelect, SearchableSelectOption, AuthStore } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminPermissionService } from '../../../core/services/admin-permission.service';
import {
  AdminBrandDto,
  AdminCategoryDto,
  AdminOrderDto,
  AdminProductDto,
  AdminShopDto
} from '../../../core/models/admin.models';

type OrderTab = 'all' | 'pending' | 'confirmed' | 'processing' | 'ontheway' | 'delivered' | 'cancelled';
type PlaceOrderMode = 'modal' | 'page';

export interface PlaceOrderMultiItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  shopId: string;
  shopName: string;
  brandName: string;
  variantId: string;
  variantSku: string;
  price: number;
  stockQty: number;
  quantity: number;
  variants: { id: string; sku: string; price: number; stockQty: number }[];
  loadingVariants: boolean;
  hasVariantError?: boolean;
}

@Component({
  selector: 'app-order-management',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, FormsModule, SkeletonLayout, SearchableSelect],
  templateUrl: './order-management.html'
})
export class OrderManagement implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly permissionService = inject(AdminPermissionService);
  readonly authStore = inject(AuthStore);

  readonly isPartner = computed(() => this.authStore.role() === 'Partner');
  readonly canPlaceOrder = computed(() => this.permissionService.has('orders:place'));
  readonly canManageOrders = computed(() => this.permissionService.has('orders:manage'));

  readonly isLoading = signal<boolean>(true);
  readonly orders = signal<AdminOrderDto[]>([]);
  readonly shops = signal<AdminShopDto[]>([]);

  // Selection & Batch Delete
  readonly selectedOrderIds = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedOrderIds().size);

  // Delete Confirmation Modal
  readonly deleteModalOpen = signal<boolean>(false);
  readonly isBatchDelete = signal<boolean>(false);
  readonly orderToDelete = signal<AdminOrderDto | null>(null);
  readonly isDeleting = signal<boolean>(false);

  // Batch Status Update Modal
  readonly batchStatusModalOpen = signal<boolean>(false);
  readonly selectedBatchStatus = signal<number>(2);
  readonly isUpdatingBatchStatus = signal<boolean>(false);

  // Filters & Sorting
  readonly activeTab = signal<OrderTab>('all');
  readonly selectedShopId = signal<string>('all');
  readonly sortOrder = signal<'newest' | 'oldest'>('newest');
  readonly searchTerm = signal<string>('');
  readonly actionInProgress = signal<string | null>(null);

  // All Orders Dedicated Filters: Payment Status & Date Filter
  readonly paymentFilter = signal<string>('all');
  readonly dateFilter = signal<string>('all');
  readonly customStartDate = signal<string>('');
  readonly customEndDate = signal<string>('');

  readonly paymentFilterOptions: SearchableSelectOption[] = [
    { value: 'all', label: 'All Payment Statuses' },
    { value: 'paid', label: 'Paid' },
    { value: 'unpaid', label: 'Unpaid' }
  ];

  readonly dateFilterOptions: SearchableSelectOption[] = [
    { value: 'all', label: 'All Dates' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: 'custom', label: 'Custom Range...' }
  ];

  readonly hasActiveAllOrderFilters = computed(() => {
    return this.paymentFilter() !== 'all' ||
           this.dateFilter() !== 'all' ||
           !!this.customStartDate() ||
           !!this.customEndDate();
  });

  // Pagination
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 20, 50, 100];

  readonly sortOrderOptions: SearchableSelectOption[] = [
    { value: 'newest', label: 'Newest Orders First' },
    { value: 'oldest', label: 'Oldest Orders First' }
  ];

  readonly pageSizeSearchableOptions = computed<SearchableSelectOption[]>(() =>
    this.pageSizeOptions.map(o => ({ value: String(o), label: String(o) }))
  );

  getNextStatusSearchableOptions(currentStatus: number | string): SearchableSelectOption[] {
    return this.getNextStatusOptions(currentStatus).map(opt => ({
      value: String(opt.value),
      label: opt.label
    }));
  }

  getItemVariantOptions(item: PlaceOrderMultiItem): SearchableSelectOption[] {
    return item.variants.map(v => ({
      value: v.id,
      label: `${v.sku} — $${v.price} (stock ${v.stockQty})`
    }));
  }

  // Details Modal
  readonly detailsModalOpen = signal<boolean>(false);
  readonly selectedOrder = signal<AdminOrderDto | null>(null);
  readonly orderHistory = signal<any[]>([]);
  readonly isLoadingHistory = signal<boolean>(false);

  // Place order (Management → any seller)
  // modal = "+ Place Order" button; page = sidebar "Create Order" link
  readonly placeOrderMode = signal<PlaceOrderMode | null>(null);
  readonly placeOrderOpen = computed(() => this.placeOrderMode() !== null);
  readonly isPlaceOrderPage = computed(() => this.placeOrderMode() === 'page');
  readonly isPlacingOrder = signal<boolean>(false);

  // Mode: Single product vs Multiple products
  readonly orderPlacementType = signal<'single' | 'multiple'>('multiple');
  readonly orderStep = signal<'select' | 'delivery'>('select');
  readonly multiOrderItems = signal<PlaceOrderMultiItem[]>([]);
  readonly placeOrderNotes = signal<string>('Placed by Management');

  readonly multiTotalItemsCount = computed(() => {
    return this.multiOrderItems().reduce((acc, item) => acc + item.quantity, 0);
  });

  readonly multiGrandTotalAmount = computed(() => {
    return this.multiOrderItems().reduce((acc, item) => acc + (item.price * item.quantity), 0);
  });

  readonly multiOrderShopsSummary = computed(() => {
    const map = new Map<string, { shopId: string; shopName: string; count: number; total: number; items: PlaceOrderMultiItem[] }>();
    for (const item of this.multiOrderItems()) {
      const existing = map.get(item.shopId) || { shopId: item.shopId, shopName: item.shopName, count: 0, total: 0, items: [] };
      existing.count += item.quantity;
      existing.total += item.price * item.quantity;
      existing.items.push(item);
      map.set(item.shopId, existing);
    }
    return Array.from(map.values());
  });

  readonly multiOrderShopsCount = computed(() => {
    return this.multiOrderShopsSummary().length;
  });

  readonly singleProductTotalAmount = computed(() => {
    const variantId = this.placeVariantId();
    const v = this.placeVariants().find(x => x.id === variantId);
    const unitPrice = v ? v.price : (Number(this.placeSelectedProduct()?.basePrice) || 0);
    return unitPrice * Math.max(1, Number(this.placeQty()) || 1);
  });

  readonly grandOrderTotal = computed(() => {
    return this.orderPlacementType() === 'multiple'
      ? this.multiGrandTotalAmount()
      : this.singleProductTotalAmount();
  });

  readonly isAnyItemLoadingVariants = computed(() => {
    if (this.orderPlacementType() === 'single') {
      return this.placeLoadingVariants();
    }
    return this.multiOrderItems().some(i => i.loadingVariants);
  });

  readonly hasAnyVariantError = computed(() => {
    if (this.orderPlacementType() === 'single') {
      return !this.placeLoadingVariants() && !!this.placeProductId() && !this.placeVariantId();
    }
    return this.multiOrderItems().some(i => !i.loadingVariants && (!i.variantId || i.hasVariantError));
  });

  isProductLoadingVariants(productId: string): boolean {
    if (this.orderPlacementType() === 'single') {
      return this.placeProductId() === productId && this.placeLoadingVariants();
    }
    return this.multiOrderItems().some(i => i.productId === productId && i.loadingVariants);
  }

  isProductVariantFailed(productId: string): boolean {
    if (this.orderPlacementType() === 'single') {
      return this.placeProductId() === productId && !this.placeLoadingVariants() && !this.placeVariantId() && this.placeVariants().length === 0;
    }
    return this.multiOrderItems().some(i => i.productId === productId && !i.loadingVariants && (!i.variantId || i.hasVariantError));
  }

  readonly placeShopId = signal<string>('');
  readonly placeCatalogProducts = signal<AdminProductDto[]>([]);
  readonly placeCategories = signal<AdminCategoryDto[]>([]);
  readonly placeBrands = signal<AdminBrandDto[]>([]);
  readonly placeFilterSearch = signal<string>('');
  readonly placeFilterShopId = signal<string>('all');
  readonly placeFilterCategoryId = signal<string>('all');
  readonly placeFilterBrandId = signal<string>('all');

  readonly mainShopOptions = computed<SearchableSelectOption[]>(() => [
    { value: 'all', label: this.isPartner() ? 'All My Referral Shops' : 'All Merchant Shops' },
    ...this.shops().map(s => ({
      value: s.id,
      label: s.name
    }))
  ]);

  readonly placeShopOptions = computed<SearchableSelectOption[]>(() => [
    { value: 'all', label: this.isPartner() ? 'All My Referral Shops' : 'All Shops' },
    ...this.shops().map(s => ({
      value: s.id,
      label: s.name
    }))
  ]);

  readonly placeCategoryOptions = computed<SearchableSelectOption[]>(() => [
    { value: 'all', label: 'All Categories' },
    ...this.placeCategories().map(c => ({
      value: c.id,
      label: c.name
    }))
  ]);

  readonly placeBrandOptions = computed<SearchableSelectOption[]>(() => [
    { value: 'all', label: 'All Brands' },
    ...this.placeBrands().map(b => ({
      value: b.id,
      label: b.name
    }))
  ]);
  readonly placeProductId = signal<string>('');
  readonly placeSelectedProduct = signal<AdminProductDto | null>(null);
  readonly placeVariants = signal<{ id: string; sku: string; price: number; stockQty: number }[]>([]);
  readonly placeVariantId = signal<string>('');
  readonly placeVariantOptions = computed<SearchableSelectOption[]>(() =>
    this.placeVariants().map(v => ({
      value: v.id,
      label: `${v.sku} — $${v.price} (stock: ${v.stockQty})`
    }))
  );
  readonly placeQty = signal<number>(1);
  readonly placeCustomerName = signal<string>('');
  readonly placeCustomerPhone = signal<string>('');
  readonly placeAddress = signal<string>('');
  readonly placeCity = signal<string>('');
  readonly placeLoadingProducts = signal<boolean>(false);
  readonly placeLoadingVariants = signal<boolean>(false);

  readonly filteredPlaceProducts = computed(() => {
    let list = [...this.placeCatalogProducts()];
    if (this.isPartner()) {
      const partnerShopIds = new Set(this.shops().map(s => s.id.toLowerCase()));
      list = list.filter(p => p.shopId && partnerShopIds.has(p.shopId.toLowerCase()));
    }
    const term = this.placeFilterSearch().trim().toLowerCase();
    const shopId = this.placeFilterShopId();
    const categoryId = this.placeFilterCategoryId();
    const brandId = this.placeFilterBrandId();

    if (shopId && shopId !== 'all') {
      const sid = shopId.toLowerCase();
      list = list.filter(p => String(p.shopId || '').toLowerCase() === sid);
    }
    if (categoryId && categoryId !== 'all') {
      const cid = categoryId.toLowerCase();
      list = list.filter(p => String(p.categoryId || '').toLowerCase() === cid);
    }
    if (brandId && brandId !== 'all') {
      const bid = brandId.toLowerCase();
      list = list.filter(p => String(p.brandId || '').toLowerCase() === bid);
    }
    if (term) {
      list = list.filter(p =>
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.shopName && p.shopName.toLowerCase().includes(term)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(term)) ||
        (p.brandName && p.brandName.toLowerCase().includes(term))
      );
    }
    return list;
  });

  // Dedicated catalog pagination & responsive view
  readonly placePageSizeOptions = [5, 10, 15, 25, 50];
  readonly placePageSize = signal<number>(typeof window !== 'undefined' && window.innerWidth < 1024 ? 5 : 10);
  readonly placeCurrentPage = signal<number>(1);
  readonly placeMobileTab = signal<'catalog' | 'review'>('catalog');

  readonly totalPlacePages = computed(() => {
    const total = this.filteredPlaceProducts().length;
    const size = this.placePageSize();
    return Math.max(1, Math.ceil(total / size));
  });

  readonly pagedPlaceProducts = computed(() => {
    const list = this.filteredPlaceProducts();
    const size = this.placePageSize();
    const totalPages = this.totalPlacePages();
    const page = Math.min(Math.max(1, this.placeCurrentPage()), totalPages);
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  setPlacePageSize(size: number): void {
    this.placePageSize.set(size);
    this.placeCurrentPage.set(1);
  }

  goToPlacePage(page: number): void {
    if (page >= 1 && page <= this.totalPlacePages()) {
      this.placeCurrentPage.set(page);
    }
  }

  nextPlacePage(): void {
    if (this.placeCurrentPage() < this.totalPlacePages()) {
      this.placeCurrentPage.update(p => p + 1);
    }
  }

  prevPlacePage(): void {
    if (this.placeCurrentPage() > 1) {
      this.placeCurrentPage.update(p => p - 1);
    }
  }

  readonly Math = Math;

  formatImageUrl(url?: string | null): string {
    return this.adminService.formatImageUrl(url);
  }

  onImgError(event: Event): void {
    (event.target as HTMLElement).style.display = 'none';
  }

  // Aligned with backend OrderStatus enum (4=Packed/OnTheWay, 5=On the Way/Shipped)
  readonly statusOptions = [
    { value: 1, label: 'Pending' },
    { value: 2, label: 'Confirmed' },
    { value: 3, label: 'Processing' },
    { value: 4, label: 'Packed' },
    { value: 5, label: 'On the Way' },
    { value: 6, label: 'Out For Delivery' },
    { value: 7, label: 'Delivered' },
    { value: 8, label: 'Cancelled' },
    { value: 9, label: 'Return Requested' },
    { value: 10, label: 'Returned' },
    { value: 11, label: 'Refund Pending' },
    { value: 12, label: 'Refunded' }
  ];

  /**
   * Progressive next statuses only (matches backend IsValidTransition).
   * Earlier steps like Pending never reappear after you move forward.
   */
  getNextStatusOptions(currentStatus: number | string): { value: number; label: string }[] {
    const current = this.getStatusNumber(currentStatus);
    // Values: 1 Pending, 2 Confirmed, 3 Processing, 4 Packed, 5 On the Way,
    // 6 OutForDelivery, 7 Delivered, 8 Cancelled, 9 ReturnRequested,
    // 10 Returned, 11 RefundPending, 12 Refunded
    const nextByStatus: Record<number, number[]> = {
      1: [2, 8],
      2: [3, 4, 5, 7, 8],
      3: [4, 5, 7, 8],
      4: [5, 6, 7, 8],
      5: [6, 7, 8],
      6: [7, 8],
      7: [9, 10],          // Delivered → return flow only (not Cancel / not Pending)
      8: [],
      9: [10],
      10: [11, 12],
      11: [12],
      12: []
    };
    const allowed = nextByStatus[current] || [];
    return this.statusOptions.filter(o => allowed.includes(o.value));
  }

  isPaymentPaid(order: AdminOrderDto | null | undefined): boolean {
    if (!order) return false;
    const s = String(order.paymentStatus || '').toLowerCase();
    return s === 'paid' || s === 'completed' || s === '2';
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      this.placePageSize.set(5);
    }
    this.loadShops();
    this.loadOrders();
    this.route.queryParams.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      const action = params['action'];
      const shopId = params['shopId'];
      if (action === 'create' || action === 'place') {
        if (!this.canPlaceOrder()) {
          this.toast.show('You do not have permission to place orders', 'error');
          this.router.navigate(['/orders']);
          return;
        }
        if (this.placeOrderMode() !== 'page') {
          this.openPlaceOrder('page', shopId);
        } else if (shopId && this.placeFilterShopId() !== shopId) {
          this.placeFilterShopId.set(shopId);
          this.loadPlaceOrderCatalog();
        }
      } else if (this.placeOrderMode() === 'page') {
        this.placeOrderMode.set(null);
      }
    });
  }

  loadShops(): void {
    if (this.isPartner()) {
      this.adminService.getMyReferrals().pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (res) => {
          const list = (res?.shops || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            slug: s.slug,
            city: '',
            country: '',
            phone: s.phone,
            logoUrl: s.logoUrl,
            status: s.status,
            isActive: s.isActive,
            rating: s.rating ?? 5,
            totalProducts: s.totalProducts ?? 0,
            createdAt: s.joinedAt || new Date().toISOString()
          } as unknown as AdminShopDto));
          this.shops.set(list);
        },
        error: () => {}
      });
    } else {
      this.adminService.getShops(1, 500).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (res) => {
          this.shops.set(res?.items || []);
        },
        error: () => {}
      });
    }
  }

  loadOrders(): void {
    this.isLoading.set(true);
    const shopId = this.selectedShopId() !== 'all' ? this.selectedShopId() : undefined;
    this.adminService.getOrders(1, 500, undefined, shopId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        const items = res?.items || [];
        this.orders.set(items);
        // Keep open detail in sync (e.g. after Mark Paid / status change)
        const openId = this.selectedOrder()?.id;
        if (openId) {
          const fresh = items.find((o: AdminOrderDto) => o.id === openId);
          if (fresh) this.selectedOrder.set(fresh);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.show(err?.error?.error || 'Failed to load platform orders', 'error');
      }
    });
  }

  /** Counts for status filter pills (shop-scoped, before search/tab). */
  readonly tabCounts = computed(() => {
    let list = [...this.orders()];
    const shopId = this.selectedShopId();
    if (shopId && shopId !== 'all') {
      const selectedShop = this.shops().find(s => s.id === shopId);
      const selectedShopName = selectedShop?.name.toLowerCase();
      list = list.filter(o => {
        if ((o as any).shopId && (o as any).shopId === shopId) return true;
        if (selectedShopName && o.shopName && o.shopName.toLowerCase().includes(selectedShopName)) return true;
        if (o.items && o.items.some(i => i.shopId === shopId || (selectedShopName && i.shopName?.toLowerCase().includes(selectedShopName)))) return true;
        return false;
      });
    }
    const n = (pred: (s: number) => boolean) => list.filter(o => pred(this.getStatusNumber(o.status))).length;
    return {
      all: list.length,
      pending: n(s => s === 1),
      confirmed: n(s => s === 2),
      processing: n(s => s === 3),
      ontheway: n(s => [4, 5, 6].includes(s)),
      delivered: n(s => s === 7),
      cancelled: n(s => [8, 9, 10, 11, 12].includes(s))
    };
  });

  tabBadgeClass(tab: OrderTab): string {
    return this.activeTab() === tab ? 'es-tab-badge-on-active' : 'es-tab-badge';
  }

  readonly filteredOrders = computed(() => {
    let list = [...this.orders()];
    const tab = this.activeTab();
    const shopId = this.selectedShopId();
    const term = this.searchTerm().trim().toLowerCase();
    const sort = this.sortOrder();

    // 1. Status Filter
    if (tab === 'pending') {
      list = list.filter(o => this.getStatusNumber(o.status) === 1);
    } else if (tab === 'confirmed') {
      list = list.filter(o => this.getStatusNumber(o.status) === 2);
    } else if (tab === 'processing') {
      list = list.filter(o => this.getStatusNumber(o.status) === 3);
    } else if (tab === 'ontheway') {
      list = list.filter(o => [4, 5, 6].includes(this.getStatusNumber(o.status)));
    } else if (tab === 'delivered') {
      list = list.filter(o => this.getStatusNumber(o.status) === 7);
    } else if (tab === 'cancelled') {
      list = list.filter(o => [8, 9, 10, 11, 12].includes(this.getStatusNumber(o.status)));
    }

    // 2. Shop Filter (client fallback if multi-shop)
    if (shopId && shopId !== 'all') {
      const selectedShop = this.shops().find(s => s.id === shopId);
      const selectedShopName = selectedShop?.name.toLowerCase();
      list = list.filter(o => {
        if ((o as any).shopId && (o as any).shopId === shopId) return true;
        if (selectedShopName && o.shopName && o.shopName.toLowerCase().includes(selectedShopName)) return true;
        if (o.items && o.items.some(i => i.shopId === shopId || (selectedShopName && i.shopName?.toLowerCase().includes(selectedShopName)))) return true;
        return false;
      });
    }

    // 3. Search Filter
    if (term) {
      list = list.filter(o =>
        (o.id && o.id.toLowerCase().includes(term)) ||
        (o.orderNumber && o.orderNumber.toLowerCase().includes(term)) ||
        (o.customerName && o.customerName.toLowerCase().includes(term)) ||
        (o.customerPhone && o.customerPhone.includes(term)) ||
        (o.customerEmail && o.customerEmail.toLowerCase().includes(term)) ||
        (o.shopName && o.shopName.toLowerCase().includes(term)) ||
        (o.shippingAddress && o.shippingAddress.toLowerCase().includes(term)) ||
        (o.city && o.city.toLowerCase().includes(term))
      );
    }

    // 4. Sort: Newest First (default) or Oldest First
    list.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return sort === 'newest' ? timeB - timeA : timeA - timeB;
    });

    // 5. All Orders Specific Filters: Payment Status & Date Range
    if (tab === 'all') {
      if (this.paymentFilter() === 'paid') {
        list = list.filter(o => this.isPaymentPaid(o));
      } else if (this.paymentFilter() === 'unpaid') {
        list = list.filter(o => !this.isPaymentPaid(o));
      }

      if (this.dateFilter() !== 'all') {
        list = list.filter(o => this.matchesOrderDate(o));
      }
    }

    return list;
  });

  // Pagination computeds
  readonly totalFilteredCount = computed(() => this.filteredOrders().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalFilteredCount() / this.pageSize())));

  readonly paginatedOrders = computed(() => {
    const list = this.filteredOrders();
    const page = Math.min(this.currentPage(), this.totalPages());
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  readonly startIndex = computed(() => {
    if (this.totalFilteredCount() === 0) return 0;
    return (Math.min(this.currentPage(), this.totalPages()) - 1) * this.pageSize() + 1;
  });

  readonly endIndex = computed(() => {
    return Math.min(Math.min(this.currentPage(), this.totalPages()) * this.pageSize(), this.totalFilteredCount());
  });

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = Math.min(this.currentPage(), total);
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  readonly isAllCurrentPageSelected = computed(() => {
    const list = this.paginatedOrders();
    if (list.length === 0) return false;
    const selected = this.selectedOrderIds();
    return list.every(o => selected.has(o.id));
  });

  toggleSelectAll(): void {
    const set = new Set(this.selectedOrderIds());
    const list = this.paginatedOrders();
    if (this.isAllCurrentPageSelected()) {
      list.forEach(o => set.delete(o.id));
    } else {
      list.forEach(o => set.add(o.id));
    }
    this.selectedOrderIds.set(set);
  }

  toggleSelectOrder(id: string): void {
    const set = new Set(this.selectedOrderIds());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.selectedOrderIds.set(set);
  }

  isOrderSelected(id: string): boolean {
    return this.selectedOrderIds().has(id);
  }

  clearSelection(): void {
    this.selectedOrderIds.set(new Set());
  }

  openDeleteModal(order: AdminOrderDto): void {
    if (!this.canManageOrders()) {
      this.toast.show('You do not have permission to manage orders', 'error');
      return;
    }
    this.orderToDelete.set(order);
    this.isBatchDelete.set(false);
    this.deleteModalOpen.set(true);
  }

  openBatchDeleteModal(): void {
    if (!this.canManageOrders()) {
      this.toast.show('You do not have permission to manage orders', 'error');
      return;
    }
    if (this.selectedOrderIds().size === 0) return;
    this.orderToDelete.set(null);
    this.isBatchDelete.set(true);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    if (this.isDeleting()) return;
    this.deleteModalOpen.set(false);
    this.orderToDelete.set(null);
    this.isBatchDelete.set(false);
  }

  getSelectedOrders(): AdminOrderDto[] {
    const ids = this.selectedOrderIds();
    return this.orders().filter(o => ids.has(o.id));
  }

  confirmDelete(): void {
    if (this.isDeleting()) return;

    if (this.isBatchDelete()) {
      const ids = Array.from(this.selectedOrderIds());
      if (ids.length === 0) {
        this.closeDeleteModal();
        return;
      }

      this.isDeleting.set(true);
      const requests = ids.map(id => this.adminService.deleteOrder(id));

      forkJoin(requests).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.deleteModalOpen.set(false);
          this.toast.show(`Deleted Successfully! ${ids.length} orders removed.`, 'success');
          this.clearSelection();
          this.loadOrders();
        },
        error: (err) => {
          this.isDeleting.set(false);
          this.deleteModalOpen.set(false);
          this.toast.show(err?.error?.error || 'Failed to delete some orders.', 'warning');
          this.clearSelection();
          this.loadOrders();
        }
      });
    } else {
      const order = this.orderToDelete();
      if (!order) {
        this.closeDeleteModal();
        return;
      }

      this.isDeleting.set(true);
      this.adminService.deleteOrder(order.id).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.deleteModalOpen.set(false);
          this.orderToDelete.set(null);

          const set = new Set(this.selectedOrderIds());
          set.delete(order.id);
          this.selectedOrderIds.set(set);

          this.toast.show(`Deleted Successfully! Order #${order.orderNumber || order.id.slice(0, 8)} has been deleted.`, 'success');
          this.loadOrders();
        },
        error: (err) => {
          this.isDeleting.set(false);
          this.toast.show(err?.error?.error || 'Failed to delete order.', 'error');
        }
      });
    }
  }

  /**
   * Common progressive next statuses across ALL selected orders.
   * Matches single order getNextStatusOptions(status).
   * Already completed steps (e.g. Pending, Confirmed if currently in Processing) are HIDDEN.
   */
  readonly batchNextStatusOptions = computed(() => {
    const selected = this.getSelectedOrders();
    if (selected.length === 0) return [];

    // Map each selected order to its allowed progressive next status values
    const allowedSets = selected.map(order => 
      new Set(this.getNextStatusOptions(order.status).map(opt => opt.value))
    );

    if (allowedSets.length === 0) return [];

    // Common intersection across all selected orders
    let commonValues = Array.from(allowedSets[0]);
    for (let i = 1; i < allowedSets.length; i++) {
      commonValues = commonValues.filter(val => allowedSets[i].has(val));
    }

    return this.statusOptions.filter(o => commonValues.includes(o.value));
  });

  readonly batchNextStatusSearchableOptions = computed<SearchableSelectOption[]>(() =>
    this.batchNextStatusOptions().map(o => ({ value: String(o.value), label: o.label }))
  );

  openBatchStatusModal(): void {
    if (!this.canManageOrders()) {
      this.toast.show('You do not have permission to manage orders', 'error');
      return;
    }
    if (this.selectedOrderIds().size === 0) return;

    const options = this.batchNextStatusOptions();
    if (options.length > 0) {
      this.selectedBatchStatus.set(options[0].value);
    } else {
      this.selectedBatchStatus.set(0);
    }
    this.batchStatusModalOpen.set(true);
  }

  closeBatchStatusModal(): void {
    if (this.isUpdatingBatchStatus()) return;
    this.batchStatusModalOpen.set(false);
  }

  confirmBatchStatusUpdate(): void {
    if (this.isUpdatingBatchStatus()) return;
    const ids = Array.from(this.selectedOrderIds());
    if (ids.length === 0) {
      this.closeBatchStatusModal();
      return;
    }

    const newStatus = Number(this.selectedBatchStatus());
    const validOptions = this.batchNextStatusOptions();
    if (!newStatus || !validOptions.some(o => o.value === newStatus)) {
      this.toast.show('Please select a valid progressive next status.', 'warning');
      return;
    }

    this.isUpdatingBatchStatus.set(true);

    this.adminService.batchUpdateOrderStatus(ids, newStatus).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.isUpdatingBatchStatus.set(false);
        this.batchStatusModalOpen.set(false);
        const successCount = res?.successCount ?? ids.length;
        this.toast.show(
          `Batch update complete! ${successCount} order(s) updated to ${this.getStatusLabel(newStatus)}.`,
          'success'
        );
        this.clearSelection();
        this.loadOrders();
      },
      error: (err) => {
        this.isUpdatingBatchStatus.set(false);
        const msg = err?.error?.error || err?.error?.message || 'Failed to update selected orders.';
        this.toast.show(msg, 'error');
        this.loadOrders();
      }
    });
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  onFilterTabChange(tab: OrderTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.isLoading.set(true);
    setTimeout(() => this.isLoading.set(false), 180);
  }

  onShopChange(shopId: string): void {
    this.selectedShopId.set(shopId);
    this.currentPage.set(1);
    this.loadOrders();
  }

  onSortChange(sort: 'newest' | 'oldest'): void {
    this.sortOrder.set(sort);
    this.currentPage.set(1);
    this.isLoading.set(true);
    setTimeout(() => this.isLoading.set(false), 180);
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  onPaymentFilterChange(val: string): void {
    this.paymentFilter.set(val);
    this.currentPage.set(1);
  }

  onDateFilterChange(val: string): void {
    this.dateFilter.set(val);
    this.currentPage.set(1);
  }

  onCustomDateChange(type: 'start' | 'end', val: string): void {
    if (type === 'start') {
      this.customStartDate.set(val);
    } else {
      this.customEndDate.set(val);
    }
    this.currentPage.set(1);
  }

  clearAllOrderFilters(): void {
    this.paymentFilter.set('all');
    this.dateFilter.set('all');
    this.customStartDate.set('');
    this.customEndDate.set('');
    this.currentPage.set(1);
  }

  matchesOrderDate(order: AdminOrderDto): boolean {
    const filter = this.dateFilter();
    if (filter === 'all') return true;

    if (!order.createdAt) return false;
    const orderDate = new Date(order.createdAt);
    if (isNaN(orderDate.getTime())) return false;

    const now = new Date();

    if (filter === 'today') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return orderDate >= startOfToday;
    }

    if (filter === 'yesterday') {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      return orderDate >= startOfYesterday && orderDate <= endOfYesterday;
    }

    if (filter === '7d') {
      const startOf7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return orderDate >= startOf7d;
    }

    if (filter === '30d') {
      const startOf30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return orderDate >= startOf30d;
    }

    if (filter === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return orderDate >= startOfMonth;
    }

    if (filter === 'custom') {
      const start = this.customStartDate();
      const end = this.customEndDate();
      if (start) {
        const s = new Date(`${start}T00:00:00`);
        if (orderDate < s) return false;
      }
      if (end) {
        const e = new Date(`${end}T23:59:59.999`);
        if (orderDate > e) return false;
      }
      return true;
    }

    return true;
  }

  getStatusNumber(status: number | string): number {
    if (typeof status === 'number') return status;
    const s = String(status).toLowerCase().replace(/[\s_-]/g, '');
    if (s.includes('pending') && !s.includes('refund')) return 1;
    if (s.includes('confirm')) return 2;
    if (s === 'processing' || s === '3') return 3;
    if (s === 'packed' || s === 'pack' || s === '4') return 4;
    // Backend enum OnTheWay(4) and Shipped(5) both surface as "On the Way" in UI
    if (s === 'ontheway' || s === 'shipped' || s === '5') return s === 'ontheway' ? 4 : 5;
    if (s.includes('outfordelivery') || s.includes('delivery') || s.includes('transit') || s.includes('pickup')) return 6;
    if (s.includes('deliver')) return 7;
    if (s.includes('cancel')) return 8;
    if (s.includes('returnreq')) return 9;
    if (s.includes('returned') || s.includes('return')) return 10;
    if (s.includes('refundpen')) return 11;
    if (s.includes('refund')) return 12;
    const n = parseInt(String(status), 10);
    return isNaN(n) ? 1 : n;
  }

  getStatusLabel(status: number | string): string {
    const num = this.getStatusNumber(status);
    const found = this.statusOptions.find(o => o.value === num);
    return found ? found.label : String(status);
  }

  getStatusColorClass(status: number | string): string {
    const num = this.getStatusNumber(status);
    switch (num) {
      case 1: return 'bg-amber-100 text-amber-800 border-amber-200';
      case 2:
      case 3:
      case 4: return 'bg-blue-100 text-blue-800 border-blue-200';
      case 5:
      case 6: return 'bg-purple-100 text-purple-800 border-purple-200';
      case 7: return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 8:
      case 9:
      case 10:
      case 11:
      case 12: return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  updateStatus(order: AdminOrderDto, newStatus: number, selectEl?: HTMLSelectElement): void {
    if (!newStatus) return;
    if (!this.canManageOrders()) {
      this.toast.show('You do not have permission to manage orders', 'error');
      if (selectEl) selectEl.value = '';
      return;
    }
    const allowed = this.getNextStatusOptions(order.status).map(o => o.value);
    if (!allowed.includes(newStatus)) {
      this.toast.show('That status step is no longer available for this order.', 'error');
      if (selectEl) selectEl.value = '';
      return;
    }

    this.actionInProgress.set(order.id);
    this.adminService.updateOrderStatus(order.id, newStatus).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.actionInProgress.set(null);
        if (selectEl) selectEl.value = '';
        this.toast.show(`Order #${order.orderNumber || order.id.slice(0, 8)} → ${this.getStatusLabel(newStatus)}`, 'success');
        this.loadOrders();
      },
      error: (err) => {
        this.actionInProgress.set(null);
        if (selectEl) selectEl.value = '';
        const body = err?.error;
        const msg =
          (typeof body === 'string' && body) ||
          body?.error ||
          body?.detail ||
          body?.title ||
          body?.message ||
          (Array.isArray(body?.errors) ? body.errors[0] : '') ||
          'Failed to update order status';
        this.toast.show(String(msg), 'error');
      }
    });
  }

  /** Management: mark payment Paid once. Detail modal only. */
  markPaid(order: AdminOrderDto): void {
    if (this.isPaymentPaid(order)) return;
    this.actionInProgress.set(order.id);
    this.adminService.updateOrderPaymentStatus(order.id, 2).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.actionInProgress.set(null);
        this.toast.show('Payment marked Paid', 'success');
        this.selectedOrder.update((o) =>
          o && o.id === order.id ? { ...o, paymentStatus: 'Paid' } : o
        );
        this.orders.update(list =>
          list.map(o => o.id === order.id ? { ...o, paymentStatus: 'Paid' } : o)
        );
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(
          (typeof err?.error === 'string' ? err.error : '') || 'Failed to mark payment Paid',
          'error'
        );
      }
    });
  }

  openDetails(order: AdminOrderDto): void {
    // Prefer freshest row from list (payment/status already updated)
    const fresh = this.orders().find(o => o.id === order.id) || order;
    this.selectedOrder.set(fresh);
    this.detailsModalOpen.set(true);
    this.isLoadingHistory.set(true);
    this.orderHistory.set([]);
    this.adminService.getOrderStatusHistory(order.id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (history) => {
        this.orderHistory.set(history || []);
        this.isLoadingHistory.set(false);
      },
      error: () => {
        this.isLoadingHistory.set(false);
      }
    });
  }

  closeDetails(): void {
    this.detailsModalOpen.set(false);
    this.selectedOrder.set(null);
    this.orderHistory.set([]);
  }

  openPlaceOrder(mode: PlaceOrderMode = 'modal', initialShopId?: string): void {
    if (!this.canPlaceOrder()) {
      this.toast.show('You do not have permission to place orders', 'error');
      return;
    }
    this.placeOrderMode.set(mode);
    this.orderStep.set('select');
    this.placeMobileTab.set('catalog');
    this.placeCurrentPage.set(1);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      this.placePageSize.set(5);
    } else {
      this.placePageSize.set(10);
    }
    this.orderPlacementType.set('multiple');
    this.multiOrderItems.set([]);
    this.placeShopId.set('');
    this.placeCatalogProducts.set([]);
    this.placeFilterSearch.set('');
    this.placeFilterShopId.set(initialShopId || 'all');
    this.placeFilterCategoryId.set('all');
    this.placeFilterBrandId.set('all');
    this.placeSelectedProduct.set(null);
    this.placeProductId.set('');
    this.placeVariants.set([]);
    this.placeVariantId.set('');
    this.placeQty.set(1);
    this.placeCustomerName.set('');
    this.placeCustomerPhone.set('');
    this.placeAddress.set('');
    this.placeCity.set('');
    this.placeOrderNotes.set('Placed by Management');
    this.loadPlaceOrderCatalog();
  }

  clearPlaceSingleSelection(): void {
    this.placeSelectedProduct.set(null);
    this.placeProductId.set('');
    this.placeShopId.set('');
    this.placeVariantId.set('');
    this.placeVariants.set([]);
    this.placeQty.set(1);
  }

  proceedToDelivery(): void {
    if (this.isAnyItemLoadingVariants()) {
      this.toast.show('Please wait, variants are still being retrieved.', 'info');
      return;
    }

    if (this.orderPlacementType() === 'single') {
      if (!this.placeProductId()) {
        this.toast.show('Please select a product from the catalog.', 'warning');
        return;
      }
      if (!this.placeShopId()) {
        this.toast.show('Selected product has no seller shop.', 'warning');
        return;
      }
      if (!this.placeVariantId()) {
        this.toast.show('Please select a product variant.', 'warning');
        return;
      }
    } else {
      const items = this.multiOrderItems();
      if (items.length === 0) {
        this.toast.show('Please add at least one product to the order.', 'warning');
        return;
      }
      const invalid = items.find(i => !i.variantId || i.hasVariantError);
      if (invalid) {
        this.toast.show(`Please select or retry variant for "${invalid.productName}".`, 'warning');
        return;
      }
    }
    this.orderStep.set('delivery');
  }

  backToSelect(): void {
    this.orderStep.set('select');
  }

  setOrderPlacementType(type: 'single' | 'multiple'): void {
    this.orderPlacementType.set(type);
    this.orderStep.set('select');
  }

  onPlaceShopFilterChange(shopId: string): void {
    this.placeFilterShopId.set(shopId);
    this.placeCurrentPage.set(1);
    this.loadPlaceOrderCatalog();
  }

  onPlaceCategoryFilterChange(catId: string): void {
    this.placeFilterCategoryId.set(catId);
    this.placeCurrentPage.set(1);
  }

  onPlaceBrandFilterChange(brandId: string): void {
    this.placeFilterBrandId.set(brandId);
    this.placeCurrentPage.set(1);
  }

  loadPlaceOrderCatalog(): void {
    this.placeLoadingProducts.set(true);
    const shopId = this.placeFilterShopId() !== 'all' ? this.placeFilterShopId() : undefined;

    // Load categories independently in parallel if not yet cached
    if (this.placeCategories().length === 0) {
      this.adminService.getCategories().pipe(
        catchError(() => of([] as AdminCategoryDto[])),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(cats => this.placeCategories.set(cats || []));
    }

    // Load brands independently in parallel if not yet cached
    if (this.placeBrands().length === 0) {
      this.adminService.getBrands().pipe(
        catchError(() => of([] as AdminBrandDto[])),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(brands => this.placeBrands.set(brands || []));
    }

    // Directly fetch catalog products without blocking behind categories/brands
    this.adminService.getApprovedSellerProducts(1, 500, 'all', shopId).pipe(
      catchError(() => of({ items: [], totalCount: 0 } as any)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        const approvedList = Array.isArray(res?.items)
          ? res.items
          : Array.isArray((res as any)?.Items)
            ? (res as any).Items
            : Array.isArray((res as any)?.$values)
              ? (res as any).$values
              : Array.isArray(res)
                ? res
                : [];

        if (approvedList.length > 0) {
          this.placeCatalogProducts.set(approvedList);
          this.placeLoadingProducts.set(false);
        } else if (!shopId && !this.isPartner()) {
          // If no approved seller listings exist yet, fall back to master warehouse catalog (SuperAdmin only)
          this.adminService.getProducts(undefined, undefined, 1, 200).pipe(
            catchError(() => of({ items: [], totalCount: 0 } as any)),
            takeUntilDestroyed(this.destroyRef)
          ).subscribe({
            next: (catRes) => {
              const catList = Array.isArray(catRes?.items)
                ? catRes.items
                : Array.isArray((catRes as any)?.Items)
                  ? (catRes as any).Items
                  : Array.isArray((catRes as any)?.$values)
                    ? (catRes as any).$values
                    : Array.isArray(catRes)
                      ? catRes
                      : [];
              this.placeCatalogProducts.set(catList);
              this.placeLoadingProducts.set(false);
            },
            error: () => {
              this.placeCatalogProducts.set([]);
              this.placeLoadingProducts.set(false);
            }
          });
        } else {
          // Specific shop was selected and has no products
          this.placeCatalogProducts.set([]);
          this.placeLoadingProducts.set(false);
        }
      },
      error: () => {
        this.placeCatalogProducts.set([]);
        this.placeLoadingProducts.set(false);
        this.toast.show('Failed to load products for ordering.', 'error');
      }
    });
  }

  clearPlaceFilters(): void {
    this.placeFilterSearch.set('');
    this.placeFilterShopId.set('all');
    this.placeFilterCategoryId.set('all');
    this.placeFilterBrandId.set('all');
    this.placeCurrentPage.set(1);
    this.loadPlaceOrderCatalog();
  }

  getPlaceProductImage(product: AdminProductDto): string {
    const url = product.primaryImageUrl || product.images?.[0]?.imageUrl || null;
    return this.formatImageUrl(url);
  }

  selectPlaceProduct(product: AdminProductDto): void {
    if (this.placeProductId() === product.id) {
      this.clearPlaceSingleSelection();
      return;
    }

    this.placeSelectedProduct.set(product);
    this.placeProductId.set(product.id);
    this.placeShopId.set(product.shopId || '');
    this.placeVariantId.set('');
    this.placeVariants.set([]);
    if (!product.id) return;

    this.placeLoadingVariants.set(true);
    this.adminService.getProductVariants(product.id).pipe(
      retry({ count: 2, delay: 500 }),
      catchError(() => of([])),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (variants) => {
        const mapped = (variants || []).map((v: any) => ({
          id: v.id || v.variantId,
          sku: v.sku || 'SKU',
          price: Number(v.price) || Number(product.basePrice) || 0,
          stockQty: Number(v.stockQty ?? v.stockQuantity) || 0
        }));
        this.placeVariants.set(mapped);
        if (mapped.length > 0) {
          this.placeVariantId.set(mapped[0].id);
        }
        this.placeLoadingVariants.set(false);
      },
      error: () => {
        this.placeLoadingVariants.set(false);
        this.toast.show('Failed to load variants.', 'error');
      }
    });
  }

  isPlaceProductSelected(productId: string): boolean {
    return this.placeProductId() === productId;
  }

  isProductInMultiOrder(productId: string): number {
    return this.multiOrderItems()
      .filter(item => item.productId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  toggleOrAddMultiProduct(product: AdminProductDto): void {
    const items = this.multiOrderItems();
    const existingIndex = items.findIndex(item => item.productId === product.id);

    if (existingIndex > -1) {
      const item = items[existingIndex];
      if (item.loadingVariants) {
        this.toast.show(`Variants for "${product.name}" are still loading...`, 'info');
        return;
      }
      if (item.hasVariantError || !item.variantId) {
        this.retryLoadVariants(existingIndex);
        return;
      }
      const maxStock = item.stockQty > 0 ? item.stockQty : 9999;
      if (item.quantity < maxStock) {
        this.multiOrderItems.update(list => {
          const idx = list.findIndex(i => i.productId === product.id);
          if (idx === -1) return list;
          const copy = [...list];
          copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
          return copy;
        });
        this.toast.show(`Increased "${product.name}" qty to ${item.quantity + 1}`, 'info');
      } else {
        this.toast.show(`Max stock reached for this variant (${item.stockQty}).`, 'warning');
      }
      return;
    }

    const newItem: PlaceOrderMultiItem = {
      id: `${product.id}_${Date.now()}`,
      productId: product.id,
      productName: product.name,
      productImage: this.getPlaceProductImage(product),
      shopId: product.shopId || '',
      shopName: product.shopName || 'Shop',
      brandName: product.brandName || '',
      variantId: '',
      variantSku: '',
      price: Number(product.basePrice) || 0,
      stockQty: 0,
      quantity: 1,
      variants: [],
      loadingVariants: true,
      hasVariantError: false
    };

    this.multiOrderItems.update(list => [...list, newItem]);
    this.fetchVariantsForMultiItem(product.id, product.name, Number(product.basePrice) || 0);
  }

  fetchVariantsForMultiItem(productId: string, productName: string, basePrice: number): void {
    this.adminService.getProductVariants(productId).pipe(
      retry({ count: 2, delay: 600 }),
      catchError(() => of([])),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (variants) => {
        const mapped = (variants || []).map((v: any) => ({
          id: v.id || v.variantId,
          sku: v.sku || 'SKU',
          price: Number(v.price) || basePrice || 0,
          stockQty: Number(v.stockQty ?? v.stockQuantity) || 0
        }));

        this.multiOrderItems.update(currentItems => {
          const idx = currentItems.findIndex(i => i.productId === productId);
          if (idx === -1) return currentItems;
          const updated = [...currentItems];
          const first = mapped[0];
          updated[idx] = {
            ...updated[idx],
            variants: mapped,
            loadingVariants: false,
            hasVariantError: mapped.length === 0,
            variantId: first ? first.id : '',
            variantSku: first ? first.sku : 'Default',
            price: first ? first.price : updated[idx].price,
            stockQty: first ? first.stockQty : 0
          };
          return updated;
        });

        if (mapped.length === 0) {
          this.toast.show(`No variants found for "${productName}". Click Retry or check catalog.`, 'warning');
        }
      },
      error: () => {
        this.multiOrderItems.update(currentItems => {
          const idx = currentItems.findIndex(i => i.productId === productId);
          if (idx === -1) return currentItems;
          const updated = [...currentItems];
          updated[idx] = {
            ...updated[idx],
            loadingVariants: false,
            hasVariantError: true
          };
          return updated;
        });
        this.toast.show(`Failed to load variants for "${productName}". Click Retry to fetch again.`, 'error');
      }
    });
  }

  retryLoadVariants(index: number): void {
    const items = this.multiOrderItems();
    const item = items[index];
    if (!item) return;

    this.multiOrderItems.update(list => {
      if (!list[index]) return list;
      const copy = [...list];
      copy[index] = {
        ...copy[index],
        loadingVariants: true,
        hasVariantError: false
      };
      return copy;
    });

    this.fetchVariantsForMultiItem(item.productId, item.productName, item.price);
  }

  removeMultiItem(index: number): void {
    const items = [...this.multiOrderItems()];
    items.splice(index, 1);
    this.multiOrderItems.set(items);
  }

  clearMultiItems(): void {
    this.multiOrderItems.set([]);
  }

  onMultiItemVariantChange(index: number, variantId: string): void {
    const items = [...this.multiOrderItems()];
    const item = items[index];
    if (!item) return;

    const sel = item.variants.find(v => v.id === variantId);
    if (sel) {
      items[index] = {
        ...item,
        variantId: sel.id,
        variantSku: sel.sku,
        price: sel.price,
        stockQty: sel.stockQty,
        quantity: Math.min(item.quantity, Math.max(1, sel.stockQty))
      };
      this.multiOrderItems.set(items);
    }
  }

  updateMultiItemQty(index: number, delta: number): void {
    const items = [...this.multiOrderItems()];
    const item = items[index];
    if (!item) return;

    const maxStock = item.stockQty > 0 ? item.stockQty : 9999;
    const newQty = Math.max(1, Math.min(item.quantity + delta, maxStock));
    items[index] = { ...item, quantity: newQty };
    this.multiOrderItems.set(items);
  }

  setMultiItemQtyDirect(index: number, qty: number): void {
    const items = [...this.multiOrderItems()];
    const item = items[index];
    if (!item) return;

    const maxStock = item.stockQty > 0 ? item.stockQty : 9999;
    const validQty = Math.max(1, Math.min(Number(qty) || 1, maxStock));
    items[index] = { ...item, quantity: validQty };
    this.multiOrderItems.set(items);
  }

  private resetPlaceOrderForm(): void {
    this.orderStep.set('select');
    this.placeSelectedProduct.set(null);
    this.placeProductId.set('');
    this.placeShopId.set('');
    this.placeVariantId.set('');
    this.placeVariants.set([]);
    this.placeQty.set(1);
    this.placeCustomerName.set('');
    this.placeCustomerPhone.set('');
    this.placeAddress.set('');
    this.placeCity.set('');
    this.placeOrderNotes.set('Placed by Management');
    this.multiOrderItems.set([]);
  }

  closePlaceOrder(): void {
    if (this.isPlacingOrder()) return;
    const wasPage = this.placeOrderMode() === 'page';
    this.resetPlaceOrderForm();
    if (wasPage) {
      this.router.navigateByUrl('/orders').then(() => {
        this.placeOrderMode.set(null);
      }).catch(() => {
        this.placeOrderMode.set(null);
      });
    } else {
      this.placeOrderMode.set(null);
    }
  }

  submitPlaceOrder(): void {
    if (this.isPlacingOrder()) return;

    if (this.orderPlacementType() === 'single') {
      const variantId = this.placeVariantId();
      const qty = Math.max(1, Number(this.placeQty()) || 1);
      if (!this.placeProductId()) {
        this.toast.show('Select a product from the catalog.', 'warning');
        return;
      }
      if (!this.placeShopId()) {
        this.toast.show('Selected product has no seller shop.', 'warning');
        return;
      }
      if (!variantId) {
        this.toast.show('Select a product variant.', 'warning');
        return;
      }

      this.isPlacingOrder.set(true);
      this.adminService.placeAdminOrder({
        productVariantId: variantId,
        quantity: qty,
        customerName: this.placeCustomerName().trim() || undefined,
        customerPhone: this.placeCustomerPhone().trim() || undefined,
        shippingAddress: this.placeAddress().trim() || undefined,
        city: this.placeCity().trim() || undefined,
        orderNotes: this.placeOrderNotes().trim() || 'Placed by Management'
      }).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (res) => {
          const wasPage = this.placeOrderMode() === 'page';
          this.toast.show(res?.message || 'Order placed successfully.', 'success');
          this.resetPlaceOrderForm();

          if (wasPage) {
            this.router.navigateByUrl('/orders').then(() => {
              this.placeOrderMode.set(null);
              this.isPlacingOrder.set(false);
              this.loadOrders();
            }).catch(() => {
              this.placeOrderMode.set(null);
              this.isPlacingOrder.set(false);
              this.loadOrders();
            });
          } else {
            this.placeOrderMode.set(null);
            this.isPlacingOrder.set(false);
            this.loadOrders();
          }
        },
        error: (err) => {
          this.isPlacingOrder.set(false);
          this.toast.show(err?.error?.error || 'Failed to place order.', 'error');
        }
      });
    } else {
      // Multiple items mode
      const items = this.multiOrderItems();
      if (items.length === 0) {
        this.toast.show('Please add at least one product to the order.', 'warning');
        return;
      }

      if (this.isAnyItemLoadingVariants()) {
        this.toast.show('Please wait, product variants are still being retrieved.', 'info');
        return;
      }

      const invalidItem = items.find(i => !i.variantId || i.hasVariantError);
      if (invalidItem) {
        this.toast.show(`Please select or retry variant for "${invalidItem.productName}".`, 'warning');
        return;
      }

      const payloadItems = items.map(i => ({
        productVariantId: i.variantId,
        quantity: i.quantity
      }));

      this.isPlacingOrder.set(true);
      this.adminService.placeAdminOrder({
        items: payloadItems,
        customerName: this.placeCustomerName().trim() || undefined,
        customerPhone: this.placeCustomerPhone().trim() || undefined,
        shippingAddress: this.placeAddress().trim() || undefined,
        city: this.placeCity().trim() || undefined,
        orderNotes: this.placeOrderNotes().trim() || 'Placed by Management'
      }).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (res) => {
          const wasPage = this.placeOrderMode() === 'page';
          this.toast.show(res?.message || 'Order placed successfully with multiple products!', 'success');
          this.resetPlaceOrderForm();

          if (wasPage) {
            this.router.navigateByUrl('/orders').then(() => {
              this.placeOrderMode.set(null);
              this.isPlacingOrder.set(false);
              this.loadOrders();
            }).catch(() => {
              this.placeOrderMode.set(null);
              this.isPlacingOrder.set(false);
              this.loadOrders();
            });
          } else {
            this.placeOrderMode.set(null);
            this.isPlacingOrder.set(false);
            this.loadOrders();
          }
        },
        error: (err) => {
          this.isPlacingOrder.set(false);
          this.toast.show(err?.error?.error || 'Failed to place multi-product order.', 'error');
        }
      });
    }
  }
}
