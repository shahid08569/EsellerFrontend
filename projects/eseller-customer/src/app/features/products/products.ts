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
  PreferredBadge,
  EmptyState,
  CartService,
  WishlistService,
  CompareService,
  filterBrandsForCategory
} from 'eseller-shared';

import {
  ProductFilterSidebar,
  PriceRange
} from './components/product-filter-sidebar/product-filter-sidebar';
import {
  ProductSortBar,
  ActiveFilterChip
} from './components/product-sort-bar/product-sort-bar';
import { ProductListCard } from './components/product-list-card/product-list-card';
import { ProductPagination } from './components/product-pagination/product-pagination';

@Component({
  selector: 'app-products',
  imports: [
    CommonModule,
    ProductCard,
    EmptyState,
    ProductFilterSidebar,
    ProductSortBar,
    ProductListCard,
    ProductPagination
  ],
  templateUrl: './products.html',
  styleUrl: './products.css'
})
export class Products implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly homeService = inject(HomeService);
  readonly cartService = inject(CartService);
  readonly wishlistService = inject(WishlistService);
  readonly compareService = inject(CompareService);

  private querySub: Subscription | null = null;

  // Data signals
  readonly products = signal<ProductListDto[]>([]);
  readonly categories = signal<CategoryTreeDto[]>([]);
  readonly brands = signal<BrandDto[]>([]);

  // State signals
  readonly loading = signal<boolean>(true);
  readonly loadingFilters = signal<boolean>(true);
  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly mobileFilterOpen = signal<boolean>(false);
  readonly feedbackMessage = signal<string | null>(null);

  // Pagination signals
  readonly totalCount = signal<number>(0);
  readonly pageNumber = signal<number>(1);
  readonly pageSize = signal<number>(12);
  readonly totalPages = signal<number>(1);

  // Active filters signals
  readonly selectedCategoryId = signal<string | null>(null);
  readonly selectedBrandId = signal<string | null>(null);
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly minRating = signal<number | null>(null);
  readonly search = signal<string | null>(null);
  readonly isFeatured = signal<boolean | null>(null);
  readonly sortBy = signal<string>('newest');

  // Dedicated collection signals
  readonly collectionType = signal<'new-arrivals' | 'featured' | 'hot-selling' | 'best-selling' | null>(null);
  readonly customCollectionTitle = signal<string | null>(null);
  readonly customCollectionSubtitle = signal<string | null>(null);

  // Computeds
  readonly selectedCategory = computed(() => {
    const id = this.selectedCategoryId();
    if (!id) return null;
    return this.findCategoryInTree(this.categories(), id);
  });

  readonly availableBrands = computed(() =>
    filterBrandsForCategory(this.brands(), this.selectedCategory()?.slug, this.products())
  );

  readonly selectedBrand = computed(() => {
    const id = this.selectedBrandId();
    if (!id) return null;
    return this.brands().find((b) => b.id === id) ?? null;
  });

  readonly activeChips = computed<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];

    const querySearch = this.search();
    if (querySearch && querySearch.trim()) {
      chips.push({
        id: 'search',
        type: 'search',
        label: `"${querySearch.trim()}"`
      });
    }

    const cat = this.selectedCategory();
    if (cat) {
      chips.push({
        id: 'category',
        type: 'category',
        label: cat.name
      });
    }

    const brand = this.selectedBrand();
    if (brand) {
      chips.push({
        id: 'brand',
        type: 'brand',
        label: brand.name
      });
    }

    const min = this.minPrice();
    const max = this.maxPrice();
    if (min != null || max != null) {
      let label = 'Price: ';
      if (min != null && max != null) {
        label += `Rs. ${min.toLocaleString()} – Rs. ${max.toLocaleString()}`;
      } else if (min != null) {
        label += `Above Rs. ${min.toLocaleString()}`;
      } else if (max != null) {
        label += `Up to Rs. ${max.toLocaleString()}`;
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

  readonly pageTitle = computed(() => {
    if (this.customCollectionTitle()) return this.customCollectionTitle()!;
    if (this.search()) return `Search: "${this.search()}"`;
    if (this.selectedCategory()) return this.selectedCategory()!.name;
    if (this.selectedBrand()) return this.selectedBrand()!.name;
    if (this.isFeatured()) return 'Featured Products';
    return 'All Products';
  });

  readonly pageSubtitle = computed(() => {
    if (this.customCollectionSubtitle()) return this.customCollectionSubtitle()!;
    if (this.selectedCategory()) {
      return `Browse authentic products in ${this.selectedCategory()!.name} with direct chat order confirmation`;
    }
    return 'Explore our collection of authentic products from verified sellers';
  });

  readonly preferredBadge = computed<PreferredBadge>(() => {
    const col = this.collectionType();
    if (col === 'new-arrivals') return 'new';
    if (col === 'featured') return 'featured';
    if (col === 'hot-selling') return 'hot';
    if (col === 'best-selling') return 'best_seller';
    if (this.isFeatured()) return 'featured';
    return null;
  });

  ngOnInit(): void {
    // Check route data for collection pages (e.g. /new-arrivals, /featured, /hot-selling, /best-selling)
    const routeData = this.route.snapshot.data;
    if (routeData && routeData['collection']) {
      this.collectionType.set(routeData['collection']);
      this.customCollectionTitle.set(routeData['title'] || null);
      this.customCollectionSubtitle.set(routeData['subtitle'] || null);
      if (routeData['collection'] === 'featured') {
        this.isFeatured.set(true);
      } else if (routeData['collection'] === 'new-arrivals') {
        this.sortBy.set('newest');
      } else if (routeData['collection'] === 'hot-selling' || routeData['collection'] === 'best-selling') {
        this.sortBy.set('popular');
      }
    }

    // 1. Fetch filter metadata (categories, brands)
    this.loadFilterMetadata();

    // 2. Subscribe to query parameters
    this.querySub = this.route.queryParams.subscribe((params) => {
      this.syncStateFromParams(params);
      this.loadProducts();
    });
  }

  ngOnDestroy(): void {
    if (this.querySub) {
      this.querySub.unsubscribe();
      this.querySub = null;
    }
  }

  // ============================================================
  // LOAD FILTER METADATA
  // ============================================================
  private loadFilterMetadata(): void {
    this.homeService.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.loadingFilters.set(false);
      },
      error: () => this.loadingFilters.set(false)
    });

    this.homeService.getBrands().subscribe({
      next: (b) => this.brands.set(b),
      error: () => {}
    });
  }

  private findCategoryInTree(tree: CategoryTreeDto[], id: string): CategoryTreeDto | null {
    for (const cat of tree) {
      if (cat.id === id) return cat;
      if (cat.children && cat.children.length > 0) {
        const found = this.findCategoryInTree(cat.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  // ============================================================
  // SYNC STATE FROM URL
  // ============================================================
  private syncStateFromParams(params: Params): void {
    this.selectedCategoryId.set(params['categoryId'] || params['category'] || null);
    this.selectedBrandId.set(params['brandId'] || params['brand'] || null);

    const minP = params['minPrice'] != null ? Number(params['minPrice']) : null;
    this.minPrice.set(!isNaN(minP as number) ? minP : null);

    const maxP = params['maxPrice'] != null ? Number(params['maxPrice']) : null;
    this.maxPrice.set(!isNaN(maxP as number) ? maxP : null);

    const minR = params['minRating'] != null ? Number(params['minRating']) : null;
    this.minRating.set(!isNaN(minR as number) ? minR : null);

    this.search.set(params['search'] || params['q'] || null);
    const col = this.collectionType();
    if (params['isFeatured'] != null) {
      this.isFeatured.set(params['isFeatured'] === 'true');
    } else if (col === 'featured') {
      this.isFeatured.set(true);
    }

    if (params['sortBy']) {
      this.sortBy.set(params['sortBy']);
    } else if (col === 'new-arrivals') {
      this.sortBy.set('newest');
    } else if (col === 'hot-selling' || col === 'best-selling') {
      this.sortBy.set('popular');
    }

    const page = Number(params['page'] || params['pageNumber'] || 1);
    this.pageNumber.set(!isNaN(page) && page > 0 ? page : 1);
  }

  // ============================================================
  // LOAD PRODUCTS
  // ============================================================
  loadProducts(): void {
    this.loading.set(true);

    const col = this.collectionType();
    const query: GetProductsQuery = {
      categoryId: this.selectedCategoryId(),
      brandId: this.selectedBrandId(),
      minPrice: this.minPrice(),
      maxPrice: this.maxPrice(),
      minRating: this.minRating(),
      search: this.search(),
      isFeatured: col === 'featured' ? true : this.isFeatured(),
      sortBy: (this.sortBy() as any) || (col === 'new-arrivals' ? 'newest' : col === 'hot-selling' || col === 'best-selling' ? 'popular' : 'newest'),
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
        this.totalCount.set(0);
        this.loading.set(false);
      }
    });
  }

  // ============================================================
  // URL PARAMS UPDATE
  // ============================================================
  private updateQueryParams(newParams: Partial<Record<string, any>>): void {
    const currentParams = { ...this.route.snapshot.queryParams };
    const merged = { ...currentParams, ...newParams };

    // Clean up null/undefined/empty
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(merged)) {
      if (value !== null && value !== undefined && value !== '') {
        cleaned[key] = value;
      }
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: cleaned,
      queryParamsHandling: ''
    });
  }

  // ============================================================
  // FILTER ACTIONS & CATALOG SCROLL
  // ============================================================
  private scrollToCatalogTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  onCategoryChange(categoryId: string | null): void {
    this.updateQueryParams({
      categoryId: categoryId || null,
      category: null,
      page: 1
    });
    this.scrollToCatalogTop();
  }

  onBrandChange(brandId: string | null): void {
    this.updateQueryParams({
      brandId: brandId || null,
      brand: null,
      page: 1
    });
    this.scrollToCatalogTop();
  }

  onPriceChange(range: PriceRange): void {
    this.updateQueryParams({
      minPrice: range.minPrice,
      maxPrice: range.maxPrice,
      page: 1
    });
    this.scrollToCatalogTop();
  }

  onRatingChange(rating: number | null): void {
    this.updateQueryParams({
      minRating: rating,
      page: 1
    });
    this.scrollToCatalogTop();
  }

  onFeaturedChange(featured: boolean | null): void {
    this.updateQueryParams({
      isFeatured: featured ? 'true' : null,
      page: 1
    });
    this.scrollToCatalogTop();
  }

  onSortChange(sortBy: string): void {
    this.updateQueryParams({
      sortBy,
      page: 1
    });
    this.scrollToCatalogTop();
  }

  onPageChange(page: number): void {
    this.updateQueryParams({ page });
    this.scrollToCatalogTop();
  }

  onViewModeChange(mode: 'grid' | 'list'): void {
    this.viewMode.set(mode);
  }

  onRemoveChip(chip: ActiveFilterChip): void {
    switch (chip.type) {
      case 'search':
        this.updateQueryParams({ search: null, q: null, page: 1 });
        break;
      case 'category':
        this.updateQueryParams({ categoryId: null, category: null, page: 1 });
        break;
      case 'brand':
        this.updateQueryParams({ brandId: null, brand: null, page: 1 });
        break;
      case 'price':
        this.updateQueryParams({ minPrice: null, maxPrice: null, page: 1 });
        break;
      case 'rating':
        this.updateQueryParams({ minRating: null, page: 1 });
        break;
      case 'featured':
        this.updateQueryParams({ isFeatured: null, page: 1 });
        break;
    }
    this.scrollToCatalogTop();
  }

  onClearAll(): void {
    this.updateQueryParams({
      categoryId: null,
      category: null,
      brandId: null,
      brand: null,
      minPrice: null,
      maxPrice: null,
      minRating: null,
      search: null,
      q: null,
      isFeatured: null,
      page: 1
    });
    this.scrollToCatalogTop();
  }

  // ============================================================
  // MOBILE DRAWER
  // ============================================================
  openMobileFilter(): void {
    this.mobileFilterOpen.set(true);
  }

  closeMobileFilter(): void {
    this.mobileFilterOpen.set(false);
  }

  // ============================================================
  // PRODUCT ACTIONS
  // ============================================================
  onAddToCart(product: ProductListDto): void {
    const isAdded = this.cartService.isInCart(product.id);
    this.showFeedback(
      isAdded
        ? `Added "${product.name}" to your cart!`
        : `Removed "${product.name}" from your cart!`
    );
  }

  onAddToWishlist(product: ProductListDto): void {
    const isAdded = this.wishlistService.isInWishlist(product.id);
    this.showFeedback(
      isAdded
        ? `Added "${product.name}" to your wishlist!`
        : `Removed "${product.name}" from your wishlist!`
    );
  }

  onAddToCompare(product: ProductListDto): void {
    const isAdded = this.compareService.isInCompare(product.id);
    this.showFeedback(
      isAdded
        ? `Added "${product.name}" to comparison!`
        : `Removed "${product.name}" from comparison!`
    );
  }

  private showFeedback(msg: string): void {
    this.feedbackMessage.set(msg);
    setTimeout(() => this.feedbackMessage.set(null), 3000);
  }

  getImageUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const apiBase = (window as any).__ESELLER_API_URL__ as string;
    const host = apiBase ? apiBase.replace(/\/api\/v1\/?$/, '') : '';
    const path = url.startsWith('/') ? url : `/${url}`;
    if (path.startsWith('/uploads/')) return `${host}${path}`;
    return `${host}/uploads${path}`;
  }
}
