import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap, of, catchError, shareReplay } from 'rxjs';
import { ApiService } from 'eseller-shared';

export interface ShopDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  phone?: string;
  address?: string;
  city: string;
  country: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  isApproved: boolean;
  isActive?: boolean;
  status?: string | null;
  rating?: number;
  totalProducts?: number;
  totalOrders?: number;
  totalRevenue?: number;
  createdAt?: string;
  maxProductLimit?: number;
  tierName?: string | null;
  tierPriceUsd?: number;
  shopCategoryId?: string | null;
  badgeText?: string | null;
}

export interface UpdateShopDto {
  name: string;
  description: string;
  phone?: string;
  address?: string;
  city: string;
  country: string;
}

export interface BrandDto {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  description?: string | null;
  productCount?: number;
  isActive?: boolean;
}

export interface LowStockVariantDto {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  lowStockThreshold: number;
  price: number;
  attributes?: Record<string, string>;
}

export interface DiscountDto {
  id: string;
  name?: string;
  productId?: string | null;
  productName?: string;
  scopeType: number | string;
  scopeId?: string | null;
  type: number | string; // 1 = Percentage, 2 = Fixed
  value: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface CouponDto {
  id: string;
  code: string;
  type: number | string;
  value: number;
  minOrderAmount?: number | null;
  maxDiscount?: number | null;
  expiryDate: string;
  usageLimit?: number | null;
  usedCount?: number;
  isActive: boolean;
}

export interface QuestionDto {
  id: string;
  productId: string;
  productName?: string;
  question: string;
  customerName?: string;
  answer?: string | null;
  answeredAt?: string | null;
  createdAt: string;
  isApproved: boolean;
}

export interface ReviewDto {
  id: string;
  productId: string;
  productName?: string;
  customerName: string;
  rating: number;
  title?: string;
  comment: string;
  createdAt: string;
  isApproved: boolean;
}

export interface OrderItemDto {
  id?: string;
  productId: string;
  productName: string;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  sku?: string;
}

export interface OrderDto {
  /** SellerOrder.Id */
  id: string;
  /** Parent OrderRequest.Id */
  orderRequestId?: string;
  orderNumber?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  city?: string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  merchantProfit?: number;
  totalAmount: number;
  totalItems?: number;
  items: OrderItemDto[];
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SellerService {
  private readonly api = inject(ApiService);
  private myShop$?: Observable<ShopDto | null>;

  /** GET /Shops/my — returns first shop, then enriches from /Shops/{id} */
  getMyShop(forceRefresh = false): Observable<ShopDto | null> {
    if (!this.myShop$ || forceRefresh) {
      this.myShop$ = this.api.get<any[]>('/Shops/my').pipe(
        switchMap((shops: any[]) => {
          if (!shops || !shops.length) {
            return of(null);
          }
          const shop = shops[0];
          const listApproved = shop.isApproved === true;
          const listStatus = shop.status ?? null;

          return this.api.get<ShopDto>(`/Shops/${shop.id}`).pipe(
            map(detail => ({
              ...shop,
              ...detail,
              isActive: detail.isActive === true,
              // Approval comes from shopkeeper status (/Shops/my), not shop.IsActive
              isApproved: listApproved,
              status: listStatus,
              // Tier capacity comes from /Shops/my (ShopListDto)
              maxProductLimit: shop.maxProductLimit ?? detail.maxProductLimit ?? 200,
              tierName: shop.tierName ?? shop.badgeText ?? detail.tierName ?? detail.badgeText ?? 'Bronze (Free)',
              badgeText: shop.badgeText ?? detail.badgeText ?? shop.tierName ?? 'Bronze (Free)',
              rating: Number(detail.rating ?? shop.rating ?? 0) || 0,
              logoUrl: detail.logoUrl ?? shop.logoUrl ?? null,
              bannerUrl: detail.bannerUrl ?? shop.bannerUrl ?? null,
              totalProducts: shop.totalProducts ?? detail.totalProducts ?? 0,
              totalOrders: shop.totalOrders ?? detail.totalOrders ?? 0,
              totalRevenue: shop.totalRevenue ?? detail.totalRevenue ?? 0
            })),
            catchError(() => of({
              ...shop,
              isActive: shop.isActive === true,
              isApproved: listApproved,
              status: listStatus,
              maxProductLimit: shop.maxProductLimit ?? 200,
              tierName: shop.tierName ?? shop.badgeText ?? 'Bronze (Free)',
              badgeText: shop.badgeText ?? shop.tierName ?? 'Bronze (Free)',
              rating: Number(shop.rating ?? 0) || 0,
              totalProducts: shop.totalProducts ?? 0,
              totalOrders: shop.totalOrders ?? 0,
              totalRevenue: shop.totalRevenue ?? 0
            } as ShopDto))
          );
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }

    return this.myShop$;
  }

  /** GET /Products — products list for seller */
  getMyProducts(page = 1, pageSize = 20, search?: string, shopId?: string): Observable<any> {
    let url = `/Products?pageNumber=${page}&pageSize=${pageSize}`;
    if (shopId) url += `&shopId=${shopId}`;
    if (search && search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
    return this.api.get<any>(url);
  }

  /** GET /Brands — all public brands */
  getBrands(): Observable<BrandDto[]> {
    return this.api.get<any>('/Brands').pipe(
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
          description: b.description ?? b.Description ?? null,
          productCount: b.productCount ?? b.ProductCount ?? 0,
          isActive: (b.isActive ?? b.IsActive) !== false
        })) as BrandDto[];
      }),
      catchError(() => of([]))
    );
  }

