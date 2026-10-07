import { Injectable, inject } from '@angular/core';
import { ApiService, PagedList, ProductListDto, ProductDto } from 'eseller-shared';
import { Observable, of } from 'rxjs';
import { HttpParams } from '@angular/common/http';

export interface CreateProductDto {
  shopId: string;
  name: string;
  description?: string;
  basePrice: number;
  categoryId: string;
  brandId?: string | null;
  seoTitle?: string;
  seoDescription?: string;
}

export interface UpdateProductDto {
  name: string;
  description?: string;
  basePrice: number;
  categoryId: string;
  brandId?: string | null;
  seoTitle?: string;
  seoDescription?: string;
}

export interface ProductImageDto {
  id: string;
  productId: string;
  imageUrl: string;
  sortOrder: number;
  isCover?: boolean;
}

export interface VariantAttributeDto {
  id?: string;
  attributeName: string;
  attributeValue: string;
}

export interface ProductVariantDto {
  id: string;
  productId: string;
  sku: string;
  price: number;
  stockQty: number;
  lowStockThreshold: number;
  imageUrl?: string | null;
  isActive: boolean;
  attributes: VariantAttributeDto[];
  createdAt?: string;
}

export interface CreateVariantRequest {
  sku: string;
  price: number;
  stockQty: number;
  lowStockThreshold: number;
  attributes: { attributeName: string; attributeValue: string }[];
}

export interface UpdateVariantRequest {
  sku: string;
  price: number;
  stockQty: number;
  lowStockThreshold: number;
  isActive: boolean;
  attributes: { attributeName: string; attributeValue: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class SellerProductService {
  private readonly api = inject(ApiService);

  // Products
  getSellerProducts(shopId?: string, pageNumber = 1, pageSize = 50): Observable<PagedList<ProductListDto>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    if (shopId) {
      params = params.set('shopId', shopId);
      return this.api.get<PagedList<ProductListDto>>('/Products/my', { params });
    }
    return of({ items: [], totalCount: 0, pageNumber: 1, pageSize, totalPages: 0, hasPreviousPage: false, hasNextPage: false } as PagedList<ProductListDto>);
  }

  getProductById(id: string): Observable<ProductDto> {
    return this.api.get<ProductDto>(`/Products/${id}`);
  }

  createProduct(data: CreateProductDto): Observable<{ id?: string; productId?: string; isPendingApproval?: boolean; message: string }> {
    return this.api.post<{ id?: string; productId?: string; isPendingApproval?: boolean; message: string }>('/Products', data);
  }

  updateProduct(id: string, data: UpdateProductDto): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/Products/${id}`, data);
  }

  deleteProduct(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/Products/${id}`);
  }

  getProductImages(productId: string): Observable<ProductImageDto[]> {
    return this.api.get<ProductImageDto[]>(`/Products/${productId}/images`);
  }

  uploadImage(id: string, file: File): Observable<{ id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.postForm<{ id: string }>(`/Products/${id}/images`, formData);
  }

  uploadMultipleImages(id: string, files: File[]): Observable<{ count: number; imageIds: string[]; message: string }> {
    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f);
    }
    return this.api.postForm<{ count: number; imageIds: string[]; message: string }>(`/Products/${id}/images/bulk`, formData);
  }

  deleteProductImage(productId: string, imageId: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/Products/${productId}/images/${imageId}`);
  }

  setCoverImage(productId: string, imageId: string): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/Products/${productId}/images/${imageId}/cover`, {});
  }

  // Variants
  getProductVariants(productId: string): Observable<ProductVariantDto[]> {
    return this.api.get<ProductVariantDto[]>(`/products/${productId}/variants`);
  }

  createProductVariant(productId: string, data: CreateVariantRequest): Observable<{ variantId: string; message: string }> {
    return this.api.post<{ variantId: string; message: string }>(`/products/${productId}/variants`, data);
  }

  updateProductVariant(productId: string, id: string, data: UpdateVariantRequest): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/products/${productId}/variants/${id}`, data);
  }

  deleteProductVariant(productId: string, id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/products/${productId}/variants/${id}`);
  }

  uploadVariantImage(productId: string, id: string, file: File): Observable<{ imageUrl: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.postForm<{ imageUrl: string; message: string }>(`/products/${productId}/variants/${id}/image`, formData);
  }

  deleteVariantImage(productId: string, id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/products/${productId}/variants/${id}/image`);
  }
}
