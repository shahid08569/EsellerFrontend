import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  DashboardSummaryDto,
  UserProfileDto,
  UpdateProfileRequest,
  AddressDto,
  CreateAddressRequest,
  UpdateAddressRequest,
  DashboardNotificationDto
} from '../models/dashboard/dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  getSummary(): Observable<DashboardSummaryDto> {
    return this.api.get<DashboardSummaryDto>('/Dashboard/summary');
  }

  getProfile(): Observable<UserProfileDto> {
    return this.api.get<UserProfileDto>('/Dashboard/profile');
  }

  updateProfile(request: UpdateProfileRequest): Observable<{ message: string }> {
    return this.api.put<{ message: string }>('/Dashboard/profile', request);
  }

  getAddresses(): Observable<AddressDto[]> {
    return this.api.get<AddressDto[]>('/Dashboard/addresses');
  }

  createAddress(request: CreateAddressRequest): Observable<{ addressId: string; message: string }> {
    return this.api.post<{ addressId: string; message: string }>('/Dashboard/addresses', request);
  }

  updateAddress(id: string, request: UpdateAddressRequest): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/Dashboard/addresses/${id}`, request);
  }

  deleteAddress(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/Dashboard/addresses/${id}`);
  }

  getNotifications(
    unreadOnly?: boolean,
    pageNumber = 1,
    pageSize = 20
  ): Observable<{ items: DashboardNotificationDto[]; totalCount: number }> {
    let params = new HttpParams()
      .set('pageNumber', String(pageNumber))
      .set('pageSize', String(pageSize));
    if (unreadOnly !== undefined) {
      params = params.set('unreadOnly', String(unreadOnly));
    }
    return this.api.get<{ items: DashboardNotificationDto[]; totalCount: number }>(
      '/Dashboard/notifications',
      { params }
    );
  }

  markNotificationRead(id: string): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/Dashboard/notifications/${id}/read`, {});
  }

  markAllNotificationsRead(): Observable<{ message: string }> {
    return this.api.put<{ message: string }>('/Dashboard/notifications/read-all', {});
  }
}
