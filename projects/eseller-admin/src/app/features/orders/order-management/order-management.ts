import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import {
  AdminBrandDto,
  AdminCategoryDto,
  AdminOrderDto,
  AdminProductDto,
  AdminShopDto
} from '../../../core/models/admin.models';

type OrderTab = 'all' | 'pending' | 'confirmed' | 'processing' | 'ontheway' | 'delivered' | 'cancelled';
type PlaceOrderMode = 'modal' | 'page';

@Component({
  selector: 'app-order-management',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, FormsModule, SkeletonLayout],
  templateUrl: './order-management.html'
})
export class OrderManagement implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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

  // Filters & Sorting
  readonly activeTab = signal<OrderTab>('all');
  readonly selectedShopId = signal<string>('all');
  readonly sortOrder = signal<'newest' | 'oldest'>('newest');
  readonly searchTerm = signal<string>('');
  readonly actionInProgress = signal<string | null>(null);

  // Pagination
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 20, 50, 100];

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
  readonly placeShopId = signal<string>('');
  readonly placeCatalogProducts = signal<AdminProductDto[]>([]);
  readonly placeCategories = signal<AdminCategoryDto[]>([]);
  readonly placeBrands = signal<AdminBrandDto[]>([]);
  readonly placeFilterSearch = signal<string>('');
  readonly placeFilterShopId = signal<string>('all');
  readonly placeFilterCategoryId = signal<string>('all');
  readonly placeFilterBrandId = signal<string>('all');
  readonly placeProductId = signal<string>('');
  readonly placeSelectedProduct = signal<AdminProductDto | null>(null);
  readonly placeVariants = signal<{ id: string; sku: string; price: number; stockQty: number }[]>([]);
  readonly placeVariantId = signal<string>('');
  readonly placeQty = signal<number>(1);
  readonly placeCustomerName = signal<string>('Platform Admin');
  readonly placeCustomerPhone = signal<string>('');
  readonly placeAddress = signal<string>('');
  readonly placeCity = signal<string>('');
  readonly placeLoadingProducts = signal<boolean>(false);
  readonly placeLoadingVariants = signal<boolean>(false);

  readonly filteredPlaceProducts = computed(() => {
    let list = [...this.placeCatalogProducts()];
    const term = this.placeFilterSearch().trim().toLowerCase();
    const shopId = this.placeFilterShopId();
    const categoryId = this.placeFilterCategoryId();
    const brandId = this.placeFilterBrandId();

    if (shopId && shopId !== 'all') {
      const sid = shopId.toLowerCase();
      list = list.filter(p => String(p.shopId || '').toLowerCase() === sid);
    }
    if (categoryId && categoryId !== 'all') {
      list = list.filter(p => p.categoryId === categoryId);
    }
    if (brandId && brandId !== 'all') {
      list = list.filter(p => p.brandId === brandId);
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
    this.loadShops();
    this.loadOrders();
    this.route.queryParams.subscribe(params => {
      if (params['action'] === 'create') {
        if (this.placeOrderMode() !== 'page') {
          this.openPlaceOrder('page');
        }
      } else if (this.placeOrderMode() === 'page') {
        this.placeOrderMode.set(null);
      }
    });
  }

  loadShops(): void {
    this.adminService.getShops(1, 200).subscribe({
      next: (res) => {
        this.shops.set(res?.items || []);
      },
      error: () => {}
    });
  }

  loadOrders(): void {
    this.isLoading.set(true);
    const shopId = this.selectedShopId() !== 'all' ? this.selectedShopId() : undefined;
    this.adminService.getOrders(1, 500, undefined, shopId).subscribe({
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
    this.orderToDelete.set(order);
    this.isBatchDelete.set(false);
    this.deleteModalOpen.set(true);
  }

  openBatchDeleteModal(): void {
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

      forkJoin(requests).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.deleteModalOpen.set(false);
          this.toast.show(`Successfully deleted ${ids.length} orders.`, 'success');
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
      this.adminService.deleteOrder(order.id).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.deleteModalOpen.set(false);
          this.orderToDelete.set(null);

          const set = new Set(this.selectedOrderIds());
          set.delete(order.id);
          this.selectedOrderIds.set(set);

          this.toast.show(`Order #${order.orderNumber || order.id.slice(0, 8)} deleted permanently.`, 'info');
          this.loadOrders();
        },
        error: (err) => {
          this.isDeleting.set(false);
          this.toast.show(err?.error?.error || 'Failed to delete order.', 'error');
        }
      });
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  onFilterTabChange(tab: OrderTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
  }

  onShopChange(shopId: string): void {
    this.selectedShopId.set(shopId);
    this.currentPage.set(1);
    this.loadOrders();
  }

  onSortChange(sort: 'newest' | 'oldest'): void {
    this.sortOrder.set(sort);
    this.currentPage.set(1);
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
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
    const allowed = this.getNextStatusOptions(order.status).map(o => o.value);
    if (!allowed.includes(newStatus)) {
      this.toast.show('That status step is no longer available for this order.', 'error');
      if (selectEl) selectEl.value = '';
      return;
    }

    this.actionInProgress.set(order.id);
    this.adminService.updateOrderStatus(order.id, newStatus).subscribe({
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
    this.adminService.updateOrderPaymentStatus(order.id, 2).subscribe({
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
    this.adminService.getOrderStatusHistory(order.id).subscribe({
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

  openPlaceOrder(mode: PlaceOrderMode = 'modal'): void {
    this.placeOrderMode.set(mode);
    this.placeShopId.set('');
    this.placeCatalogProducts.set([]);
    this.placeCategories.set([]);
    this.placeBrands.set([]);
    this.placeFilterSearch.set('');
    this.placeFilterShopId.set('all');
    this.placeFilterCategoryId.set('all');
    this.placeFilterBrandId.set('all');
    this.placeSelectedProduct.set(null);
    this.placeProductId.set('');
    this.placeVariants.set([]);
    this.placeVariantId.set('');
    this.placeQty.set(1);
    this.placeCustomerName.set('Platform Admin');
    this.placeCustomerPhone.set('');
    this.placeAddress.set('');
    this.placeCity.set('');
    this.loadPlaceOrderCatalog();
  }

  loadPlaceOrderCatalog(): void {
    this.placeLoadingProducts.set(true);
    forkJoin({
      products: this.adminService.getApprovedSellerProducts(1, 500),
      categories: this.adminService.getCategories().pipe(catchError(() => of([] as AdminCategoryDto[]))),
      brands: this.adminService.getBrands().pipe(catchError(() => of([] as AdminBrandDto[])))
    }).subscribe({
      next: ({ products, categories, brands }) => {
        this.placeCatalogProducts.set(products?.items || []);
        this.placeCategories.set(categories || []);
        this.placeBrands.set(brands || []);
        this.placeLoadingProducts.set(false);
      },
      error: () => {
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
  }

  getPlaceProductImage(product: AdminProductDto): string {
    const url = product.primaryImageUrl || product.images?.[0]?.imageUrl || null;
    return this.formatImageUrl(url);
  }

  selectPlaceProduct(product: AdminProductDto): void {
    this.placeSelectedProduct.set(product);
    this.placeProductId.set(product.id);
    this.placeShopId.set(product.shopId || '');
    this.placeVariantId.set('');
    this.placeVariants.set([]);
    if (!product.id) return;

    this.placeLoadingVariants.set(true);
    this.adminService.getProductVariants(product.id).subscribe({
      next: (variants) => {
        const mapped = (variants || []).map((v: any) => ({
          id: v.id || v.variantId,
          sku: v.sku || 'SKU',
          price: Number(v.price) || 0,
          stockQty: Number(v.stockQty ?? v.stockQuantity) || 0
        }));
        this.placeVariants.set(mapped);
        if (mapped.length === 1) {
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

  closePlaceOrder(): void {
    if (this.isPlacingOrder()) return;
    const wasPage = this.placeOrderMode() === 'page';
    this.placeOrderMode.set(null);
    if (wasPage) {
      void this.router.navigate(['/orders'], { queryParams: {} });
    }
  }

  submitPlaceOrder(): void {
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
      customerName: this.placeCustomerName().trim() || 'Platform Admin',
      customerPhone: this.placeCustomerPhone().trim() || undefined,
      shippingAddress: this.placeAddress().trim() || undefined,
      city: this.placeCity().trim() || undefined,
      orderNotes: 'Placed by Management'
    }).subscribe({
      next: (res) => {
        this.isPlacingOrder.set(false);
        const wasPage = this.placeOrderMode() === 'page';
        this.placeOrderMode.set(null);
        this.toast.show(res?.message || 'Order placed successfully.', 'success');
        this.loadOrders();
        if (wasPage) {
          void this.router.navigate(['/orders'], { queryParams: {} });
        }
      },
      error: (err) => {
        this.isPlacingOrder.set(false);
        this.toast.show(err?.error?.error || 'Failed to place order.', 'error');
      }
    });
  }
}
