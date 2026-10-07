import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink, Params } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  HomeService,
  ProductListDto,
  CategoryTreeDto,
  BrandDto,
  GetProductsQuery,
  PagedList,
  ProductCard,
  EmptyState,
  filterBrandsForCategory,
  SkeletonLayout
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
  selector: 'app-category-detail',
  imports: [
    CommonModule,
    ProductCard,
    EmptyState,
    ProductFilterSidebar,
    ProductSortBar,
    ProductListCard,
    ProductPagination,
    SkeletonLayout
  ],
  templateUrl: './category-detail.html',
  styleUrl: './category-detail.css'
})
export class CategoryDetail implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly homeService = inject(HomeService);

  private routeSub: Subscription | null = null;
  private querySub: Subscription | null = null;
  private hasInitialized = false;

  // Active Category Data
  readonly currentSlug = signal<string>('');
  readonly category = signal<CategoryTreeDto | null>(null);
  readonly parentCategory = signal<CategoryTreeDto | null>(null);
  readonly allCategories = signal<CategoryTreeDto[]>([]);
  readonly brands = signal<BrandDto[]>([]);

  // Products Data
  readonly products = signal<ProductListDto[]>([]);
  readonly loading = signal<boolean>(true);
  readonly loadingCategory = signal<boolean>(true);
  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly mobileFilterOpen = signal<boolean>(false);

  // Pagination
  readonly totalCount = signal<number>(0);
  readonly pageNumber = signal<number>(1);
  readonly pageSize = signal<number>(12);
  readonly totalPages = signal<number>(1);

  // Active filters
  readonly selectedBrandId = signal<string | null>(null);
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly minRating = signal<number | null>(null);
  readonly isFeatured = signal<boolean | null>(null);
  readonly sortBy = signal<string>('newest');

  // Subcategories
  readonly subcategories = computed(() => {
    const cat = this.category();
    if (!cat) return [];
    return cat.children || [];
  });

  // Filtered brands relevant to active category
  readonly categoryBrands = computed(() =>
    filterBrandsForCategory(this.brands(), this.category()?.slug, this.products())
  );

  readonly activeChips = computed<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];

    const brand = this.brands().find((b) => b.id === this.selectedBrandId());
    if (brand) {
      chips.push({
        id: 'brand',
        type: 'brand',
        label: `Brand: ${brand.name}`
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

    if (this.isFeatured() === true) {
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
    if (typeof window !== 'undefined' && !this.hasInitialized) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      this.hasInitialized = true;
    }

    // 1. Fetch metadata
    this.homeService.getCategories().subscribe({
      next: (tree) => {
        this.allCategories.set(tree);
        // Find category once tree is ready
        this.resolveCategoryFromTree(tree, this.currentSlug());
      }
    });

    this.homeService.getBrands().subscribe({
      next: (b) => this.brands.set(b)
    });

    // 2. Subscribe to route param slug changes
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') || '';
      this.currentSlug.set(slug);

      if (this.allCategories().length > 0) {
        this.resolveCategoryFromTree(this.allCategories(), slug);
      }
    });

    // 3. Subscribe to query param filters
    this.querySub = this.route.queryParams.subscribe((queryParams) => {
      this.syncStateFromParams(queryParams);
      if (this.category()) {
        this.loadProducts();
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.querySub?.unsubscribe();
  }

  private resolveCategoryFromTree(tree: CategoryTreeDto[], slug: string): void {
    if (!slug) return;
    this.loadingCategory.set(true);

    let match: CategoryTreeDto | null = null;
    let parent: CategoryTreeDto | null = null;

    for (const root of tree) {
      if (root.slug.toLowerCase() === slug.toLowerCase()) {
        match = root;
        break;
      }
      if (root.children && root.children.length > 0) {
        for (const child of root.children) {
          if (child.slug.toLowerCase() === slug.toLowerCase()) {
            match = child;
            parent = root;
            break;
          }
        }
      }
      if (match) break;
    }

    this.category.set(match);
    this.parentCategory.set(parent);
    this.loadingCategory.set(false);

    if (match) {
      this.loadProducts();
    } else {
      this.loading.set(false);
    }
  }

  private syncStateFromParams(params: Params): void {
    this.selectedBrandId.set(params['brandId'] || params['brand'] || null);

    const minP = params['minPrice'] != null ? Number(params['minPrice']) : null;
    this.minPrice.set(!isNaN(minP as number) ? minP : null);

    const maxP = params['maxPrice'] != null ? Number(params['maxPrice']) : null;
    this.maxPrice.set(!isNaN(maxP as number) ? maxP : null);

    const minR = params['minRating'] != null ? Number(params['minRating']) : null;
    this.minRating.set(!isNaN(minR as number) ? minR : null);

    const isFeat = params['isFeatured'];
    this.isFeatured.set(isFeat === 'true' ? true : null);

    this.sortBy.set(params['sortBy'] || 'newest');

    const page = Number(params['page'] || params['pageNumber'] || 1);
    this.pageNumber.set(!isNaN(page) && page > 0 ? page : 1);
  }

  loadProducts(): void {
    const cat = this.category();
    if (!cat) return;

    this.loading.set(true);

    const query: GetProductsQuery = {
      categoryId: cat.id,
      brandId: this.selectedBrandId(),
      minPrice: this.minPrice(),
      maxPrice: this.maxPrice(),
      minRating: this.minRating(),
      isFeatured: this.isFeatured(),
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
    this.mobileFilterOpen.set(false);
    if (!categoryId) {
      this.router.navigate(['/products']);
      return;
    }
    const target = this.findCategoryById(this.allCategories(), categoryId);
    if (target && target.slug) {
      this.router.navigate(['/categories', target.slug]);
    } else {
      this.router.navigate(['/products'], { queryParams: { categoryId } });
    }
  }

  private findCategoryById(tree: CategoryTreeDto[], id: string): CategoryTreeDto | null {
    for (const cat of tree) {
      if (cat.id === id) return cat;
      if (cat.children && cat.children.length > 0) {
        const found = this.findCategoryById(cat.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  private scrollToCatalogTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  onBrandChange(brandId: string | null): void {
    this.updateQueryParams({ brandId: brandId || null, page: 1 });
    this.scrollToCatalogTop();
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

  getImageUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    const apiBase =
      ((typeof window !== 'undefined' ? (window as any).__ESELLER_API_URL__ : '') as string) ||
      'https://localhost:7127/api/v1';
    const host = apiBase.replace(/\/api\/v1\/?$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    if (path.startsWith('/uploads/')) return `${host}${path}`;
    return `${host}/uploads${path}`;
  }
}
