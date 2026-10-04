import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  HomeService,
  ProductListDto,
  CategoryTreeDto,
  BrandDto,
  GetProductsQuery,
  PagedList,
  ProductCard,
  EmptyState
} from 'eseller-shared';

import {
  ProductFilterSidebar,
  PriceRange
} from '../../products/components/product-filter-sidebar/product-filter-sidebar';
import {
  ProductSortBar,
  ActiveFilterChip
} from '../../products/components/product-sort-bar/product-sort-bar';
import { ProductListCard } from '../../products/components/product-list-card/product-list-card';
import { ProductPagination } from '../../products/components/product-pagination/product-pagination';

@Component({
  selector: 'app-brand-detail',
  imports: [
    CommonModule,
    ProductCard,
    EmptyState,
    ProductFilterSidebar,
    ProductSortBar,
    ProductListCard,
    ProductPagination
  ],
  templateUrl: './brand-detail.html',
  styleUrl: './brand-detail.css'
})
export class BrandDetail implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly homeService = inject(HomeService);

  private routeSub: Subscription | null = null;
  private querySub: Subscription | null = null;

  // Active Brand Data
  readonly currentSlug = signal<string>('');
  readonly brand = signal<BrandDto | null>(null);
  readonly allBrands = signal<BrandDto[]>([]);
  readonly categories = signal<CategoryTreeDto[]>([]);

  // Products Data
  readonly products = signal<ProductListDto[]>([]);
  readonly loading = signal<boolean>(true);
  readonly loadingBrand = signal<boolean>(true);
  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly mobileFilterOpen = signal<boolean>(false);

  // Pagination
  readonly totalCount = signal<number>(0);
  readonly pageNumber = signal<number>(1);
  readonly pageSize = signal<number>(12);
  readonly totalPages = signal<number>(1);

  // Active filters
  readonly selectedCategoryId = signal<string | null>(null);
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly minRating = signal<number | null>(null);
  readonly isFeatured = signal<boolean | null>(null);
  readonly sortBy = signal<string>('newest');

  readonly activeChips = computed<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];

    const category = this.categories().find((c) => c.id === this.selectedCategoryId());
    if (category) {
      chips.push({
        id: 'category',
        type: 'category',
        label: `Category: ${category.name}`
      });
    }

    const min = this.minPrice();
    const max = this.maxPrice();
    if (min != null || max != null) {
      let label = 'Price: ';
      if (min != null && max != null) {
        label += `$ ${min.toLocaleString()} – $ ${max.toLocaleString()}`;
      } else if (min != null) {
        label += `Above $ ${min.toLocaleString()}`;
      } else if (max != null) {
        label += `Up to $ ${max.toLocaleString()}`;
      }
      chips.push({ id: 'price', type: 'price', label });
    }

    const rating = this.minRating();
    if (rating != null) {
      chips.push({
        id: 'rating',
        type: 'rating',
        label: `${rating}★ & above`
      });
    }

    if (this.isFeatured()) {
      chips.push({
        id: 'featured',
        type: 'featured',
        label: 'Featured Only'
      });
    }

    return chips;
  });

  readonly activeFiltersCount = computed(() => this.activeChips().length);

  ngOnInit(): void {
    // 1. Fetch metadata
    this.homeService.getCategories().subscribe({
      next: (tree) => this.categories.set(tree)
    });

    this.homeService.getBrands().subscribe({
      next: (bList) => {
        this.allBrands.set(bList);
        this.resolveBrand(bList, this.currentSlug());
      }
    });

    // 2. Subscribe to route param slug changes
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') || '';
      this.currentSlug.set(slug);

      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }

      if (this.allBrands().length > 0) {
        this.resolveBrand(this.allBrands(), slug);
      }
    });

    // 3. Subscribe to query param filters
    this.querySub = this.route.queryParams.subscribe((queryParams) => {
      this.syncStateFromParams(queryParams);
      if (this.brand()) {
        this.loadProducts();
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.querySub?.unsubscribe();
  }

  private resolveBrand(bList: BrandDto[], slug: string): void {
    if (!slug) return;
    this.loadingBrand.set(true);

    const match = bList.find((b) => b.slug.toLowerCase() === slug.toLowerCase()) || null;
    this.brand.set(match);
    this.loadingBrand.set(false);

    if (match) {
      this.loadProducts();
    } else {
      this.loading.set(false);
    }
  }

  private syncStateFromParams(params: Params): void {
    this.selectedCategoryId.set(params['categoryId'] || params['category'] || null);

    const minP = params['minPrice'] != null ? Number(params['minPrice']) : null;
    this.minPrice.set(!isNaN(minP as number) ? minP : null);

    const maxP = params['maxPrice'] != null ? Number(params['maxPrice']) : null;
    this.maxPrice.set(!isNaN(maxP as number) ? maxP : null);

    const minR = params['minRating'] != null ? Number(params['minRating']) : null;
    this.minRating.set(!isNaN(minR as number) ? minR : null);

    this.isFeatured.set(params['isFeatured'] === 'true' ? true : null);

    this.sortBy.set(params['sortBy'] || 'newest');

    const page = Number(params['page'] || params['pageNumber'] || 1);
    this.pageNumber.set(!isNaN(page) && page > 0 ? page : 1);
  }

  loadProducts(): void {
    const b = this.brand();
    if (!b) return;

    this.loading.set(true);

    const query: GetProductsQuery = {
      brandId: b.id,
      categoryId: this.selectedCategoryId(),
      minPrice: this.minPrice(),
      maxPrice: this.maxPrice(),
      minRating: this.minRating(),
      isFeatured: this.isFeatured() ?? undefined,
      sortBy: (this.sortBy() as any) || 'newest',
      pageNumber: this.pageNumber(),
      pageSize: this.pageSize()
    };

    this.homeService.getProducts(query).subscribe({
      next: (res: PagedList<ProductListDto>) => {
        this.products.set(res.items);
        this.totalCount.set(res.totalCount);
        this.pageNumber.set(res.pageNumber);
        this.pageSize.set(res.pageSize);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.products.set([]);
        this.loading.set(false);
      }
    });
  }

  // ============================================================
  // FILTER EVENT HANDLERS
  // ============================================================
  onCategoryChange(categoryId: string | null): void {
    this.updateQueryParams({ categoryId: categoryId || null, page: 1 });
  }

  onBrandChange(brandId: string | null): void {
    if (!brandId) {
      this.router.navigate(['/brands']);
      return;
    }
    const b = this.allBrands().find((x) => x.id === brandId);
    if (b) {
      this.router.navigate(['/brands', b.slug]);
    }
  }

  private scrollToCatalogTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  onPriceChange(range: PriceRange): void {
    this.updateQueryParams({
      minPrice: range.minPrice != null ? range.minPrice : null,
      maxPrice: range.maxPrice != null ? range.maxPrice : null,
      page: 1
    });
    this.scrollToCatalogTop();
  }

  onRatingChange(rating: number | null): void {
    this.updateQueryParams({ minRating: rating || null, page: 1 });
    this.scrollToCatalogTop();
  }

  onFeaturedChange(featured: boolean | null): void {
    this.updateQueryParams({ isFeatured: featured ? 'true' : null, page: 1 });
    this.scrollToCatalogTop();
  }

  onSortChange(sortBy: string): void {
    this.updateQueryParams({ sortBy, page: 1 });
    this.scrollToCatalogTop();
  }

  onViewModeChange(mode: 'grid' | 'list'): void {
    this.viewMode.set(mode);
  }

  onPageChange(page: number): void {
    this.updateQueryParams({ page });
    this.scrollToCatalogTop();
  }

  onRemoveChip(chip: ActiveFilterChip): void {
    if (chip.type === 'category') this.onCategoryChange(null);
    if (chip.type === 'brand') this.onBrandChange(null);
    if (chip.type === 'price') this.onPriceChange({ minPrice: null, maxPrice: null });
    if (chip.type === 'rating') this.onRatingChange(null);
    if (chip.type === 'featured') this.onFeaturedChange(null);
    this.scrollToCatalogTop();
  }

  onClearAll(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {}
    });
    this.scrollToCatalogTop();
  }

  toggleMobileFilter(): void {
    this.mobileFilterOpen.update((v) => !v);
  }

  private updateQueryParams(newParams: Params): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: newParams,
      queryParamsHandling: 'merge'
    });
  }

  getLogoUrl(logoUrl: string | null | undefined): string | null {
    if (!logoUrl) return null;
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://') || logoUrl.startsWith('data:') || logoUrl.startsWith('blob:')) {
      return logoUrl;
    }
    const apiBase =
      ((typeof window !== 'undefined' ? (window as any).__ESELLER_API_URL__ : '') as string) ||
      'https://localhost:7127/api/v1';
    const host = apiBase.replace(/\/api\/v1\/?$/, '');
    const path = logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`;
    if (path.startsWith('/uploads/')) return `${host}${path}`;
    return `${host}/uploads${path}`;
  }
}
