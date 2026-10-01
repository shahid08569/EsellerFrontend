import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { HttpParams } from '@angular/common/http';

import { ApiService } from './api.service';

import {
  ProductDto,
  ProductListDto,
  CategoryTreeDto,
  BrandDto,
  HomepageBannerDto,
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

  // ============================================================
  // BANNERS
  // ============================================================
  getHomepageBanners(forceRefresh = false): Observable<HomepageBannerDto[]> {
    if (!this.banners$ || forceRefresh) {
      this.banners$ = this.api.get<HomepageBannerDto[]>('/banners/active').pipe(shareReplay(1));
    }
    return this.banners$;
  }

  // ============================================================
  // CATEGORIES
  // ============================================================
  getCategories(forceRefresh = false): Observable<CategoryTreeDto[]> {
    if (!this.categories$ || forceRefresh) {
      this.categories$ = this.api.get<CategoryTreeDto[]>('/Categories').pipe(shareReplay(1));
    }
    return this.categories$;
  }

  // ============================================================
  // BRANDS
  // ============================================================
  getBrands(forceRefresh = false): Observable<BrandDto[]> {
    if (!this.brands$ || forceRefresh) {
      this.brands$ = this.api.get<BrandDto[]>('/Brands').pipe(shareReplay(1));
    }
    return this.brands$;
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