import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SellerProductService } from '../../../core/services/product.service';
import { SellerService, ShopDto } from '../../../core/services/seller.service';
import { ProductListDto, PagedList, ToastService, HomeService, CategoryTreeDto, BrandDto, ChatService, SkeletonLayout } from 'eseller-shared';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';
import { TablePagination } from '../../../shared/components/table-pagination/table-pagination';
import { ImageUrlPipe } from '../../../shared/pipes/image-url.pipe';

export type SortOption = 'newest' | 'oldest' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';
export type ProductOriginTab = 'own' | 'warehouse';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ConfirmModal, TablePagination, ImageUrlPipe, SkeletonLayout],
  templateUrl: './product-list.html'
})
export class ProductList implements OnInit {
  private readonly productService = inject(SellerProductService);
  private readonly sellerService = inject(SellerService);
  private readonly homeService = inject(HomeService);
  private readonly chatService = inject(ChatService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly shop = signal<ShopDto | null>(null);
  readonly products = signal<ProductListDto[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly categories = signal<CategoryTreeDto[]>([]);
  readonly brands = signal<BrandDto[]>([]);

  // Filters State
  readonly searchTerm = signal<string>('');
  readonly selectedCategory = signal<string>('all');
  readonly selectedBrand = signal<string>('all');
  /** Own creations vs warehouse clones (SourceProductId) */
  readonly originTab = signal<ProductOriginTab>('own');
  // Default: show all statuses within the selected origin
  readonly selectedStatus = signal<string>('all');
  readonly sortBy = signal<SortOption>('newest');

  readonly ownCount = computed(() =>
    this.products().filter(p => !p.sourceProductId).length
  );
  readonly warehouseCount = computed(() =>
    this.products().filter(p => !!p.sourceProductId).length
  );

  // Pagination State
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 25, 50];

  // Delete / Remove Modal State
  readonly productToDelete = signal<{ id: string; name: string } | null>(null);
  readonly isDeleting = signal<boolean>(false);

  // Computed: Filtered and Sorted Products
  readonly filteredProducts = computed(() => {
    let list = [...this.products()];
    const search = this.searchTerm().trim().toLowerCase();
    const cat = this.selectedCategory();
    const brand = this.selectedBrand();
    const status = this.selectedStatus();
    const sort = this.sortBy();
    const origin = this.originTab();

    // 0. Origin: own (no source) vs warehouse listing (has sourceProductId)
    if (origin === 'own') {
      list = list.filter(p => !p.sourceProductId);
    } else {
      list = list.filter(p => !!p.sourceProductId);
    }

    // 1. Search Query
    if (search) {
      list = list.filter(p => 
        p.name.toLowerCase().includes(search) || 
        (p.categoryName && p.categoryName.toLowerCase().includes(search)) ||
        (p.brandName && p.brandName.toLowerCase().includes(search)) ||
        (p.slug && p.slug.toLowerCase().includes(search))
      );
    }

    // 2. Category Filter
    if (cat !== 'all') {
      list = list.filter(p => (p.categoryName || '').toLowerCase() === cat.toLowerCase());
    }

    // 3. Brand Filter
    if (brand !== 'all') {
      list = list.filter(p => (p.brandName || '').toLowerCase() === brand.toLowerCase());
    }

    // 4. Status Filter
    if (status !== 'all') {
      if (status === 'approved') {
        list = list.filter(p => p.isApproved);
      } else if (status === 'pending') {
        list = list.filter(p => !p.isApproved && !p.rejectionReason);
      } else if (status === 'rejected') {
        list = list.filter(p => !p.isApproved && !!p.rejectionReason);
      }
    }

    // 5. Sorting
    list.sort((a, b) => {
      switch (sort) {
        case 'newest': {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        }
        case 'oldest': {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        }
        case 'price-asc':
          return (a.basePrice || 0) - (b.basePrice || 0);
        case 'price-desc':
          return (b.basePrice || 0) - (a.basePrice || 0);
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    return list;
  });

  // Computed: Total pages based on filtered results
  readonly totalPages = computed(() => {
    const total = this.filteredProducts().length;
    const size = this.pageSize();
    return Math.max(1, Math.ceil(total / size));
  });

  // Computed: Paged Slice for the current view
  readonly pagedProducts = computed(() => {
    const all = this.filteredProducts();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return all.slice(start, start + size);
  });

  ngOnInit() {
    this.loadFilterOptions();

    this.route.queryParamMap.subscribe(params => {
      const search = params.get('search') || params.get('categoryName');
      if (search) {
        this.searchTerm.set(search);
      }
      const st = params.get('status');
      if (st && ['all', 'approved', 'pending', 'rejected'].includes(st.toLowerCase())) {
        this.selectedStatus.set(st.toLowerCase());
      }
    });

    this.loadProducts();
  }

  loadFilterOptions() {
    this.homeService.getCategories(true).subscribe({
      next: (cats) => this.categories.set(cats || []),
      error: () => {}
    });

    this.homeService.getBrands().subscribe({
      next: (b) => this.brands.set(b || []),
      error: () => {}
    });
  }

  loadProducts() {
    this.isLoading.set(true);
    this.sellerService.getMyShop().subscribe({
      next: (shop) => {
        this.shop.set(shop);
        const shopId = shop?.id;
        if (!shopId) {
          this.isLoading.set(false);
          this.products.set([]);
          return;
        }

        // Fetch this shopkeeper's active listed products
        this.productService.getSellerProducts(shopId, 1, 200).subscribe({
          next: (res: PagedList<ProductListDto>) => {
            this.products.set(res.items || []);
            this.isLoading.set(false);
          },
          error: () => {
            this.isLoading.set(false);
            this.toast.show('Failed to load your shop products', 'error');
          }
        });
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.show('Failed to load merchant profile', 'error');
      }
    });
  }

  getCommission(price: number): number {
    return Math.round((Number(price) || 0) * 0.20);
  }

  chatWithAdmin(product: ProductListDto): void {
    this.chatService.getShopSupportSession(product.id).subscribe({
      next: (res) => {
        this.toast.show(`Opened Management chat for “${product.name}”`, 'success');
        this.router.navigate(['/chat'], {
          queryParams: { support: res.orderRequestId, productId: product.id }
        });
      },
      error: (err) => {
        this.toast.show(err?.error?.error || 'Failed to open Management chat', 'error');
      }
    });
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  resetFilters() {
    this.searchTerm.set('');
    this.selectedCategory.set('all');
    this.selectedBrand.set('all');
    this.selectedStatus.set('all');
    this.sortBy.set('newest');
    this.currentPage.set(1);
  }

  onOriginTabChange(tab: ProductOriginTab) {
    this.originTab.set(tab);
    this.currentPage.set(1);
  }

  onFilterChange() {
    this.currentPage.set(1);
  }

  isOwnProduct(p: ProductListDto): boolean {
    return !p.sourceProductId;
  }

  promptDelete(id: string, name: string) {
    this.productToDelete.set({ id, name });
  }

  cancelDelete() {
    this.productToDelete.set(null);
  }

  confirmDelete() {
    const target = this.productToDelete();
    if (!target) return;

    this.isDeleting.set(true);
    this.productService.deleteProduct(target.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.productToDelete.set(null);
        this.toast.show(`"${target.name}" removed from your store successfully.`, 'success');
        this.loadProducts();
      },
      error: (err) => {
        this.isDeleting.set(false);
        const msg = err.error?.error || err.error?.message || err.message || 'Failed to remove product from store';
        this.toast.show(msg, 'error');
      }
    });
  }
}
