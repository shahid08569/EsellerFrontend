export interface UserLocationLogDto {
  id: string;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  deviceType?: string | null;
  ipAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  action: string;
  recordedAt: string;
}

export interface AdminShopkeeperDto {
  id: string;
  accountId: string;
  name: string;
  email: string;
  phone: string;
  storeName: string;
  storeUrl: string;
  city: string;
  country: string;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  isActive?: boolean;
  lastLoginAt?: string | null;
  lastLoginCity?: string | null;
  lastLoginCountry?: string | null;
  lastLoginDevice?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  totalProducts?: number;
  totalOrders?: number;
  totalRevenue?: number;
  shopId?: string | null;
  rating?: number | null;
  documentType?: string | null;
  documentNumber?: string | null;
  documentUrl?: string | null;
  cnicFrontUrl?: string | null;
  cnicBackUrl?: string | null;
  referralCode?: string | null;
  referralsCount?: number;
  referredByCode?: string | null;
  referredByName?: string | null;
}

export interface ShopCategoryDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  badgeText?: string | null;
  badgeColor?: string | null;
  iconUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
  shopsCount?: number;
  createdAt: string;
  priceUsd?: number;
  maxProductListings?: number;
  isRecommended?: boolean;
}

export interface AdminShopDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl: string | null;
  bannerUrl?: string | null;
  phone?: string | null;
  address?: string | null;
  city: string | null;
  country: string | null;
  rating: number;
  totalProducts: number;
  isActive?: boolean;
  createdAt: string;
  shopCategoryId?: string | null;
  shopCategoryName?: string | null;
  badgeText?: string | null;
  badgeColor?: string | null;
  iconUrl?: string | null;
}

export interface AdminProductDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  basePrice: number;
  primaryImageUrl: string | null;
  images?: { id: string; imageUrl: string; sortOrder?: number; isPrimary?: boolean }[];
  shopName: string;
  shopSlug: string;
  categoryId?: string;
  categoryName: string;
  brandId?: string;
  brandName: string | null;
  avgRating: number;
  isFeatured: boolean;
  isApproved: boolean;
  /** Master Warehouse: true = also on customer website */
  isStorefrontLive?: boolean;
  status?: string;
  rejectionReason: string | null;
  createdAt: string;
  shopId?: string;
  sourceProductId?: string | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PlatformDashboardDto {
  totalShops: number;
  activeShops: number;
  pendingShops: number;
  totalProducts: number;
  approvedProducts: number;
  pendingProducts: number;
  rejectedProducts: number;
  totalOrders: number;
  newOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  deliveredRevenue: number;
  totalAffiliates: number;
  activeAffiliates: number;
  totalCommissionsPaid: number;
  totalCommissionsPending: number;
  pendingWithdrawals: number;
  pendingWithdrawalsAmount: number;
  totalCustomers: number;
  totalShopkeepers: number;
  lastOrderAt?: string | null;
  lastShopRegisteredAt?: string | null;
  lastAffiliateRegisteredAt?: string | null;
  revenueGrowthPercent?: number;
  ordersGrowthPercent?: number;
  shipmentsGrowthPercent?: number;
  customersGrowthPercent?: number;
  monthlyRevenue?: Array<{ month: string; revenue: number; growthPercent: number }>;
  weeklyOrders?: Array<{ day: string; orders: number }>;
  lowStockAlerts?: Array<{ id: string; name: string; sku: string; categoryName: string; stock: number; imageUrl?: string | null }>;
}

export interface AdminCategoryDto {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  parentName?: string | null;
  imageUrl?: string | null;
  productCount?: number;
  displayOrder?: number;
  homepageDisplayOrder?: number;
  isFeaturedOnHomepage?: boolean;
  isActive?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  children?: AdminCategoryDto[];
}

export interface AdminBrandDto {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  description?: string | null;
  productCount?: number;
  isActive?: boolean;
}

export interface AdminOrderDto {
  paymentStatus?: string;
  paymentMethod?: string;
  id: string;
  orderNumber?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shopName?: string;
  status: number | string;
  statusText?: string;
  totalAmount: number;
  totalItems?: number;
  createdAt: string;
  shippingAddress?: string;
  city?: string;
  items?: any[];
}

