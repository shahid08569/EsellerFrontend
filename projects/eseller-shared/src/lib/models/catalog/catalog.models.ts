/**
 * ============================================================
 * Eseller — Catalog Models
 * ============================================================
 * Strictly mirrors backend DTOs.
 *
 * Backend references:
 *   - Eseller.Application/Features/Products/ProductDto.cs
 *   - Eseller.Application/Features/Categories/CategoryDto.cs
 *   - Eseller.Application/Features/Categories/CategoryTreeDto.cs
 *   - Eseller.Application/Features/Brands/BrandDto.cs
 *   - Eseller.Application/Features/Banners/HomepageBannerDto.cs
 *   - Eseller.Application/Features/FlashSales/FlashSaleDto.cs
 *   - Eseller.Application/Features/FlashSales/FlashSaleProductDto.cs
 * ============================================================
 */

// PRODUCT
export interface ProductDto {
  id: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  categoryId: string;
  categoryName: string;
  brandId: string | null;
  brandName: string | null;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  isFeatured: boolean;
  isApproved: boolean;
  status: string;
  rejectionReason: string | null;
  viewCount: number;
  avgRating: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isActive: boolean;
  createdAt: string; // ISO 8601
  /** SuperAdmin platform store rating (0–5) */
  shopRating?: number | null;
  /** Seller tier badge (Gold / Diamond / Bronze…) */
  shopBadgeText?: string | null;
  shopBadgeColor?: string | null;
}
// PRODUCT — LIST 
export interface ProductListDto {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  primaryImageUrl: string | null;
  shopName: string;
  shopSlug: string;
  categoryId?: string;
  categoryName: string;
  categorySlug?: string;
  brandId?: string | null;
  brandName: string | null;
  avgRating: number | null;
  /** Approved reviewer count from API */
  reviewCount?: number | null;
  isFeatured: boolean;
  isApproved: boolean;
  status: string;
  rejectionReason: string | null;
  createdAt: string; // ISO 8601
  badges: ProductBadgeDto | null;
  /** @deprecated use reviewCount */
  reviewsCount?: number | null;
  viewCount?: number | null;
  sourceProductId?: string | null;
  shopId?: string | null;
  /** SuperAdmin platform store rating (0–5) */
  shopRating?: number | null;
  /** Seller tier badge (Gold / Diamond / Bronze…) */
  shopBadgeText?: string | null;
  shopBadgeColor?: string | null;
  /** Short description for category cards */
  description?: string | null;
  /** Master Warehouse opt-in to customer website */
  isStorefrontLive?: boolean;
}
//PRODUCT BADGE DTO
export interface ProductBadgeDto {
  isNew: boolean;
  isBestSelling: boolean;
  isHotSelling: boolean;
  isFeatured: boolean;
  isFlashSale: boolean;
  isLowStock: boolean;
  isOutOfStock: boolean;
  discountPercent: number | null;
  flashSaleDiscountPercent: number | null;
  flashSaleEndDate: string | null; 
}
// CATEGORY
export interface CategoryDto {
  id: string;
  parentCategoryId: string | null;
  name: string;
  slug: string;
  imageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isActive: boolean;
  createdAt: string;
}
//CATEGORY-TREE
export interface CategoryTreeDto {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  children: CategoryTreeDto[];
  isFeaturedOnHomepage?: boolean;
  homepageDisplayOrder?: number;
}
// BRAND
export interface BrandDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
}
// HOMEPAGE PAYMENT SHOWCASE LOGO
/** Storefront nav / footer branding + SEO (Settings-backed). */
export interface PlatformBrandingDto {
  navLogoUrl: string;
  footerLogoUrl: string;
  tagline: string;
  /** Browser tab / Google result title */
  siteTitle?: string;
  /** Google search snippet description */
  metaDescription?: string;
  /** Favicon URL (defaults to nav logo when empty) */
  faviconUrl?: string;
}

