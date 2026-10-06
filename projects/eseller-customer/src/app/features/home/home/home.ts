import { Component, inject, signal, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  HomeService,
  HomepageBannerDto,
  CategoryTreeDto,
  ProductListDto,
  BrandDto,
  HomepageCategorySectionDto
} from 'eseller-shared';

import { HeroCarousel } from '../components/hero-carousel/hero-carousel';
import { CategoriesGrid } from '../components/categories-grid/categories-grid';
import { FlashSaleSection } from '../components/flash-sale-section/flash-sale-section';
import { ProductsSection } from '../components/products-section/products-section';
import { FeaturedProductsSlider } from '../components/featured-products-slider/featured-products-slider';
import { BestSellingSection } from '../components/best-selling-section/best-selling-section';
import { HotSellingSection } from '../components/hot-selling-section/hot-selling-section';
import { BrandsGrid } from '../components/brands-grid/brands-grid';
import { CategoryProductsSection } from '../components/category-products-section/category-products-section';

@Component({
  selector: 'app-home',
  imports: [
    HeroCarousel,
    CategoriesGrid,
    FlashSaleSection,
    ProductsSection,
    FeaturedProductsSlider,
    BestSellingSection,
    HotSellingSection,
    BrandsGrid,
    CategoryProductsSection
  ],
  templateUrl: './home.html'
})
export class Home implements OnInit {
  private readonly homeService = inject(HomeService);

  // ============================================================
  // Banners, categories, brands
  // ============================================================
  readonly banners = signal<HomepageBannerDto[]>([]);
  readonly categories = signal<CategoryTreeDto[]>([]);
  readonly brands = signal<BrandDto[]>([]);

  // ============================================================
  // Homepage sections
  // ============================================================
  readonly flashSaleProducts = signal<ProductListDto[]>([]);
  readonly newArrivals = signal<ProductListDto[]>([]);
  readonly featuredProducts = signal<ProductListDto[]>([]);
  readonly bestSellingProducts = signal<ProductListDto[]>([]);
  readonly hotSellingProducts = signal<ProductListDto[]>([]);

  // ============================================================
  // ✅ Dynamic category sections (admin-controlled)
  // ============================================================
  readonly categorySections = signal<HomepageCategorySectionDto[]>([]);
  readonly loadingCategorySections = signal(true);

  // ============================================================
  // Loading (homepage sections)
  // ============================================================
  readonly loadingFlashSale = signal(true);
  readonly loadingNewArrivals = signal(true);
  readonly loadingFeatured = signal(true);
  readonly loadingBestSelling = signal(true);
  readonly loadingHotSelling = signal(true);

  // ============================================================
  // LIFECYCLE
  // ============================================================
  ngOnInit(): void {
    // Banners (force refresh so admin publishes appear after cache)
    this.homeService.getHomepageBanners(true).subscribe({
      next: (b) => this.banners.set(Array.isArray(b) ? b : []),
      error: () => this.banners.set([])
    });

    // Categories (for grid at top - filtered by SuperAdmin homepage selection)
    this.homeService.getCategories().subscribe({
      next: (c) => {
        const featured = (c || []).filter(cat => cat.isFeaturedOnHomepage);
        this.categories.set(featured.length > 0 ? featured : (c || []));
      },
      error: () => this.categories.set([])
    });

    // Brands
    this.homeService.getBrands().subscribe({
      next: (b) => this.brands.set(b),
      error: () => this.brands.set([])
    });

    // Flash Sale
    this.homeService.getFlashSaleProducts(8).subscribe({
      next: (p) => {
        this.flashSaleProducts.set(p);
        this.loadingFlashSale.set(false);
      },
      error: () => this.loadingFlashSale.set(false)
    });

    // New Arrivals
    this.homeService.getNewArrivals(8).subscribe({
      next: (p) => {
        this.newArrivals.set(p);
        this.loadingNewArrivals.set(false);
      },
      error: () => this.loadingNewArrivals.set(false)
    });

    // Featured — prefer the dedicated /Products?isFeatured=true endpoint. If the admin
    // hasn't flagged any products as featured yet, fall back to the other dedicated
    // homepage section endpoints (best-selling / hot-selling) so the slider isn't empty.
    this.homeService.getFeaturedProducts(8).subscribe({
      next: (r) => {
        const items = r?.items || [];
        if (items.length > 0) {
          this.featuredProducts.set(items);
          this.loadingFeatured.set(false);
        } else {
          this.loadFeaturedFallback();
        }
      },
      error: () => this.loadFeaturedFallback()
    });

    // Best Selling
    this.homeService.getBestSellingProducts(8).subscribe({
      next: (p) => {
        this.bestSellingProducts.set(p);
        this.loadingBestSelling.set(false);
      },
      error: () => this.loadingBestSelling.set(false)
    });

    // Hot Selling
    this.homeService.getHotSellingProducts(8).subscribe({
      next: (p) => {
        this.hotSellingProducts.set(p);
        this.loadingHotSelling.set(false);
      },
      error: () => this.loadingHotSelling.set(false)
    });

    // ✅ Homepage Categories (admin-controlled sections)
    this.homeService.getHomepageCategories(11).subscribe({
      next: (sections) => {
        this.categorySections.set(sections);
        this.loadingCategorySections.set(false);
      },
      error: () => this.loadingCategorySections.set(false)
    });
  }

  /**
   * Fallback for the Featured section when /Products?isFeatured=true returns nothing yet.
   * Merges the other dedicated homepage endpoints (best-selling + hot-selling) so the
   * storefront still shows a populated "Featured" slider.
   */
  private loadFeaturedFallback(): void {
    forkJoin({
      bestSelling: this.homeService.getBestSellingProducts(8).pipe(catchError(() => of([] as ProductListDto[]))),
      hotSelling: this.homeService.getHotSellingProducts(8).pipe(catchError(() => of([] as ProductListDto[])))
    }).subscribe({
      next: ({ bestSelling, hotSelling }) => {
        const merged: ProductListDto[] = [];
        const seen = new Set<string>();
        for (const p of [...(bestSelling || []), ...(hotSelling || [])]) {
          if (p?.id && !seen.has(p.id)) {
            seen.add(p.id);
            merged.push(p);
          }
        }
        this.featuredProducts.set(merged.slice(0, 8));
        this.loadingFeatured.set(false);
      },
      error: () => {
        this.featuredProducts.set([]);
        this.loadingFeatured.set(false);
      }
    });
  }
}