export interface AdminCustomerDto {
  id: string;
  accountId: string;
  name: string;
  email: string;
  phone?: string | null;
  totalOrders: number;
  totalSpent: number;
  isActive: boolean;
  /** Pending | Approved | Rejected */
  status?: string;
  createdAt: string;
  lastLoginAt?: string | null;
  lastLoginCity?: string | null;
  lastLoginCountry?: string | null;
  lastLoginDevice?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AdminPartnerDto {
  id: string;
  accountId: string;
  name?: string;
  email: string;
  permissions?: string | string[];
  isActive: boolean;
  createdAt: string;
}

export interface AdminCommissionDto {
  id: string;
  affiliateId?: string;
  affiliateName?: string;
  recipientName?: string;
  orderId: string;
  orderAmount?: number;
  commissionAmount?: number;
  amount: number;
  rate?: number;
  status: 'Pending' | 'Approved' | 'Paid' | 'Reversed' | string;
  createdAt: string;
}

export interface AdminWithdrawalDto {
  id: string;
  accountId: string;
  affiliateId?: string;
  affiliateEmail?: string;
  shopId?: string;
  userName?: string;
  userType?: string;
  storeName?: string;
  requesterName?: string;
  amount: number;
  paymentMethod?: string;
  payoutMethod: string;
  accountDetails?: string;
  transactionReference?: string;
  requestedAt?: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Processed' | 'Rejected' | string;
  createdAt: string;
  hasBankDetails?: boolean;
}

export interface AdminCouponDto {
  id: string;
  code: string;
  type?: number | string;
  discountType?: 'Percentage' | 'Fixed' | string;
  value: number;
  minOrderAmount?: number | null;
  maxDiscount?: number | null;
  expiryDate?: string;
  expiresAt?: string;
  usageLimit?: number | null;
  usedCount?: number;
  isActive: boolean;
}

export interface AdminFlashSaleDto {
  id: string;
  name?: string;
  title?: string;
  discountPercentage?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  productsCount?: number;
}

export interface AdminBannerDto {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  imageUrl: string;
  targetUrl?: string;
  linkUrl?: string;
  placement?: string;
  sortOrder?: number;
  isActive: boolean;
  price?: number | null;
  originalPrice?: number | null;
  buttonText?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  availableSizes?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface AdminPaymentLogoDto {
  id: string;
  name: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminBlogPostDto {
  id: string;
  title: string;
  slug: string;
  content?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  status?: string;
  categoryName?: string;
  coverImageUrl?: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
  createdAt: string;
}

export interface AdminCmsDto {
  id: string;
  slug: string;
  title: string;
  content: string;
  updatedAt?: string;
}

export interface AdminSettingDto {
  key: string;
  value: string;
  isActive: boolean;
  description?: string;
}

export interface AdminAuditLogDto {
  id: string;
  actorEmail?: string;
  userEmail?: string;
  actorType?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  timestamp?: string;
  createdAt: string;
}

export interface AdminReviewDto {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  orderRequestItemId?: string | null;
  isVerifiedPurchase: boolean;
  rating: number;
  title?: string | null;
  comment?: string | null;
  isApproved: boolean;
  createdAt: string;
  productName?: string | null;
  shopName?: string | null;
}

export interface AdminSellerWalletDto {
  accountId: string;
  shopkeeperName: string;
  shopName?: string | null;
  walletBalance: number;
  pendingEarnings: number;
  availableEarnings: number;
}

export interface AdminWithdrawalPaymentMethodDto {
  id: string;
  name: string;
  details: string;
  isActive: boolean;
}

export interface AdminAffiliateDto {
  id: string;
  code?: string;
  referralCode?: string;
  shopId?: string;
  shopName: string;
  shopSlug?: string;
  shopOwner?: string;
  sellerName?: string;
  shopEmail?: string;
  email?: string;
  phone?: string;
  clicksCount?: number;
  totalClicks?: number;
  conversionsCount?: number;
  totalConversions?: number;
  activeStoresCount?: number;
  activeConversions?: number;
  totalEarned?: number;
  isActive?: boolean;
  createdAt: string;
}

export interface AdminReferredStoreDto {
  id?: string;
  shopId?: string;
  shopName: string;
  shopSlug?: string;
  ownerName?: string;
  sellerName?: string;
  email?: string;
  phoneNumber?: string | null;
  phone?: string | null;
  status?: string;
  isApproved: boolean;
  productsCount?: number;
  totalProducts?: number;
  registeredAt: string;
  hasListedProducts: boolean;
}

export interface AdminAffiliateDetailDto {
  affiliate: AdminAffiliateDto;
  referredShops?: AdminReferredStoreDto[];
  referredStores?: AdminReferredStoreDto[];
}

export interface AdminShopTrafficItemDto {
  shopId: string;
  shopName: string;
  slug: string;
  logoUrl?: string | null;
  ownerName: string;
  ownerEmail: string;
  rating: number;
  isApproved: boolean;
  isActive: boolean;
  totalVisits: number;
  todayVisits: number;
  thisMonthVisits: number;
  lastMonthVisits: number;
  growthRate: number;
  trendDirection: 'up' | 'down' | 'flat';
}

export interface ShopTrafficPointDto {
  date: string;
  label: string;
  visits: number;
  uniqueVisitors: number;
  isManual: boolean;
}

export interface ShopTrafficMonthDto {
  year: number;
  month: number;
  monthName: string;
  visits: number;
  uniqueVisitors: number;
  autoTrackedVisits?: number;
  manualVisits?: number;
  isManual: boolean;
}

export interface ShopTrafficSummaryDto {
  shopId: string;
  shopName: string;
  logoUrl?: string | null;
  totalVisits: number;
  todayVisits: number;
  thisMonthVisits: number;
  lastMonthVisits: number;
  growthRate: number;
  trendDirection: 'up' | 'down' | 'flat';
  range: string;
  timeline: ShopTrafficPointDto[];
  monthlyBreakdown: ShopTrafficMonthDto[];
}
