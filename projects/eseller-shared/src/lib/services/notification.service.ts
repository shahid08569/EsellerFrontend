import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AppNotificationDto } from '../models/notifications/notification.models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);

  getNotifications(
    unreadOnly?: boolean,
    pageNumber = 1,
    pageSize = 20
  ): Observable<{ items: AppNotificationDto[]; totalCount: number }> {
    let params = new HttpParams()
      .set('pageNumber', String(pageNumber))
      .set('pageSize', String(pageSize));
    if (unreadOnly !== undefined) {
      params = params.set('unreadOnly', String(unreadOnly));
    }
    return this.api.get<{ items: AppNotificationDto[]; totalCount: number }>(
      '/notifications',
      { params }
    );
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.api.get<{ count: number }>('/notifications/unread-count');
  }

  markRead(id: string): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/notifications/${id}/read`, {});
  }

  markAllRead(): Observable<{ message: string }> {
    return this.api.put<{ message: string }>('/notifications/read-all', {});
  }
}