  /** GET /Categories — all categories */
  getCategories(): Observable<any[]> {
    return this.api.get<any[]>('/Categories').pipe(
      catchError(() => of([]))
    );
  }

  /** GET /shops/{shopId}/variants/low-stock */
  getLowStockVariants(shopId: string): Observable<LowStockVariantDto[]> {
    return this.api.get<LowStockVariantDto[]>(`/shops/${shopId}/variants/low-stock`).pipe(
      catchError(() => of([]))
    );
  }

  /** POST /products/{productId}/variants/{variantId}/inventory/adjust */
  adjustStock(productId: string, variantId: string, newQuantity: number, reason: string): Observable<any> {
    return this.api.post<any>(`/products/${productId}/variants/${variantId}/inventory/adjust`, {
      newQuantity,
      reason
    });
  }

  /** GET /SellerOrders — paginated commerce orders for this shopkeeper */
  getSellerOrders(page = 1, pageSize = 20): Observable<any> {
    return this.api.get<any>(`/SellerOrders?pageNumber=${page}&pageSize=${pageSize}`);
  }

  /** GET /SellerWallet/summary */
  getWalletSummary(): Observable<{
    walletBalance: number;
    pendingEarnings: number;
    availableEarnings: number;
    withdrawnEarnings: number;
    pendingWithdrawals: number;
    availableToWithdraw: number;
    minimumWithdrawal: number;
    merchantSharePercent: number;
  }> {
    return this.api.get(`/SellerWallet/summary`);
  }

  /** GET /SellerWallet/withdrawals */
  getWithdrawals(page = 1, pageSize = 50): Observable<any> {
    return this.api.get(`/SellerWallet/withdrawals?pageNumber=${page}&pageSize=${pageSize}`);
  }

  /** POST /SellerWallet/withdrawal-request */
  requestWithdrawal(payload: {
    amount: number;
    payoutMethod?: string;
    accountDetails?: string;
  }): Observable<{ id: string; message: string }> {
    return this.api.post(`/SellerWallet/withdrawal-request`, payload);
  }

  /** GET /SellerWallet/bank-details (masked) */
  getBankDetails(): Observable<{
    bankName?: string;
    cardHolderName?: string;
    cardNumberLast4?: string;
    cardNumberMasked?: string;
    expMonth?: number;
    expYear?: number;
    hasCvcSaved?: boolean;
    updatedAt?: string;
  } | null> {
    return this.api.get<any>('/SellerWallet/bank-details').pipe(
      map((res) => {
        if (!res || (!res.bankName && !res.BankName && !res.cardNumberLast4 && !res.CardNumberLast4)) {
          return null;
        }
        return {
          bankName: res.bankName ?? res.BankName ?? '',
          cardHolderName: res.cardHolderName ?? res.CardHolderName ?? '',
          cardNumberLast4: res.cardNumberLast4 ?? res.CardNumberLast4 ?? '',
          cardNumberMasked: res.cardNumberMasked ?? res.CardNumberMasked ?? '',
          expMonth: Number(res.expMonth ?? res.ExpMonth ?? 0),
          expYear: Number(res.expYear ?? res.ExpYear ?? 0),
          hasCvcSaved: !!(res.hasCvcSaved ?? res.HasCvcSaved),
          updatedAt: res.updatedAt ?? res.UpdatedAt
        };
      }),
      catchError(() => of(null))
    );
  }

  /** PUT /SellerWallet/bank-details */
  saveBankDetails(payload: {
    bankName: string;
    cardHolderName: string;
    cardNumber: string;
    expMonth: number;
    expYear: number;
    cvc: string;
  }): Observable<any> {
    return this.api.put('/SellerWallet/bank-details', payload);
  }

  /** GET /SellerWallet/payment-methods — active Management payout channels */
  getWithdrawalPaymentMethods(): Observable<Array<{
    id: string;
    name: string;
    details: string;
    isActive: boolean;
  }>> {
    return this.api.get<any>('/SellerWallet/payment-methods').pipe(
      map((res) => {
        const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        return list
          .map((m: any) => ({
            id: String(m.id ?? m.Id ?? ''),
            name: m.name ?? m.Name ?? '',
            details: m.details ?? m.Details ?? '',
            isActive: (m.isActive ?? m.IsActive) !== false
          }))
          .filter((m: { isActive: boolean; name: string }) => m.isActive && m.name);
      }),
      catchError(() => of([]))
    );
  }

