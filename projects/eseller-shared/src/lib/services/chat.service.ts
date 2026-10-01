import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { ApiService } from './api.service';
import {
  ChatMessageDto,
  PagedChatMessages,
  SendChatMessageResponse
} from '../models/chat/chat.models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(ApiService);

  /**
   * Get chat messages for an order.
   */
  getMessages(
    orderId: string,
    pageNumber: number = 1,
    pageSize: number = 50
  ): Observable<PagedChatMessages | null> {
    return this.api
      .get<PagedChatMessages>(`/Chat/${orderId}/messages?pageNumber=${pageNumber}&pageSize=${pageSize}`)
      .pipe(
        catchError((err) => {
          console.warn('Failed to load chat messages from API', err);
          return of(null);
        })
      );
  }

  /**
   * Send a message to an order chat room.
   */
  sendMessage(
    orderId: string,
    message: string
  ): Observable<SendChatMessageResponse> {
    return this.api.post<SendChatMessageResponse>(`/Chat/${orderId}/messages`, {
      message
    });
  }

  /**
   * Mark a specific message as read.
   */
  markAsRead(messageId: string): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/Chat/messages/${messageId}/read`, {});
  }

  /**
   * Get total unread messages count for the logged in user.
   */
  getUnreadCount(): Observable<{ unreadCount: number }> {
    return this.api.get<{ unreadCount: number }>('/Chat/unread-count');
  }
}
