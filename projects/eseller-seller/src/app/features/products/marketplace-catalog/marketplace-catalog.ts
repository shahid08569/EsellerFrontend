import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, ToastService, ProductListDto, CategoryTreeDto, BrandDto, HomeService, PagedList } from 'eseller-shared';
import { SellerService, ShopDto } from '../../../core/services/seller.service';
import { SellerProductService } from '../../../core/services/product.service';
import { ImageUrlPipe } from '../../../shared/pipes/image-url.pipe';
import { TablePagination } from '../../../shared/components/table-pagination/table-pagination';

@Component({
  selector: 'app-marketplace-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ImageUrlPipe, TablePagination],
  templateUrl: './marketplace-catalog.html'
})
export class MarketplaceCatalog implements OnInit {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly homeService = inject(HomeService);
  private readonly sellerService = inject(SellerService);
  private readonly sellerProductService = inject(SellerProductService);

  readonly shop = signal<ShopDto | null>(null);
  readonly allProducts = signal<ProductListDto[]>([]);
  readonly mySellerProducts = signal<ProductListDto[]>([]);
  readonly myStoreProductIds = signal<Set<string>>(new Set());
  readonly pendingProductIds = signal<Set<string>>(new Set());
  readonly categories = signal<CategoryTreeDto[]>([]);
  readonly brands = signal<BrandDto[]>([]);

  readonly loading = signal<boolean>(true);
  readonly searchTerm = signal<string>('');
  readonly selectedCategory = signal<string>('all');
  readonly selectedBrand = signal<string>('all');
  readonly sortBy = signal<string>('featured');

  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 25, 50];

  readonly requestingProductId = signal<string | null>(null);
  readonly showPendingVerificationModal = signal<boolean>(false);
  readonly requestSuccessProduct = signal<ProductListDto | null>(null);

  readonly productLimit = computed(() => this.shop()?.maxProductLimit || 200);
  readonly usedSlots = computed(() => this.myStoreProductIds().size + this.pendingProductIds().size);

  readonly filteredProducts = computed(() => {
    let list = [...this.allProducts()];
    const search = this.searchTerm().trim().toLowerCase();
    const cat = this.selectedCategory();
    const brand = this.selectedBrand();

    if (search) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(search) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(search)) ||
        (p.brandName && p.brandName.toLowerCase().includes(search))
      );
    }

    if (cat !== 'all') {
      list = list.filter(p => (p.categoryName || '').toLowerCase() === cat.toLowerCase());
    }

    if (brand !== 'all') {
      list = list.filter(p => (p.brandName || '').toLowerCase() === brand.toLowerCase());
    }

    return list;
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredProducts().length / this.pageSize())));

  readonly pagedProducts = computed(() => {
    const list = this.filteredProducts();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  onFilterChange(): void {
    this.currentPage.set(1);
  }

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loading.set(true);

    this.sellerService.getMyShop(true).subscribe({
      next: (shop) => {
        this.shop.set(shop);
        if (shop?.id) {
          this.sellerProductService.getSellerProducts(shop.id, 1, 500).subscribe({
            next: (res) => {
              this.mySellerProducts.set(res.items || []);
              this.syncStoreProductState();
            },
            error: () => {}
          });
        }
      },
      error: () => {}
    });

    this.homeService.getCategories(true).subscribe({
      next: (cats) => this.categories.set(cats || []),
      error: () => {}
    });

    this.homeService.getBrands().subscribe({
      next: (b) => this.brands.set(b || []),
      error: () => {}
    });

    this.api.get<PagedList<ProductListDto>>('/Products/catalog?pageNumber=1&pageSize=500').subscribe({
      next: (res) => {
        this.allProducts.set(res.items || []);
        this.syncStoreProductState();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.show('Failed to load marketplace catalog', 'error');
      }
    });
  }

  getCommission(price: number): number {
    return Math.round((Number(price) || 0) * 0.20);
  }

  private syncStoreProductState(): void {
    const approvedSourceIds = new Set<string>();
    const pendingSourceIds = new Set<string>();

    for (const p of this.mySellerProducts()) {
      const sourceId = p.sourceProductId || '';
      if (!sourceId) continue;
      if (p.isApproved) {
        approvedSourceIds.add(sourceId);
      } else if (!p.rejectionReason) {
        pendingSourceIds.add(sourceId);
      }
    }

    const approvedIds = new Set<string>();
    const pendingIds = new Set<string>();
    for (const wp of this.allProducts()) {
      if (approvedSourceIds.has(wp.id)) approvedIds.add(wp.id);
      else if (pendingSourceIds.has(wp.id)) pendingIds.add(wp.id);
    }

    this.myStoreProductIds.set(approvedIds);
    this.pendingProductIds.set(pendingIds);
  }

  requestToSell(product: ProductListDto): void {
    const shop = this.shop();
    if (!shop) {
      this.toast.show('Merchant shop profile not loaded. Please refresh.', 'error');
      return;
    }

    if (!shop.isApproved) {
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

    const limit = this.productLimit();
    if (this.usedSlots() >= limit) {
      this.toast.show(
        `Package capacity reached (${limit} products). Upgrade your plan to list more.`,
        'warning'
      );
      return;
    }

    this.requestingProductId.set(product.id);

    this.api.post<{ productId: string; isPendingApproval?: boolean; message: string }>('/Products/add-to-store', {
      sourceProductId: product.id,
      shopId: shop.id
    }).subscribe({
      next: (res) => {
        this.requestingProductId.set(null);
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
        this.requestingProductId.set(null);
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

  isAddedToStore(id: string): boolean {
    return this.myStoreProductIds().has(id);
  }

  isPendingApproval(id: string): boolean {
    return this.pendingProductIds().has(id);
  }

  closePendingVerificationModal(): void {
    this.showPendingVerificationModal.set(false);
  }

  contactSupport(): void {
    this.showPendingVerificationModal.set(false);
    this.router.navigateByUrl('/chat');
  }
}
