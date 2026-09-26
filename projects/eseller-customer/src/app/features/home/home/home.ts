import { Component, inject, signal, OnInit } from '@angular/core';

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
    // Banners
    this.homeService.getHomepageBanners().subscribe({
      next: (b) => this.banners.set(b),
      error: (e) => console.error('Banners failed', e)
    });

    // Categories (for grid at top)
    this.homeService.getCategories().subscribe({
      next: (c) => this.categories.set(c),
      error: (e) => console.error('Categories failed', e)
    });

    // Brands
    this.homeService.getBrands().subscribe({
      next: (b) => this.brands.set(b),
      error: (e) => console.error('Brands failed', e)
    });

    // Flash Sale
    this.homeService.getFlashSaleProducts(8).subscribe({
      next: (p) => {
        this.flashSaleProducts.set(p);
        this.loadingFlashSale.set(false);
      },
      error: (e) => {
        console.error('Flash sale failed', e);
        this.loadingFlashSale.set(false);
      }
    });

    // New Arrivals
    this.homeService.getNewArrivals(8).subscribe({
      next: (p) => {
        this.newArrivals.set(p);
        this.loadingNewArrivals.set(false);
      },
      error: (e) => {
        console.error('New arrivals failed', e);
        this.loadingNewArrivals.set(false);
      }
    });

    // Featured
    this.homeService.getFeaturedProducts(8).subscribe({
      next: (r) => {
        this.featuredProducts.set(r.items);
        this.loadingFeatured.set(false);
      },
      error: (e) => {
        console.error('Featured failed', e);
        this.loadingFeatured.set(false);
      }
    });

    // Best Selling
    this.homeService.getBestSellingProducts(8).subscribe({
      next: (p) => {
        this.bestSellingProducts.set(p);
        this.loadingBestSelling.set(false);
      },
      error: (e) => {
        console.error('Best selling failed', e);
        this.loadingBestSelling.set(false);
      }
    });

    // Hot Selling
    this.homeService.getHotSellingProducts(8).subscribe({
      next: (p) => {
        this.hotSellingProducts.set(p);
        this.loadingHotSelling.set(false);
      },
      error: (e) => {
        console.error('Hot selling failed', e);
        this.loadingHotSelling.set(false);
      }
    });

    // ✅ Homepage Categories (admin-controlled sections)
    this.homeService.getHomepageCategories(11).subscribe({
      next: (sections) => {
        this.categorySections.set(sections);
        this.loadingCategorySections.set(false);
      },
      error: (e) => {
        console.error('Homepage categories failed', e);
        this.loadingCategorySections.set(false);
      }
    });
  }
}