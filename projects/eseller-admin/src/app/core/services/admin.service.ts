import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { ApiService } from 'eseller-shared';
import { environment } from '../../../environments/environment';
import {
  AdminShopkeeperDto,
  AdminShopDto,
  ShopCategoryDto,
  AdminProductDto,
  PagedResult,
  PlatformDashboardDto,
  AdminCategoryDto,
  AdminBrandDto,
  AdminOrderDto,
  AdminCustomerDto,
  AdminPartnerDto,
  AdminCommissionDto,
  AdminWithdrawalDto,
  AdminCouponDto,
  AdminFlashSaleDto,
  AdminBannerDto,
  AdminBlogPostDto,
  AdminCmsDto,
  AdminSettingDto,
  AdminAuditLogDto,
  AdminReviewDto,
  UserLocationLogDto
} from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);

  private normalizeStatus(status: any): 'Pending' | 'Approved' | 'Rejected' {
    if (status === undefined || status === null) return 'Pending';
    const s = String(status).trim().toLowerCase();
    if (s === '1' || s === 'pending') return 'Pending';
    if (s === '2' || s === 'approved') return 'Approved';
    if (s === '3' || s === 'rejected') return 'Rejected';
    return 'Pending';
  }

  // ═══════════════════════════════════════════════════════════
  // 1. DASHBOARD
  // ═══════════════════════════════════════════════════════════
  getPlatformDashboard(): Observable<PlatformDashboardDto> {
    return this.api.get<PlatformDashboardDto>('/admin/dashboard/platform').pipe(
      catchError(() => of({
        totalShops: 0,
        activeShops: 0,
        pendingShops: 0,
        totalProducts: 0,
        approvedProducts: 0,
        pendingProducts: 0,
        rejectedProducts: 0,
        totalOrders: 0,
        newOrders: 0,
        pendingOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
        deliveredRevenue: 0,
        totalAffiliates: 0,
        activeAffiliates: 0,
        totalCommissionsPaid: 0,
        totalCommissionsPending: 0,
        pendingWithdrawals: 0,
        pendingWithdrawalsAmount: 0,
        totalCustomers: 0,
        totalShopkeepers: 0
      }))
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 2. SHOPS & SELLERS
  // ═══════════════════════════════════════════════════════════
  getShopkeepers(status?: number): Observable<AdminShopkeeperDto[]> {
    const query = status !== undefined && status !== null ? `?status=${status}` : '';
    return this.api.get<AdminShopkeeperDto[]>(`/admin/shopkeepers${query}`).pipe(
      map(items => (items || []).map(k => ({
        ...k,
        status: this.normalizeStatus(k.status)
      }))),
      catchError(() => of([]))
    );
  }

  approveShopkeeper(id: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`/admin/shopkeepers/${id}/approve`, {});
  }

  rejectShopkeeper(id: string, reason: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`/admin/shopkeepers/${id}/reject`, { reason });
  }

  getShops(pageNumber: number = 1, pageSize: number = 100, shopCategoryId?: string): Observable<PagedResult<AdminShopDto>> {
    let url = `/Shops?pageNumber=${pageNumber}&pageSize=${pageSize}`;
    if (shopCategoryId) url += `&shopCategoryId=${shopCategoryId}`;
    return this.api.get<any>(url).pipe(
      map(res => {
        if (Array.isArray(res)) {
          return {
            items: res,
            totalCount: res.length,
            pageNumber: 1,
            pageSize: res.length,
            totalPages: 1,
            hasPreviousPage: false,
            hasNextPage: false
          };
        }
        return res || { items: [], totalCount: 0 };
      }),
      catchError(() => of({ items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0, hasPreviousPage: false, hasNextPage: false }))
    );
  }

  getShopById(id: string): Observable<AdminShopDto | null> {
    return this.api.get<AdminShopDto>(`/Shops/${id}`).pipe(
      catchError(() => of(null))
    );
  }

  getShopBySlug(slug: string): Observable<AdminShopDto | null> {
    return this.api.get<AdminShopDto>(`/Shops/slug/${slug}`).pipe(
      catchError(() => of(null))
    );
  }

  deleteShop(id: string): Observable<any> {
    return this.api.delete<any>(`/Shops/${id}`);
  }

  setShopRating(id: string, rating: number): Observable<{ message: string; shopId: string; rating: number }> {
    return this.api.put<{ message: string; shopId: string; rating: number }>(`/admin/shops/${id}/rating`, { rating });
  }

  updateShop(id: string, data: { name?: string; description?: string; phone?: string; address?: string; city?: string; country?: string }): Observable<any> {
    return this.api.put<any>(`/Shops/${id}`, data);
  }

  uploadShopLogo(id: string, file: File): Observable<{ logoUrl: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<{ logoUrl: string; message: string }>(`/Shops/${id}/logo`, formData);
  }

  uploadShopBanner(id: string, file: File): Observable<{ bannerUrl: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<{ bannerUrl: string; message: string }>(`/Shops/${id}/banner`, formData);
  }

  getSupportSession(): Observable<{ orderRequestId: string; orderRef: string }> {
    return this.api.get<{ orderRequestId: string; orderRef: string }>('/Chat/support-session');
  }

  // ═══════════════════════════════════════════════════════════
  // SHOP CATEGORIES / TIERS (Diamond, Gold, Silver, Premium)
  // ═══════════════════════════════════════════════════════════
  getShopCategories(onlyActive = false): Observable<ShopCategoryDto[]> {
    return this.api.get<ShopCategoryDto[]>(`/admin/shop-categories?onlyActive=${onlyActive}`).pipe(
      catchError(() => of([]))
    );
  }

  createShopCategory(data: { name: string; slug?: string; description?: string; badgeText?: string; badgeColor?: string; iconUrl?: string; displayOrder?: number; priceUsd?: number; maxProductListings?: number }): Observable<any> {
    return this.api.post<any>('/admin/shop-categories', data);
  }

  updateShopCategory(id: string, data: { name: string; slug?: string; description?: string; badgeText?: string; badgeColor?: string; iconUrl?: string; displayOrder?: number; isActive?: boolean; priceUsd?: number; maxProductListings?: number }): Observable<any> {
    return this.api.put<any>(`/admin/shop-categories/${id}`, data);
  }

  deleteShopCategory(id: string): Observable<any> {
    return this.api.delete<any>(`/admin/shop-categories/${id}`);
  }

  assignShopCategory(shopId: string, shopCategoryId: string | null, customBadgeText?: string | null): Observable<any> {
    return this.api.put<any>(`/admin/shop-categories/shops/${shopId}/assign`, {
      shopCategoryId,
      customBadgeText
    });
  }

  getTierUpgradeRequests(): Observable<any[]> {
    return this.api.get<any[]>('/admin/shop-categories/tier-requests').pipe(
      map(res => {
        if (Array.isArray(res)) return res;
        if (res && Array.isArray((res as any).items)) return (res as any).items;
        return [];
      }),
      catchError(() => of([]))
    );
  }

  approveTierUpgradeRequest(id: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`/admin/shop-categories/tier-requests/${id}/approve`, {});
  }

  rejectTierUpgradeRequest(id: string, reason?: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`/admin/shop-categories/tier-requests/${id}/reject`, { reason });
  }

  deleteTierUpgradeRequest(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/admin/shop-categories/tier-requests/${id}`);
  }

  formatImageUrl(url: string | null | undefined): string {
    if (!url || typeof url !== 'string' || !url.trim()) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return trimmed;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      // Fix absolute URLs that omitted /uploads/
      return trimmed.replace(/^(https?:\/\/[^/]+)\/(?!uploads\/)/i, '$1/uploads/');
    }
    // Fake / local placeholder URLs from failed uploads — do not resolve
    if (trimmed.startsWith('local-front:') || trimmed.startsWith('local-back:') || trimmed.startsWith('local-')) {
      return '';
    }
    let cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    if (!cleanPath.startsWith('/uploads/')) {
      cleanPath = `/uploads${cleanPath}`;
    }
    const host = (environment.apiUrl || '').replace(/\/api\/v1\/?$/, '');
    return `${host}${cleanPath}`;
  }

  // ═══════════════════════════════════════════════════════════
  // 3. PRODUCTS
  // ═══════════════════════════════════════════════════════════
  getPendingProducts(pageNumber: number = 1, pageSize: number = 50): Observable<PagedResult<AdminProductDto>> {
    return this.api.get<PagedResult<AdminProductDto>>(`/admin/products/pending?pageNumber=${pageNumber}&pageSize=${pageSize}`).pipe(
      catchError(() => of({ items: [], totalCount: 0, pageNumber: 1, pageSize: 50, totalPages: 0, hasPreviousPage: false, hasNextPage: false }))
    );
  }

  getRejectedProducts(pageNumber: number = 1, pageSize: number = 50): Observable<PagedResult<AdminProductDto>> {
    return this.api.get<PagedResult<AdminProductDto>>(`/admin/products/rejected?pageNumber=${pageNumber}&pageSize=${pageSize}`).pipe(
      catchError(() => of({ items: [], totalCount: 0, pageNumber: 1, pageSize: pageSize, totalPages: 0, hasPreviousPage: false, hasNextPage: false }))
    );
  }

  getApprovedSellerProducts(pageNumber: number = 1, pageSize: number = 50): Observable<PagedResult<AdminProductDto>> {
    return this.api.get<PagedResult<AdminProductDto>>(`/admin/products/approved?pageNumber=${pageNumber}&pageSize=${pageSize}`).pipe(
      catchError(() => of({ items: [], totalCount: 0, pageNumber: 1, pageSize: pageSize, totalPages: 0, hasPreviousPage: false, hasNextPage: false }))
    );
  }

  getProducts(
    shopId?: string,
    search?: string,
    pageNumber: number = 1,
    pageSize: number = 200
  ): Observable<PagedResult<AdminProductDto>> {
    // Master warehouse catalog for Super Admin product management
    let url = `/Products/catalog?pageNumber=${pageNumber}&pageSize=${pageSize}`;
    if (search && search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    void shopId;
    return this.api.get<PagedResult<AdminProductDto>>(url);
  }

  createProduct(data: {
    shopId?: string;
    categoryId: string;
    brandId?: string | null;
    name: string;
    description?: string;
    basePrice: number;
    seoTitle?: string;
    seoDescription?: string;
  }): Observable<{ productId: string; message: string }> {
    // Always publish to Platform Master Warehouse — never send shopId.
    // Empty brandId "" breaks Guid model binding on the API.
    const payload: Record<string, unknown> = {
      categoryId: String(data.categoryId).trim(),
      name: data.name.trim(),
      basePrice: data.basePrice,
      description: data.description?.trim() || null,
      seoTitle: data.seoTitle?.trim() || null,
      seoDescription: data.seoDescription?.trim() || null,
      brandId: data.brandId && String(data.brandId).trim() ? String(data.brandId).trim() : null
    };
    return this.api.post<{ productId: string; message: string }>('/Products', payload);
  }

  getProductById(id: string): Observable<AdminProductDto> {
    return this.api.get<AdminProductDto>(`/Products/${id}`);
  }

  updateProduct(id: string, data: {
    name: string;
    description?: string;
    basePrice: number;
    categoryId: string;
    brandId?: string | null;
    seoTitle?: string;
    seoDescription?: string;
  }): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/Products/${id}`, data);
  }

  uploadProductImage(productId: string, file: File): Observable<{ imageId: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<{ imageId: string; message: string }>(`/Products/${productId}/images`, formData);
  }

  uploadMultipleProductImages(productId: string, files: File[]): Observable<any> {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    return this.api.post<any>(`/Products/${productId}/images/bulk`, formData);
  }

  setProductCoverImage(productId: string, imageId: string): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/Products/${productId}/images/${imageId}/cover`, {});
  }

  getProductImages(productId: string): Observable<{ id: string; imageUrl: string; isCover: boolean; displayOrder?: number }[]> {
    return this.api.get<any>(`/Products/${productId}/images`).pipe(
      map(res => {
        const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
        return list.map((img: any) => ({
          id: String(img.id ?? img.Id ?? img.imageId ?? img.ImageId ?? ''),
          imageUrl: img.imageUrl ?? img.ImageUrl ?? '',
          isCover: !!(img.isCover ?? img.IsCover ?? img.isPrimary ?? img.IsPrimary),
          displayOrder: img.displayOrder ?? img.DisplayOrder ?? 0
        }));
      }),
      catchError(() => of([]))
    );
  }

  seedStandardTiers(): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/admin/shop-categories/seed-tiers', {});
  }

  getProductVariants(productId: string): Observable<any[]> {
    return this.api.get<any[]>(`/products/${productId}/variants`).pipe(
      catchError(() => of([]))
    );
  }

  createProductVariant(productId: string, data: {
    sku: string;
    price: number;
    stockQty: number;
    lowStockThreshold?: number;
    attributes?: { attributeName: string; attributeValue: string }[];
  }): Observable<{ variantId: string; message: string }> {
    return this.api.post<{ variantId: string; message: string }>(`/products/${productId}/variants`, data);
  }

  uploadVariantImage(productId: string, variantId: string, file: File): Observable<{ imageUrl: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<{ imageUrl: string; message: string }>(`/products/${productId}/variants/${variantId}/image`, formData);
  }

  deleteProductVariant(productId: string, variantId: string): Observable<any> {
    return this.api.delete<any>(`/products/${productId}/variants/${variantId}`);
  }

  deleteProduct(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/Products/${id}`);
  }

  approveProduct(id: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`/admin/products/${id}/approve`, {});
  }

  rejectProduct(id: string, reason: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`/admin/products/${id}/reject`, { reason });
  }

  approveProductsBulk(productIds: string[]): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/admin/products/approve-bulk', { productIds });
  }

  setFeaturedBulk(productIds: string[], isFeatured: boolean): Observable<{ message: string }> {
    return this.api.put<{ message: string }>('/admin/products/featured-bulk', { productIds, isFeatured });
  }

  setHotSellingBulk(productIds: string[], isHotSelling: boolean): Observable<{ message: string }> {
    return this.api.put<{ message: string }>('/admin/products/hot-selling-bulk', { productIds, isHotSelling });
  }

  deleteShopkeeper(id: string, reason?: string): Observable<{ message: string }> {
    const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    return this.api.delete<{ message: string }>(`/admin/shopkeepers/${id}${query}`);
  }

  // ═══════════════════════════════════════════════════════════
  // 4. CATEGORIES
  // ═══════════════════════════════════════════════════════════
  getCategories(): Observable<AdminCategoryDto[]> {
    const normalize = (res: any): AdminCategoryDto[] => {
      const raw = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.categories)
            ? res.categories
            : Array.isArray(res?.value)
              ? res.value
              : Array.isArray(res?.data)
                ? res.data
                : [];
      return this.flattenCategoryTree(raw);
    };

    // Prefer admin list; fall back to public Categories tree.
    return this.api.get<any>('/admin/categories').pipe(
      map(normalize),
      switchMap(list => {
        if (list.length > 0) return of(list);
        return this.api.get<any>('/Categories').pipe(
          map(normalize),
          catchError(() => of([] as AdminCategoryDto[]))
        );
      }),
      catchError(() =>
        this.api.get<any>('/Categories').pipe(
          map(normalize),
          catchError(() => of([] as AdminCategoryDto[]))
        )
      )
    );
  }

  /** Flatten admin flat list or public category tree into selectable options. */
  private flattenCategoryTree(nodes: any[], depth = 0): AdminCategoryDto[] {
    const out: AdminCategoryDto[] = [];
    for (const n of nodes || []) {
      if (!n) continue;
      const id = n.id ?? n.Id ?? n.categoryId ?? n.CategoryId;
      const idStr = id != null && String(id) !== 'undefined' ? String(id) : '';
      if (idStr) {
        const indent = depth > 0 ? `${'— '.repeat(depth)}` : '';
        const name = n.name ?? n.Name ?? 'Category';
        out.push({
          id: idStr,
          name: `${indent}${name}`,
          slug: n.slug ?? n.Slug ?? '',
          imageUrl: n.imageUrl ?? n.ImageUrl ?? null,
          parentId: n.parentId ?? n.ParentId ?? n.parentCategoryId ?? n.ParentCategoryId ?? null,
          isActive: (n.isActive ?? n.IsActive) !== false,
          productCount: n.productCount ?? n.ProductCount ?? 0,
          isFeaturedOnHomepage: !!(n.isFeaturedOnHomepage ?? n.IsFeaturedOnHomepage),
          homepageDisplayOrder: n.homepageDisplayOrder ?? n.HomepageDisplayOrder ?? 0
        } as AdminCategoryDto);
      }
      const children = n.children ?? n.Children;
      if (Array.isArray(children) && children.length) {
        out.push(...this.flattenCategoryTree(children, depth + 1));
      }
    }
    return out;
  }

  createCategory(data: { name: string; slug?: string; parentId?: string | null; imageUrl?: string | null; displayOrder?: number; homepageDisplayOrder?: number; isFeaturedOnHomepage?: boolean }): Observable<any> {
    return this.api.post<any>('/admin/categories', data);
  }

  updateCategory(id: string, data: { name: string; slug?: string; parentId?: string | null; imageUrl?: string | null; displayOrder?: number; homepageDisplayOrder?: number; isFeaturedOnHomepage?: boolean }): Observable<any> {
    return this.api.put<any>(`/admin/categories/${id}`, data);
  }

  toggleCategoryHomepageFeatured(id: string, isFeaturedOnHomepage: boolean, homepageDisplayOrder: number = 0): Observable<any> {
    return this.setHomepageCategory(id, isFeaturedOnHomepage, homepageDisplayOrder);
  }

  deleteCategory(id: string): Observable<any> {
    return this.api.delete<any>(`/admin/categories/${id}`);
  }

  getHomepageCategories(): Observable<AdminCategoryDto[]> {
    return this.api.get<AdminCategoryDto[]>('/homepage/categories?limit=20').pipe(
      catchError(() => of([]))
    );
  }

  setHomepageCategory(id: string, isFeaturedOnHomepage: boolean, homepageDisplayOrder: number): Observable<any> {
    return this.api.post<any>(`/admin/categories/${id}/homepage`, {
      isFeaturedOnHomepage,
      homepageDisplayOrder
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 5. BRANDS
  // ═══════════════════════════════════════════════════════════
  getBrands(): Observable<AdminBrandDto[]> {
    const normalize = (res: any): AdminBrandDto[] => {
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.brands)
            ? res.brands
            : Array.isArray(res?.value)
              ? res.value
              : Array.isArray(res?.data)
                ? res.data
                : [];

      return list
        .map((b: any) => {
          const id = b?.id ?? b?.Id ?? b?.brandId ?? b?.BrandId;
          const idStr = id != null && String(id) !== 'undefined' ? String(id) : '';
          if (!idStr) return null;
          return {
            id: idStr,
            name: b.name ?? b.Name ?? 'Brand',
            slug: b.slug ?? b.Slug ?? '',
            logoUrl: b.logoUrl ?? b.LogoUrl ?? null,
            description: b.description ?? b.Description ?? null,
            productCount: b.productCount ?? b.ProductCount ?? 0,
            isActive: (b.isActive ?? b.IsActive) !== false
          } as AdminBrandDto;
        })
        .filter((b: AdminBrandDto | null): b is AdminBrandDto => !!b);
    };

    return this.api.get<any>('/Brands').pipe(
      map(normalize),
      switchMap(list => {
        if (list.length > 0) return of(list);
        // Fallback if public route empty / casing differs
        return this.api.get<any>('/brands').pipe(
          map(normalize),
          catchError(() => of([] as AdminBrandDto[]))
        );
      }),
      catchError(() =>
        this.api.get<any>('/brands').pipe(
          map(normalize),
          catchError(() => of([] as AdminBrandDto[]))
        )
      )
    );
  }

  createBrand(data: { name: string; slug?: string; description?: string | null; logoUrl?: string | null; isActive?: boolean }): Observable<any> {
    return this.api.post<any>('/admin/brands', data);
  }

  updateBrand(id: string, data: { name: string; slug?: string; description?: string | null; logoUrl?: string | null; isActive?: boolean }): Observable<any> {
    return this.api.put<any>(`/admin/brands/${id}`, data);
  }

  deleteBrand(id: string): Observable<any> {
    return this.api.delete<any>(`/admin/brands/${id}`);
  }

  uploadBrandLogo(id: string, file: File): Observable<{ logoUrl: string; message?: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.api.post<any>(`/admin/brands/${id}/logo`, form).pipe(
      map((res: any) => ({
        logoUrl: res?.logoUrl ?? res?.LogoUrl ?? res?.imageUrl ?? res?.ImageUrl ?? res?.value ?? '',
        message: res?.message
      }))
    );
  }

  uploadCategoryImage(id: string, file: File): Observable<{ imageUrl: string; message?: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.api.post<any>(`/admin/categories/${id}/image`, form).pipe(
      map((res: any) => ({
        imageUrl: res?.imageUrl ?? res?.ImageUrl ?? res?.logoUrl ?? res?.LogoUrl ?? res?.value ?? '',
        message: res?.message
      }))
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 6. ORDERS
  // ═══════════════════════════════════════════════════════════
  getOrders(pageNumber: number = 1, pageSize: number = 20, status?: string, shopId?: string, search?: string): Observable<any> {
    let url = `/admin/orders?pageNumber=${pageNumber}&pageSize=${pageSize}`;
    if (status && status !== 'all') url += `&status=${status}`;
    if (shopId && shopId !== 'all') url += `&shopId=${shopId}`;
    if (search && search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    return this.api.get<any>(url).pipe(
      catchError(() => of({ items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0 }))
    );
  }

  getOrderById(id: string): Observable<AdminOrderDto | null> {
    return this.api.get<AdminOrderDto>(`/admin/orders/${id}`).pipe(
      catchError(() => of(null))
    );
  }

  updateOrderStatus(id: string, newStatus: number): Observable<any> {
    return this.api.put<any>(`/admin/orders/${id}/status`, { newStatus });
  }

  /** PaymentStatus: 1=Pending, 2=Completed(Paid), 3=Failed, 4=Refunded */
  updateOrderPaymentStatus(id: string, newStatus: number): Observable<any> {
    return this.api.put<any>(`/admin/orders/${id}/payment-status`, { newStatus });
  }

  getOrderStatusHistory(id: string): Observable<any[]> {
    return this.api.get<any[]>(`/admin/orders/${id}/status-history`).pipe(
      catchError(() => of([]))
    );
  }

  deleteOrder(id: string): Observable<any> {
    return this.api.delete<any>(`/admin/orders/${id}`);
  }

  // ═══════════════════════════════════════════════════════════
  // 6b. PRODUCT REVIEWS (moderation)
  // ═══════════════════════════════════════════════════════════
  getReviews(
    status: 'pending' | 'approved' | 'all' = 'pending',
    pageNumber: number = 1,
    pageSize: number = 20
  ): Observable<PagedResult<AdminReviewDto>> {
    return this.api.get<PagedResult<AdminReviewDto>>(
      `/admin/reviews?status=${status}&pageNumber=${pageNumber}&pageSize=${pageSize}`
    ).pipe(
      map(res => ({
        items: res?.items ?? [],
        totalCount: res?.totalCount ?? 0,
        pageNumber: res?.pageNumber ?? pageNumber,
        pageSize: res?.pageSize ?? pageSize,
        totalPages: res?.totalPages ?? 0,
        hasPreviousPage: !!res?.hasPreviousPage,
        hasNextPage: !!res?.hasNextPage
      })),
      catchError(() => of({
        items: [],
        totalCount: 0,
        pageNumber,
        pageSize,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false
      }))
    );
  }

  /** Keep / publish a customer review */
  keepReview(id: string): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/admin/reviews/${id}/approve`, {});
  }

  /** Permanently delete a customer review */
  deleteReview(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/admin/reviews/${id}`);
  }

  // ═══════════════════════════════════════════════════════════
  // 7. CHAT & CONVERSATIONS
  // ═══════════════════════════════════════════════════════════
  getConversations(): Observable<any[]> {
    return this.api.get<any>('/Chat/conversations').pipe(
      map(res => {
        if (Array.isArray(res)) return res;
        if (res && Array.isArray(res.items)) return res.items;
        if (res && Array.isArray(res.conversations)) return res.conversations;
        return [];
      }),
      catchError(() => of([]))
    );
  }

  getOrderMessages(orderId: string, pageNumber: number = 1, pageSize: number = 50): Observable<any[]> {
    return this.api.get<any>(`/Chat/${orderId}/messages?pageNumber=${pageNumber}&pageSize=${pageSize}`).pipe(
      map(res => {
        if (Array.isArray(res)) return res;
        if (res && Array.isArray(res.items)) return res.items;
        if (res && Array.isArray(res.messages)) return res.messages;
        return [];
      }),
      catchError(() => of([]))
    );
  }

  getConversationMessages(conversationId: string): Observable<any[]> {
    return this.getOrderMessages(conversationId);
  }

  sendChatMessage(orderId: string, message: string): Observable<any> {
    return this.api.post<any>(`/Chat/${orderId}/messages`, { message });
  }

  sendMessage(conversationId: string, message: string): Observable<any> {
    return this.sendChatMessage(conversationId, message);
  }

  getHomepageProducts(tab: string = 'all', pageNumber: number = 1, pageSize: number = 40): Observable<any> {
    return this.api.get<any>(`/admin/products/homepage?tab=${encodeURIComponent(tab)}&pageNumber=${pageNumber}&pageSize=${pageSize}`).pipe(
      catchError(() => of({ items: [], totalCount: 0 }))
    );
  }

  setProductFeatured(productId: string, isFeatured: boolean): Observable<any> {
    return this.api.put<any>(`/admin/products/${productId}/featured`, { isFeatured });
  }

  setProductHotSelling(productId: string, isHotSelling: boolean): Observable<any> {
    return this.api.put<any>(`/admin/products/${productId}/hot-selling`, { isHotSelling });
  }

  // ═══════════════════════════════════════════════════════════
  // 8. USERS / CUSTOMERS
  // ═══════════════════════════════════════════════════════════
  getCustomers(pageNumber: number = 1, pageSize: number = 50): Observable<any> {
    return this.api.get<any>(`/admin/customers?pageNumber=${pageNumber}&pageSize=${pageSize}`).pipe(
      catchError(() => of({ items: [], totalCount: 0 }))
    );
  }

  activateCustomer(id: string): Observable<any> {
    return this.api.put<any>(`/admin/customers/${id}/status`, { isActive: true });
  }

  deactivateCustomer(id: string): Observable<any> {
    return this.api.put<any>(`/admin/customers/${id}/status`, { isActive: false });
  }

  setCustomerStatus(id: string, isActive: boolean): Observable<any> {
    return this.api.put<any>(`/admin/customers/${id}/status`, { isActive });
  }

  approveCustomer(id: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`/admin/customers/${id}/approve`, {});
  }

  rejectCustomer(id: string, reason?: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(`/admin/customers/${id}/reject`, { reason: reason || null });
  }

  getCustomerDetails(id: string): Observable<any> {
    return this.api.get<any>(`/admin/customers/${id}`).pipe(catchError(() => of(null)));
  }

  getCustomerLogins(id: string): Observable<UserLocationLogDto[]> {
    return this.api.get<UserLocationLogDto[]>(`/admin/customers/${id}/logins`).pipe(catchError(() => of([])));
  }

  getShopkeeperLogins(id: string): Observable<UserLocationLogDto[]> {
    return this.api.get<UserLocationLogDto[]>(`/admin/shopkeepers/${id}/logins`).pipe(catchError(() => of([])));
  }

  setShopkeeperStatus(id: string, isActive: boolean): Observable<any> {
    return this.api.put<any>(`/admin/shopkeepers/${id}/status`, { isActive });
  }

  // ═══════════════════════════════════════════════════════════
  // 9. PARTNERS
  // ═══════════════════════════════════════════════════════════
  getPartners(): Observable<AdminPartnerDto[]> {
    return this.api.get<any>('/admin/partners').pipe(
      map(res => {
        if (res && Array.isArray(res.items)) return res.items;
        if (Array.isArray(res)) return res;
        return [];
      }),
      catchError(() => of([]))
    );
  }

  addPartner(data: { email: string; password: string; permissions?: string | string[] }): Observable<any> {
    const payload = {
      ...data,
      permissions: Array.isArray(data.permissions) ? data.permissions.join(',') : data.permissions
    };
    return this.api.post<any>('/admin/partners', payload);
  }

  deactivatePartner(id: string): Observable<any> {
    return this.api.put<any>(`/admin/partners/${id}/deactivate`, {});
  }

  // ═══════════════════════════════════════════════════════════
  // 10. FINANCE (Commissions & Withdrawals)
  // ═══════════════════════════════════════════════════════════
  getAffiliates(): Observable<any[]> {
    return this.api.get<any>('/admin/affiliates').pipe(
      map(res => {
        if (res && Array.isArray(res.items)) return res.items;
        if (Array.isArray(res)) return res;
        return [];
      }),
      catchError(() => of([]))
    );
  }

  getCommissions(pageNumber: number = 1, pageSize: number = 100): Observable<AdminCommissionDto[]> {
    return this.api.get<any>(`/admin/affiliate/commissions?pageNumber=${pageNumber}&pageSize=${pageSize}`).pipe(
      map(res => {
        if (res && Array.isArray(res.items)) return res.items;
        if (Array.isArray(res)) return res;
        return [];
      }),
      catchError(() => of([]))
    );
  }

  approveCommission(id: string): Observable<any> {
    return this.api.put<any>(`/admin/affiliate/commissions/${id}/approve`, {});
  }

  rejectCommission(id: string): Observable<any> {
    return this.api.put<any>(`/admin/affiliate/commissions/${id}/reject`, {});
  }

  getWithdrawals(status?: string, pageNumber: number = 1, pageSize: number = 100): Observable<AdminWithdrawalDto[]> {
    const q = status ? `&status=${status}` : '';
    return this.api.get<any>(`/admin/affiliate/withdrawals?pageNumber=${pageNumber}&pageSize=${pageSize}${q}`).pipe(
      map(res => {
        if (res && Array.isArray(res.items)) return res.items;
        if (Array.isArray(res)) return res;
        return [];
      }),
      catchError(() => of([]))
    );
  }

  approveWithdrawal(id: string): Observable<any> {
    return this.api.put<any>(`/admin/affiliate/withdrawals/${id}/approve`, {});
  }

  rejectWithdrawal(id: string, reason?: string): Observable<any> {
    return this.api.put<any>(`/admin/affiliate/withdrawals/${id}/reject`, { reason });
  }

  processWithdrawal(id: string, transactionReference?: string): Observable<any> {
    return this.api.put<any>(`/admin/affiliate/withdrawals/${id}/process`, { transactionReference });
  }

  // ═══════════════════════════════════════════════════════════
  // 11. PROMOTIONS (Coupons, Flash Sales, Discounts, Banners)
  // ═══════════════════════════════════════════════════════════
  getCoupons(): Observable<AdminCouponDto[]> {
    return this.api.get<AdminCouponDto[]>('/admin/coupons').pipe(
      catchError(() => of([]))
    );
  }

  createCoupon(data: any): Observable<any> {
    return this.api.post<any>('/admin/coupons', data);
  }

  deleteCoupon(id: string): Observable<any> {
    return this.api.delete<any>(`/admin/coupons/${id}`);
  }

  getFlashSales(): Observable<AdminFlashSaleDto[]> {
    return this.api.get<any>('/admin/flash-sales').pipe(
      map(res => {
        if (Array.isArray(res)) return res as AdminFlashSaleDto[];
        if (res && Array.isArray(res.items)) return res.items as AdminFlashSaleDto[];
        return [];
      }),
      catchError(() => of([]))
    );
  }

  createFlashSale(data: {
    name: string;
    startDate: string;
    endDate: string;
    products: Array<{ productId: string; discountType: number; discountValue: number }>;
  }): Observable<any> {
    return this.api.post<any>('/admin/flash-sales', data);
  }

  deleteFlashSale(id: string): Observable<any> {
    return this.api.delete<any>(`/admin/flash-sales/${id}`);
  }

  getDiscounts(): Observable<any[]> {
    return this.api.get<any[]>('/Discounts').pipe(
      catchError(() => of([]))
    );
  }

  createDiscount(data: any): Observable<any> {
    return this.api.post<any>('/discounts-management', data);
  }

  deleteDiscount(id: string): Observable<any> {
    return this.api.delete<any>(`/discounts-management/${id}`);
  }

  getBanners(): Observable<AdminBannerDto[]> {
    return this.api.get<any>('/admin/banners?pageNumber=1&pageSize=200').pipe(
      map((res) => {
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.items)
            ? res.items
            : Array.isArray(res?.Items)
              ? res.Items
              : [];
        return list.map((b: any) => this.mapBanner(b));
      }),
      catchError(() => of([]))
    );
  }

  private mapBanner(b: any): AdminBannerDto {
    return {
      id: String(b.id ?? b.Id ?? ''),
      title: b.title ?? b.Title ?? '',
      subtitle: b.subtitle ?? b.Subtitle ?? null,
      description: b.description ?? b.Description ?? null,
      imageUrl: b.imageUrl ?? b.ImageUrl ?? '',
      linkUrl: b.linkUrl ?? b.LinkUrl ?? null,
      targetUrl: b.linkUrl ?? b.LinkUrl ?? b.targetUrl ?? null,
      sortOrder: b.sortOrder ?? b.SortOrder ?? 0,
      isActive: b.isActive ?? b.IsActive ?? true,
      price: b.price ?? b.Price ?? null,
      originalPrice: b.originalPrice ?? b.OriginalPrice ?? null,
      buttonText: b.buttonText ?? b.ButtonText ?? null,
      backgroundColor: b.backgroundColor ?? b.BackgroundColor ?? null,
      textColor: b.textColor ?? b.TextColor ?? null,
      availableSizes: b.availableSizes ?? b.AvailableSizes ?? null,
      startDate: b.startDate ?? b.StartDate ?? null,
      endDate: b.endDate ?? b.EndDate ?? null
    };
  }

  createBanner(data: any): Observable<any> {
    return this.api.post<any>('/admin/banners', data);
  }

  updateBanner(id: string, data: any): Observable<any> {
    return this.api.put<any>(`/admin/banners/${id}`, data);
  }

  deleteBanner(id: string): Observable<any> {
    return this.api.delete<any>(`/admin/banners/${id}`);
  }

  uploadBannerImage(file: File): Observable<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.post<any>('/admin/banners/upload', formData).pipe(
      map((res: any) => ({
        imageUrl: res?.imageUrl ?? res?.ImageUrl ?? res?.logoUrl ?? res?.LogoUrl ?? res?.url ?? res?.value ?? ''
      }))
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 12. CONTENT (Blog & CMS)
  // ═══════════════════════════════════════════════════════════
  getBlogPosts(pageNumber: number = 1, pageSize: number = 50): Observable<AdminBlogPostDto[]> {
    return this.api.get<any>(`/admin/blog/posts?pageNumber=${pageNumber}&pageSize=${pageSize}`).pipe(
      map(res => {
        if (res && Array.isArray(res.items)) return res.items;
        if (Array.isArray(res)) return res;
        return [];
      }),
      catchError(() => of([]))
    );
  }

  createBlogPost(data: {
    title: string;
    content: string;
    coverImageUrl?: string | null;
    blogCategoryId?: string | null;
    isPublished?: boolean;
    seoTitle?: string | null;
    seoDescription?: string | null;
  }): Observable<any> {
    return this.api.post<any>('/admin/blog/posts', {
      blogCategoryId: data.blogCategoryId || null,
      title: data.title,
      content: data.content,
      coverImageUrl: data.coverImageUrl || null,
      isPublished: data.isPublished ?? true,
      seoTitle: data.seoTitle || null,
      seoDescription: data.seoDescription || null
    });
  }

  updateBlogPost(id: string, data: {
    title: string;
    content: string;
    coverImageUrl?: string | null;
    blogCategoryId?: string | null;
    isPublished?: boolean;
    seoTitle?: string | null;
    seoDescription?: string | null;
  }): Observable<any> {
    return this.api.put<any>(`/admin/blog/posts/${id}`, {
      blogCategoryId: data.blogCategoryId || null,
      title: data.title,
      content: data.content,
      coverImageUrl: data.coverImageUrl || null,
      isPublished: data.isPublished ?? true,
      seoTitle: data.seoTitle || null,
      seoDescription: data.seoDescription || null
    });
  }

  getBlogPostById(id: string): Observable<AdminBlogPostDto | null> {
    return this.api.get<any>(`/admin/blog/posts/${id}`).pipe(
      catchError(() => of(null))
    );
  }

  deleteBlogPost(id: string): Observable<any> {
    return this.api.delete<any>(`/admin/blog/posts/${id}`);
  }

  createBlogCategory(name: string): Observable<any> {
    return this.api.post<any>('/admin/blog/categories', { name });
  }

  getCmsPages(): Observable<AdminCmsDto[]> {
    return this.api.get<any>('/admin/cms').pipe(
      map(res => {
        if (Array.isArray(res)) return res;
        if (res && Array.isArray(res.items)) return res.items;
        return null;
      }),
      catchError(() => of(null)),
      map(res => {
        if (res && res.length > 0) return res;
        return [
          { id: 'privacy-policy', slug: 'privacy-policy', title: 'Privacy Policy', content: 'Our commitment to protecting your personal data, customer privacy, and data security.' },
          { id: 'terms-of-service', slug: 'terms-of-service', title: 'Terms of Service', content: 'Standard marketplace rules, vendor terms, and customer conduct policies.' },
          { id: 'return-policy', slug: 'return-policy', title: 'Return & Refund Policy', content: 'Return window, damaged goods dispute procedures, and refund timelines.' },
          { id: 'about-us', slug: 'about-us', title: 'About Us', content: 'Learn more about the vision, platform story, and founders behind Eseller.' },
          { id: 'shipping-policy', slug: 'shipping-policy', title: 'Shipping & Delivery', content: 'Nationwide delivery estimates, partner couriers, and delivery tracking rules.' }
        ];
      })
    );
  }

  getCmsPage(slug: string): Observable<AdminCmsDto | null> {
    return this.api.get<AdminCmsDto>(`/admin/cms/${slug}`).pipe(
      catchError(() => this.api.get<AdminCmsDto>(`/cms/${slug}`).pipe(catchError(() => of(null))))
    );
  }

  saveCmsPage(data: { id?: string; slug: string; title: string; content: string }): Observable<any> {
    const isGuid = data.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id);
    if (isGuid) {
      return this.api.put<any>(`/admin/cms/${data.id}`, { title: data.title, content: data.content });
    }
    // Attempt create
    return this.api.post<any>('/admin/cms', {
      slug: data.slug,
      title: data.title,
      content: data.content
    }).pipe(
      catchError(err => {
        // If slug already exists or conflict, try finding it and updating
        return this.getCmsPage(data.slug).pipe(
          switchMap(page => {
            if (page && page.id) {
              return this.api.put<any>(`/admin/cms/${page.id}`, { title: data.title, content: data.content });
            }
            throw err;
          })
        );
      })
    );
  }

  updateCmsPage(slugOrId: string, data: { title: string; content: string; slug?: string }): Observable<any> {
    return this.saveCmsPage({
      id: slugOrId,
      slug: data.slug || slugOrId,
      title: data.title,
      content: data.content
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 13. REPORTS
  // ═══════════════════════════════════════════════════════════
  getSalesReport(fromDate?: string, toDate?: string): Observable<any> {
    let url = '/admin/reports/sales';
    const params: string[] = [];
    if (fromDate) params.push(`fromDate=${fromDate}`);
    if (toDate) params.push(`toDate=${toDate}`);
    if (params.length) url += `?${params.join('&')}`;
    return this.api.get<any>(url).pipe(
      catchError(() => of({ totalOrders: 0, deliveredOrders: 0, cancelledOrders: 0, totalRevenue: 0, deliveredRevenue: 0, averageOrderValue: 0, dailyBreakdown: [] }))
    );
  }

  getTopProducts(fromDate?: string, toDate?: string, limit = 10): Observable<any[]> {
    let url = `/admin/reports/top-products?limit=${limit}`;
    if (fromDate) url += `&fromDate=${fromDate}`;
    if (toDate) url += `&toDate=${toDate}`;
    return this.api.get<any[]>(url).pipe(
      catchError(() => of([]))
    );
  }

  getTopSellers(fromDate?: string, toDate?: string, limit = 10): Observable<any[]> {
    let url = `/admin/reports/top-sellers?limit=${limit}`;
    if (fromDate) url += `&fromDate=${fromDate}`;
    if (toDate) url += `&toDate=${toDate}`;
    return this.api.get<any[]>(url).pipe(
      catchError(() => of([]))
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 14. SETTINGS
  // ═══════════════════════════════════════════════════════════
  getSettings(): Observable<AdminSettingDto[]> {
    return this.api.get<any>('/admin/settings').pipe(
      map(res => {
        if (res && Array.isArray(res.items)) return res.items;
        if (Array.isArray(res)) return res;
        return [];
      }),
      catchError(() => of([
        { key: 'CommissionRate', value: '5', isActive: true, description: 'Default commission percentage' },
        { key: 'AffiliateCookieDurationDays', value: '30', isActive: true, description: 'Referral cookie window in days' },
        { key: 'DefaultWithdrawalThreshold', value: '2000', isActive: true, description: 'Minimum withdrawal threshold in USD' },
        { key: 'AutoApproveProducts', value: 'false', isActive: false, description: 'Require SuperAdmin review before products go live' },
        { key: 'MaintenanceMode', value: 'false', isActive: false, description: 'Put platform in maintenance mode' },
        { key: 'PlatformContactEmail', value: 'support@eseller.com', isActive: true, description: 'Platform support email' }
      ]))
    );
  }

  updateSetting(key: string, dataOrValue: { value: string; isActive?: boolean } | string, isActive: boolean = true): Observable<any> {
    const payload = typeof dataOrValue === 'object'
      ? { value: dataOrValue.value, isActive: dataOrValue.isActive ?? true }
      : { value: dataOrValue, isActive };
    return this.api.put<any>(`/admin/settings/${key}`, payload);
  }

  // ═══════════════════════════════════════════════════════════
  // 15. AUDIT LOGS
  // ═══════════════════════════════════════════════════════════
  getAuditLogs(actorType?: string, action?: string): Observable<AdminAuditLogDto[]> {
    let url = '/admin/audit-logs';
    const params: string[] = [];
    if (actorType) params.push(`actorType=${actorType}`);
    if (action) params.push(`action=${action}`);
    if (params.length) url += `?${params.join('&')}`;
    return this.api.get<any>(url).pipe(
      map(res => {
        if (Array.isArray(res)) return res;
        if (res && Array.isArray(res.items)) return res.items;
        return [];
      }),
      catchError(() => of([]))
    );
  }
}