export interface PaymentShowcaseLogoDto {
  id: string;
  name: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
// HOMEPAGE BANNER
export interface HomepageBannerDto {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  isCurrentlyActive: boolean;
  startDate: string | null;
  endDate: string | null;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  price?: number | null;
  originalPrice?: number | null;
  buttonText?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  availableSizes?: string | null;
  createdAt: string;
  updatedAt: string;
}
// FLASH SALE
export interface FlashSaleDto {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isCurrentlyActive: boolean;
  productCount: number;
  products: FlashSaleProductDto[];
  createdAt: string;
  updatedAt: string;
}
//FLASHSALEPRODUCT DTO
export interface FlashSaleProductDto {
  id: string;
  productId: string;
  productName: string;
  discountType: number;
  discountValue: number;
}
// QUERY PARAMS — Get Products
export interface GetProductsQuery {
  categoryId?: string | null;
  brandId?: string | null;
  shopId?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minRating?: number | null;
  search?: string | null;
  isFeatured?: boolean | null;
  sortBy?: 'newest' | 'popular' | 'price_asc' | 'price_desc' | 'rating';
  pageNumber?: number;
  pageSize?: number;
}
// PAGED LIST 
export interface PagedList<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
// HOMEPAGE CATEGORY SECTION
export interface HomepageCategorySectionDto {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  displayOrder: number;
  products: ProductListDto[];
}

// PRODUCT IMAGE
export interface ProductImageDto {
  id: string;
  productId: string;
  imageUrl: string;
  sortOrder: number;
  isCover?: boolean;
}

// VARIANT ATTRIBUTE
export interface VariantAttributeDto {
  id: string;
  attributeName: string;
  attributeValue: string;
}

// PRODUCT VARIANT
export interface ProductVariantDto {
  id: string;
  productId: string;
  sku: string;
  price: number;
  stockQty: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  isActive: boolean;
  attributes: VariantAttributeDto[];
  createdAt: string;
}

// REVIEW
export interface ReviewDto {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  orderRequestItemId: string | null;
  isVerifiedPurchase: boolean;
  rating: number;
  title: string | null;
  comment: string | null;
  isApproved: boolean;
  createdAt: string;
}

// PRODUCT QUESTION
export interface ProductQuestionDto {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  question: string;
  isApproved: boolean;
  createdAt: string;
  answer: string | null;
  answeredByShopkeeperId: string | null;
  answeredByName: string | null;
  answeredAt: string | null;
}

// CATEGORY TO BRAND MAPPING
export const CATEGORY_BRAND_MAP: Record<string, string[]> = {
  'men-clothing': ['zara', 'forever-21', 'levis', 'nike', 'adidas', 'gucci', 'polo'],
  'women-clothing': ['zara', 'forever-21', 'gucci', 'h-m', 'khaadi', 'sapphire'],
  'shoes-bags': ['nike', 'adidas', 'zara', 'gucci', 'bata', 'service'],
  'electronics': ['apple', 'samsung', 'sony', 'dell', 'hp', 'xiaomi', 'lenovo'],
  'home-living': ['ikea', 'haier', 'dawlance', 'kenwood'],
  'beauty-health': ['loreal', 'the-body-shop', 'garnier', 'nivea'],
  'sports-outdoor': ['nike', 'adidas', 'puma', 'under-armour'],
  'jewelry-watches': ['rolex', 'casio', 'fossil', 'titan'],
  'automobile': ['toyota', 'honda', 'suzuki', 'yamaha', 'bosch'],
  'books-stationery': ['oxford', 'faber-castell', 'dollar', 'piano'],
  'kids-toys': ['lego', 'hasbro', 'barbie', 'hot-wheels', 'fisher-price']
};

export function filterBrandsForCategory(
  allBrands: BrandDto[],
  categorySlug: string | null | undefined,
  products?: { brandName?: string | null }[]
): BrandDto[] {
  if (!allBrands || allBrands.length === 0) return [];
  if (!categorySlug) return allBrands;

  const slug = categorySlug.toLowerCase();
  const allowed = CATEGORY_BRAND_MAP[slug];

  const productBrands = new Set(
    (products || [])
      .map((p) => p.brandName?.toLowerCase())
      .filter(Boolean)
  );

  const matched = allBrands.filter((b) => {
    const bSlug = b.slug.toLowerCase();
    const bName = b.name.toLowerCase();
    const matchesProduct = productBrands.has(bName) || productBrands.has(bSlug);
    const matchesAllowed = allowed && (allowed.includes(bSlug) || allowed.includes(bName));
    return matchesProduct || matchesAllowed;
  });

  if (matched.length > 0) {
    return matched;
  }

  return allBrands;
}
