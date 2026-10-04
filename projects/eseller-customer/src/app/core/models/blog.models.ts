export interface CustomerBlogPostDto {
  id: string;
  blogCategoryId?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  title: string;
  slug: string;
  coverImageUrl?: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
  createdAt: string;
  content?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface CustomerBlogPagedResult {
  items: CustomerBlogPostDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}
