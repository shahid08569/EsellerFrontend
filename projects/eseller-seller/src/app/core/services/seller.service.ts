import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from 'eseller-shared';

@Injectable({ providedIn: 'root' })
export class SellerService {
  private readonly api = inject(ApiService);

  /** GET /api/v1/Shops/my — returns array, we pick the first shop */
  getMyShop(): Observable<any> {
    return this.api.get<any[]>('/api/v1/Shops/my').pipe(
      map((shops: any[]) => (shops && shops.length ? shops[0] : null))
    );
  }

  /** GET /api/v1/Orders — paginated list for the current seller */
  getSellerOrders(page = 1, pageSize = 20): Observable<any> {
    return this.api.get<any>(`/api/v1/Orders?pageNumber=${page}&pageSize=${pageSize}`);
  }

  /** PUT /api/v1/SellerOrders/{id}/status */
  updateOrderStatus(id: string, newStatus: string): Observable<any> {
    return this.api.put<any>(`/api/v1/SellerOrders/${id}/status`, { newStatus });
  }

  /** PUT /api/v1/Shops/{id} */
  updateShop(id: string, data: any): Observable<any> {
    return this.api.put<any>(`/api/v1/Shops/${id}`, data);
  }

  /** POST /api/v1/Shops/{id}/logo — multipart FormData */
  uploadLogo(id: string, file: File): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    return this.api.post<any>(`/api/v1/Shops/${id}/logo`, form);
  }

  /** POST /api/v1/Shops/{id}/banner — multipart FormData */
  uploadBanner(id: string, file: File): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    return this.api.post<any>(`/api/v1/Shops/${id}/banner`, form);
  }
}
