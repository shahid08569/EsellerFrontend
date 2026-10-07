import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { forkJoin, Subscription } from 'rxjs';

import {
  HomeService,
  HomepageBannerDto,
  CategoryTreeDto,
  ProductListDto,
  BrandDto,
  HomepageCategorySectionDto,
  PaymentShowcaseLogoDto,
  SkeletonLayout
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
import { PaymentLogosRail } from '../components/payment-logos-rail/payment-logos-rail';

@Component({
  selector: 'app-home',
  imports: [
    HeroCarousel,
    PaymentLogosRail,
    CategoriesGrid,
    FlashSaleSection,
    ProductsSection,
    FeaturedProductsSlider,
    BestSellingSection,
    HotSellingSection,
    BrandsGrid,
    CategoryProductsSection,
    SkeletonLayout
  ],
  templateUrl: './home.html'
})
export class Home implements OnInit, OnDestroy {
  private readonly homeService = inject(HomeService);
  private sub?: Subscription;

  readonly banners = signal<HomepageBannerDto[]>([]);
  readonly paymentLogos = signal<PaymentShowcaseLogoDto[]>([]);
  readonly categories = signal<CategoryTreeDto[]>([]);
  readonly brands = signal<BrandDto[]>([]);

  readonly flashSaleProducts = signal<ProductListDto[]>([]);
  readonly newArrivals = signal<ProductListDto[]>([]);
  readonly featuredProducts = signal<ProductListDto[]>([]);
  readonly bestSellingProducts = signal<ProductListDto[]>([]);
  readonly hotSellingProducts = signal<ProductListDto[]>([]);

  readonly categorySections = signal<HomepageCategorySectionDto[]>([]);
  readonly loadingCategorySections = signal(true);

  readonly loadingFlashSale = signal(true);
  readonly loadingNewArrivals = signal(true);
  readonly loadingFeatured = signal(true);
  readonly loadingBestSelling = signal(true);
  readonly loadingHotSelling = signal(true);

  ngOnInit(): void {
    // Max 5 parallel calls. Product rails + category sections = 1 round-trip.
    this.sub = forkJoin({
      banners: this.homeService.getHomepageBanners(false),
      paymentLogos: this.homeService.getPaymentShowcaseLogos(false),
      categories: this.homeService.getCategories(false),
      brands: this.homeService.getBrands(false),
      sections: this.homeService.getHomepageSections(8)
    }).subscribe({
      next: ({ banners, paymentLogos, categories, brands, sections }) => {
        this.banners.set(Array.isArray(banners) ? banners : []);
        this.paymentLogos.set(Array.isArray(paymentLogos) ? paymentLogos : []);

        const cats = categories || [];
        const featured = cats.filter(c => c.isFeaturedOnHomepage);
        this.categories.set(featured.length > 0 ? featured : cats);

        this.brands.set(brands || []);

        const featuredProducts = sections.featured?.length
          ? sections.featured
          : [...(sections.bestSelling || []), ...(sections.hotSelling || [])]
              .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
              .slice(0, 8);

        this.flashSaleProducts.set(sections.flashSale || []);
        this.newArrivals.set(sections.newArrivals || []);
        this.featuredProducts.set(featuredProducts);
        this.bestSellingProducts.set(sections.bestSelling || []);
        this.hotSellingProducts.set(sections.hotSelling || []);
        this.categorySections.set(sections.categories || []);

        this.loadingFlashSale.set(false);
        this.loadingNewArrivals.set(false);
        this.loadingFeatured.set(false);
        this.loadingBestSelling.set(false);
        this.loadingHotSelling.set(false);
        this.loadingCategorySections.set(false);
      },
      error: () => {
        this.loadingFlashSale.set(false);
        this.loadingNewArrivals.set(false);
        this.loadingFeatured.set(false);
        this.loadingBestSelling.set(false);
        this.loadingHotSelling.set(false);
        this.loadingCategorySections.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
