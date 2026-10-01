export interface OrderRequestListDto {
  id: string;
  status: string;
  totalAmount: number;
  totalItems: number;
  totalShops: number;
  createdAt: string;
}

export interface OrderRequestItemDto {
  id: string;
  productId: string;
  productVariantId: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  productNameSnapshot: string;
  sku: string;
  variantAttributesSnapshot?: string | null;
  quantity: number;
  unitPriceSnapshot: number;
  totalPriceSnapshot: number;
  priceAtOrder: number;
  availableStock?: number | null;
}

export interface OrderRequestDto {
  id: string;
  status: string;
  totalAmount: number;
  totalItems: number;
  affiliateId?: string | null;
  referralCodeSnapshot?: string | null;
  items: OrderRequestItemDto[];
  createdAt: string;
  updatedAt: string;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  orderNotes?: string | null;
}

export interface OrderStatusHistoryDto {
  id: string;
  orderRequestId: string;
  oldStatus: string;
  newStatus: string;
  changedByAccountId?: string | null;
  changedByType: string;
  changedAt: string;
}

export interface OrderTrackingDto {
  orderRequestId: string;
  currentStatus: string;
  createdAt: string;
  timeline: OrderStatusHistoryDto[];
}

export interface CreateOrderRequest {
  referralCode?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  orderNotes?: string | null;
}

export interface BuyNowRequest {
  productVariantId: string;
  quantity: number;
  referralCode?: string | null;
}

export interface PagedOrdersResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
