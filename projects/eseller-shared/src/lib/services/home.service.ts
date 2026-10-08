import { Injectable, inject } from '@angular/core';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { HttpParams } from '@angular/common/http';

import { ApiService } from './api.service';

import {
  ProductDto,
  ProductListDto,
  CategoryTreeDto,
  BrandDto,
  HomepageBannerDto,
  PaymentShowcaseLogoDto,
  PlatformBrandingDto,
  FlashSaleDto,
  GetProductsQuery,
  PagedList,
  HomepageCategorySectionDto,
  ProductImageDto,
  ProductVariantDto,
  ReviewDto,
  ProductQuestionDto
} from '../models/catalog/catalog.models';

@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly api = inject(ApiService);

  private categories$?: Observable<CategoryTreeDto[]>;
  private brands$?: Observable<BrandDto[]>;
  private banners$?: Observable<HomepageBannerDto[]>;
  private paymentLogos$?: Observable<PaymentShowcaseLogoDto[]>;
  private branding$?: Observable<PlatformBrandingDto>;

  // ============================================================
  // BANNERS
  // ============================================================
  getHomepageBanners(forceRefresh = false): Observable<HomepageBannerDto[]> {
    if (!this.banners$ || forceRefresh) {
      this.banners$ = this.api.get<HomepageBannerDto[]>('/banners/active').pipe(
        catchError(() => of([])),
        shareReplay(1)
      );
    }
    return this.banners$;
  }

  /** Clear cached banners so the next homepage load picks up admin publishes. */
  invalidateBannersCache(): void {
    this.banners$ = undefined;
  }

  // ============================================================
  // PAYMENT SHOWCASE LOGOS
  // ============================================================
  getPaymentShowcaseLogos(forceRefresh = false): Observable<PaymentShowcaseLogoDto[]> {
    if (!this.paymentLogos$ || forceRefresh) {
      this.paymentLogos$ = this.api.get<any>('/homepage/payment-logos').pipe(
        map((res) => {
          const list = Array.isArray(res)
            ? res
            : Array.isArray(res?.value)
              ? res.value
              : Array.isArray(res?.data)
                ? res.data
                : [];
          return list.map((x: any) => ({
            id: String(x.id ?? x.Id ?? ''),
            name: x.name ?? x.Name ?? 'Payment',
            imageUrl: x.imageUrl ?? x.ImageUrl ?? '',
            sortOrder: Number(x.sortOrder ?? x.SortOrder ?? 0),
            isActive: (x.isActive ?? x.IsActive) !== false,
            createdAt: x.createdAt ?? x.CreatedAt ?? '',
            updatedAt: x.updatedAt ?? x.UpdatedAt ?? ''
          })) as PaymentShowcaseLogoDto[];
        }),
        catchError(() => of([])),
        shareReplay(1)
      );
    }
    return this.paymentLogos$;
  }

  invalidatePaymentLogosCache(): void {
    this.paymentLogos$ = undefined;
  }

  // ============================================================
  // PLATFORM BRANDING (nav / footer logos)
  // ============================================================
  getPlatformBranding(forceRefresh = false): Observable<PlatformBrandingDto> {
    if (!this.branding$ || forceRefresh) {
      this.branding$ = this.api.get<any>('/homepage/branding').pipe(
        map((res) => {
          const raw = res?.value ?? res?.data ?? res ?? {};
          const navLogoUrl = String(raw.navLogoUrl ?? raw.NavLogoUrl ?? '/brand/eseller-global-nav.png?v=orange3');
          return {
            navLogoUrl,
            footerLogoUrl: String(raw.footerLogoUrl ?? raw.FooterLogoUrl ?? '/brand/eseller-global-logo.png?v=orange3'),
            tagline: String(raw.tagline ?? raw.Tagline ?? 'Shop Without Borders'),
            siteTitle: String(raw.siteTitle ?? raw.SiteTitle ?? 'EsellerGlobal'),
            metaDescription: String(
              raw.metaDescription ??
                raw.MetaDescription ??
                'Shop Without Borders on EsellerGlobal — multi-vendor marketplace for electronics, fashion, and more from verified merchants worldwide.'
            ),
            faviconUrl: String(raw.faviconUrl ?? raw.FaviconUrl ?? navLogoUrl)
          } as PlatformBrandingDto;
        }),
        catchError(() =>
          of({
            navLogoUrl: '/brand/eseller-global-nav.png?v=orange3',
            footerLogoUrl: '/brand/eseller-global-logo.png?v=orange3',
            tagline: 'Shop Without Borders',
            siteTitle: 'EsellerGlobal',
            metaDescription:
              'Shop Without Borders on EsellerGlobal — multi-vendor marketplace for electronics, fashion, and more from verified merchants worldwide.',
            faviconUrl: '/favicon.svg'
          } as PlatformBrandingDto)
        ),
        shareReplay(1)
      );
    }
    return this.branding$;
  }

  invalidateBrandingCache(): void {
    this.branding$ = undefined;
  }

  // ============================================================
  // CATEGORIES
  // ============================================================
  getCategories(forceRefresh = false): Observable<CategoryTreeDto[]> {
    if (!this.categories$ || forceRefresh) {
      this.categories$ = this.api.get<any>('/Categories').pipe(
        map((res) => this.normalizeCategoryTree(res)),
        shareReplay(1)
      );
    }
    return this.categories$;
  }

  private normalizeCategoryTree(res: any): CategoryTreeDto[] {
    const list = Array.isArray(res)
      ? res
      : Array.isArray(res?.value)
        ? res.value
        : Array.isArray(res?.data)
          ? res.data
          : [];

    const mapNode = (n: any): CategoryTreeDto => ({
      id: String(n.id ?? n.Id ?? ''),
      name: n.name ?? n.Name ?? 'Category',
      slug: n.slug ?? n.Slug ?? '',
      imageUrl: n.imageUrl ?? n.ImageUrl ?? null,
      children: Array.isArray(n.children ?? n.Children)
        ? (n.children ?? n.Children).map((c: any) => mapNode(c))
        : [],
      isFeaturedOnHomepage: n.isFeaturedOnHomepage ?? n.IsFeaturedOnHomepage ?? undefined,
      homepageDisplayOrder: n.homepageDisplayOrder ?? n.HomepageDisplayOrder ?? undefined
    });

    return list.map(mapNode);
  }

  // ============================================================
  // BRANDS
  // ============================================================
  getBrands(forceRefresh = false): Observable<BrandDto[]> {
    if (!this.brands$ || forceRefresh) {
      this.brands$ = this.api.get<any>('/Brands').pipe(
        map((res) => {
          const list = Array.isArray(res)
            ? res
            : Array.isArray(res?.value)
              ? res.value
              : Array.isArray(res?.data)
                ? res.data
                : [];
          return list.map((b: any) => ({
            id: String(b.id ?? b.Id ?? ''),
            name: b.name ?? b.Name ?? 'Brand',
            slug: b.slug ?? b.Slug ?? '',
            logoUrl: b.logoUrl ?? b.LogoUrl ?? null,
            isActive: (b.isActive ?? b.IsActive) !== false,
            createdAt: b.createdAt ?? b.CreatedAt ?? ''
          })) as BrandDto[];
        }),
        shareReplay(1)
      );
    }
    return this.brands$;
  }

  // ============================================================
  // HOMEPAGE BOOTSTRAP — one round-trip for all product rails
  // ============================================================
  /** Single call: featured, flash, new, best, hot, + category sections. */
  getHomepageSections(limit = 8): Observable<{
    featured: ProductListDto[];
    bestSelling: ProductListDto[];
    hotSelling: ProductListDto[];
    newArrivals: ProductListDto[];
    flashSale: ProductListDto[];
    categories: HomepageCategorySectionDto[];
  }> {
    return this.api
      .get<any>('/homepage/sections', {
        params: new HttpParams().set('limit', limit)
      })
      .pipe(
        map((res) => ({
          featured: this.asProductList(res?.featured ?? res?.Featured),
          bestSelling: this.asProductList(res?.bestSelling ?? res?.BestSelling),
          hotSelling: this.asProductList(res?.hotSelling ?? res?.HotSelling),
          newArrivals: this.asProductList(res?.newArrivals ?? res?.NewArrivals),
          flashSale: this.asProductList(res?.flashSale ?? res?.FlashSale),
          categories: this.asCategorySections(res?.categories ?? res?.Categories)
        })),
        catchError(() =>
          of({
            featured: [] as ProductListDto[],
            bestSelling: [] as ProductListDto[],
            hotSelling: [] as ProductListDto[],
            newArrivals: [] as ProductListDto[],
            flashSale: [] as ProductListDto[],
            categories: [] as HomepageCategorySectionDto[]
          })
        ),
        shareReplay({ bufferSize: 1, refCount: true })
      );
  }

  private asProductList(raw: any): ProductListDto[] {
    return Array.isArray(raw) ? (raw as ProductListDto[]) : [];
  }

  private asCategorySections(raw: any): HomepageCategorySectionDto[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((s: any) => ({
      id: String(s.id ?? s.Id ?? ''),
      name: s.name ?? s.Name ?? 'Category',
      slug: s.slug ?? s.Slug ?? '',
      imageUrl: s.imageUrl ?? s.ImageUrl ?? null,
      displayOrder: Number(s.displayOrder ?? s.DisplayOrder ?? s.homepageDisplayOrder ?? 0),
      products: this.asProductList(s.products ?? s.Products)
    }));
  }

  // ============================================================
  // HOMEPAGE SECTIONS — Dedicated Endpoints
  // ============================================================
  getBestSellingProducts(limit = 8): Observable<ProductListDto[]> {
    return this.api.get<ProductListDto[]>('/homepage/best-selling', {
      params: new HttpParams().set('limit', limit)
    });
  }

  getHotSellingProducts(limit = 8): Observable<ProductListDto[]> {
    return this.api.get<ProductListDto[]>('/homepage/hot-selling', {
      params: new HttpParams().set('limit', limit)
    });
  }

  getNewArrivals(limit = 8): Observable<ProductListDto[]> {
    return this.api.get<ProductListDto[]>('/homepage/new-arrivals', {
      params: new HttpParams().set('limit', limit)
    });
  }

  getFlashSaleProducts(limit = 8): Observable<ProductListDto[]> {
    return this.api.get<ProductListDto[]>('/homepage/flash-sale', {
      params: new HttpParams().set('limit', limit)
    });
  }

  getLowStockProducts(limit = 8): Observable<ProductListDto[]> {
    return this.api.get<ProductListDto[]>('/homepage/low-stock', {
      params: new HttpParams().set('limit', limit)
    });
  }

  getOutOfStockProducts(limit = 8): Observable<ProductListDto[]> {
    return this.api.get<ProductListDto[]>('/homepage/out-of-stock', {
      params: new HttpParams().set('limit', limit)
    });
  }

  // ============================================================
  // HOMEPAGE CATEGORIES — Admin-controlled sections
  // ============================================================
  getHomepageCategories(limit = 11): Observable<HomepageCategorySectionDto[]> {
    return this.api.get<HomepageCategorySectionDto[]>('/homepage/categories', {
      params: new HttpParams().set('limit', limit)
    });
  }

  // ============================================================
  // PRODUCTS — Paged
  // ============================================================
  getFeaturedProducts(pageSize = 8): Observable<PagedList<ProductListDto>> {
    const params = new HttpParams()
      .set('isFeatured', 'true')
      .set('pageSize', pageSize)
      .set('pageNumber', 1);

    return this.api.get<PagedList<ProductListDto>>('/Products', { params });
  }

  getPopularProducts(pageSize = 8): Observable<PagedList<ProductListDto>> {
    const params = new HttpParams()
      .set('sortBy', 'popular')
      .set('pageSize', pageSize)
      .set('pageNumber', 1);

    return this.api.get<PagedList<ProductListDto>>('/Products', { params });
  }

  getNewProducts(pageSize = 8): Observable<PagedList<ProductListDto>> {
    const params = new HttpParams()
      .set('sortBy', 'newest')
      .set('pageSize', pageSize)
      .set('pageNumber', 1);

    return this.api.get<PagedList<ProductListDto>>('/Products', { params });
  }

  getProducts(query: GetProductsQuery): Observable<PagedList<ProductListDto>> {
    let params = new HttpParams();

    if (query.categoryId) params = params.set('categoryId', query.categoryId);
    if (query.brandId) params = params.set('brandId', query.brandId);
    if (query.shopId) params = params.set('shopId', query.shopId);
    if (query.minPrice != null) params = params.set('minPrice', query.minPrice);
    if (query.maxPrice != null) params = params.set('maxPrice', query.maxPrice);
    if (query.minRating != null) params = params.set('minRating', query.minRating);
    if (query.search) params = params.set('search', query.search);
    if (query.isFeatured != null)
      params = params.set('isFeatured', query.isFeatured);
    params = params.set('sortBy', query.sortBy ?? 'newest');
    params = params.set('pageNumber', query.pageNumber ?? 1);
    params = params.set('pageSize', query.pageSize ?? 20);

    return this.api.get<PagedList<ProductListDto>>('/Products', { params });
  }

  getProductBySlug(slug: string): Observable<ProductDto> {
    return this.api.get<ProductDto>(`/Products/slug/${slug}`);
  }

  getProductById(id: string): Observable<ProductDto> {
    return this.api.get<ProductDto>(`/Products/${id}`);
  }

  // ============================================================
  // PRODUCT DETAIL SUB-RESOURCES
  // ============================================================
  getProductImages(productId: string): Observable<ProductImageDto[]> {
    return this.api.get<ProductImageDto[]>(`/Products/${productId}/images`);
  }

  getProductVariants(productId: string): Observable<ProductVariantDto[]> {
    return this.api.get<ProductVariantDto[]>(`/products/${productId}/variants`);
  }

  getProductReviews(
    productId: string,
    rating?: number | null,
    pageNumber = 1,
    pageSize = 20
  ): Observable<PagedList<ReviewDto>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);
    if (rating != null) params = params.set('rating', rating);

    return this.api.get<PagedList<ReviewDto>>(`/products/${productId}/reviews`, { params });
  }

  createProductReview(
    productId: string,
    payload: { rating: number; title?: string | null; comment?: string | null; orderRequestItemId?: string | null }
  ): Observable<{ reviewId: string; message: string }> {
    return this.api.post<{ reviewId: string; message: string }>(
      `/products/${productId}/reviews`,
      {
        orderRequestItemId: payload.orderRequestItemId ?? null,
        rating: payload.rating,
        title: payload.title ?? null,
        comment: payload.comment ?? null
      }
    );
  }

  getProductQuestions(
    productId: string,
    pageNumber = 1,
    pageSize = 20
  ): Observable<PagedList<ProductQuestionDto>> {
    const params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    return this.api.get<PagedList<ProductQuestionDto>>(`/products/${productId}/questions`, { params });
  }

  submitProductQuestion(
    productId: string,
    question: string
  ): Observable<{ questionId: string; message: string }> {
    return this.api.post<{ questionId: string; message: string }>(
      `/products/${productId}/questions`,
      { question }
    );
  }
}