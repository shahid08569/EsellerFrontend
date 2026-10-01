import { Injectable, inject } from '@angular/core';
import { ApiService, PagedList, ProductListDto, ProductDto } from 'eseller-shared';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';

export interface CreateProductDto {
  name: string;
  description?: string;
  basePrice: number;
  categoryId: string;
  brandId?: string | null;
  seoTitle?: string;
  seoDescription?: string;
}

export interface UpdateProductDto extends CreateProductDto {}

@Injectable({
  providedIn: 'root'
})
export class SellerProductService {
  private readonly api = inject(ApiService);

  // Get products specific to this seller
  getSellerProducts(pageNumber = 1, pageSize = 20): Observable<PagedList<ProductListDto>> {
    // In a real app, backend filters by current user's shop ID if Role is Shopkeeper
    const params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);
    return this.api.get<PagedList<ProductListDto>>('/Products', { params });
  }

  createProduct(data: CreateProductDto): Observable<{ id: string; message: string }> {
    return this.api.post<{ id: string; message: string }>('/Products', data);
  }

  updateProduct(id: string, data: UpdateProductDto): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/Products/${id}`, data);
  }

  deleteProduct(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/Products/${id}`);
  }

  uploadImage(id: string, file: File, isPrimary: boolean = false): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('isPrimary', String(isPrimary));
    return this.api.post(`/Products/${id}/images`, formData);
  }
}