  /** GET /shop-categories — active seller tier packages */
  getShopCategories(): Observable<Array<{
    id: string;
    name: string;
    slug?: string;
    description?: string | null;
    badgeText?: string | null;
    badgeColor?: string | null;
    iconUrl?: string | null;
    displayOrder?: number;
    priceUsd?: number;
    maxProductListings?: number;
    isRecommended?: boolean;
  }>> {
    return this.api.get<any[]>(`/shop-categories`).pipe(
      map((res) => Array.isArray(res) ? res : []),
      catchError(() => of([]))
    );
  }

  /** GET /Chat/{orderId}/messages */
  getOrderMessages(orderId: string, page = 1, pageSize = 50): Observable<any> {
    return this.api.get<any>(`/Chat/${orderId}/messages?pageNumber=${page}&pageSize=${pageSize}`).pipe(
      catchError(() => of([]))
    );
  }

  /** POST /Chat/{orderId}/messages */
  sendMessage(orderId: string, message: string): Observable<any> {
    return this.api.post<any>(`/Chat/${orderId}/messages`, { message });
  }

  /** GET /products/{productId}/questions */
  getProductQuestions(productId: string, page = 1, pageSize = 20): Observable<any> {
    return this.api.get<any>(`/products/${productId}/questions?pageNumber=${page}&pageSize=${pageSize}`).pipe(
      catchError(() => of([]))
    );
  }

  /** POST /seller/questions/{questionId}/answer */
  answerQuestion(questionId: string, answer: string): Observable<any> {
    return this.api.post<any>(`/seller/questions/${questionId}/answer`, { answer });
  }

  /** GET /products/{productId}/reviews */
  getProductReviews(productId: string, page = 1, pageSize = 20): Observable<any> {
    return this.api.get<any>(`/products/${productId}/reviews?pageNumber=${page}&pageSize=${pageSize}`).pipe(
      catchError(() => of([]))
    );
  }

  /** GET /Discounts */
  getDiscounts(page = 1, pageSize = 20): Observable<any> {
    return this.api.get<any>(`/Discounts?pageNumber=${page}&pageSize=${pageSize}`).pipe(
      catchError(() => of([]))
    );
  }

  /** POST /discounts-management */
  createDiscount(data: any): Observable<any> {
    return this.api.post<any>('/discounts-management', data);
  }

  /** DELETE /discounts-management/{id} */
  deleteDiscount(id: string): Observable<any> {
    return this.api.delete<any>(`/discounts-management/${id}`);
  }

  /** GET /coupons-management or /Coupons */
  getCoupons(page = 1, pageSize = 20): Observable<any> {
    return this.api.get<any>(`/Coupons?pageNumber=${page}&pageSize=${pageSize}`).pipe(
      catchError(() => of([]))
    );
  }

  /** POST /coupons-management */
  createCoupon(data: any): Observable<any> {
    return this.api.post<any>('/coupons-management', data);
  }

  /** DELETE /coupons-management/{id} */
  deleteCoupon(id: string): Observable<any> {
    return this.api.delete<any>(`/coupons-management/${id}`);
  }

  /** Clear cached /Shops/my result (after profile/logo/banner updates). */
  invalidateMyShopCache(): void {
    this.myShop$ = undefined;
  }

  /** PUT /Shops/{id} */
  updateShop(id: string, data: UpdateShopDto): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/Shops/${id}`, data).pipe(
      map(res => {
        this.invalidateMyShopCache();
        return res;
      })
    );
  }

  /** POST /Shops/{id}/logo — multipart FormData */
  uploadLogo(id: string, file: File): Observable<{ logoUrl: string; message: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.api.post<{ logoUrl: string; message: string }>(`/Shops/${id}/logo`, form).pipe(
      map(res => {
        this.invalidateMyShopCache();
        return res;
      })
    );
  }

  /** POST /Shops/{id}/banner — multipart FormData */
  uploadBanner(id: string, file: File): Observable<{ bannerUrl: string; message: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.api.post<{ bannerUrl: string; message: string }>(`/Shops/${id}/banner`, form).pipe(
      map(res => {
        this.invalidateMyShopCache();
        return res;
      })
    );
  }

  /** POST /Shops/tier-upgrade */
  requestTierUpgrade(data: {
    requestedTier: string;
    badgeText?: string;
    price?: number;
    paymentMethod?: string;
    referenceNote?: string;
    receiptUrl?: string | null;
    requestedCategoryId?: string | null;
  }): Observable<{ message: string; id: string }> {
    return this.api.post<{ message: string; id: string }>('/Shops/tier-upgrade', data);
  }
}
