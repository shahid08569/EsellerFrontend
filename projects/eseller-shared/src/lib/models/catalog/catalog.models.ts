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
  categoryName: string;
  brandName: string | null;
  avgRating: number | null;
  isFeatured: boolean;
  isApproved: boolean;
  status: string;
  rejectionReason: string | null;
  createdAt: string; // ISO 8601
  badges: ProductBadgeDto | null;
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