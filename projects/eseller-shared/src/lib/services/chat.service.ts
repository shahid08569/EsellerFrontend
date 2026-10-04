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

  markConversationAsRead(orderRequestId: string): Observable<{ message: string; markedCount?: number }> {
    return this.api.put<{ message: string; markedCount?: number }>(`/Chat/${orderRequestId}/read`, {});
  }

  /**
   * Get total unread messages count for the logged in user.
   */
  getUnreadCount(): Observable<{ unreadCount: number }> {
    return this.api.get<{ unreadCount: number }>('/Chat/unread-count');
  }

  /**
   * Get or create a support chat session.
   */
  getSupportSession(): Observable<{ orderRequestId: string; orderRef: string }> {
    return this.api.get<{ orderRequestId: string; orderRef: string }>('/Chat/support-session');
  }

  /**
   * Seller: open Super Admin support chat, optionally for a specific product.
   */
  getShopSupportSession(productId?: string | null): Observable<{
    orderRequestId: string;
    orderRef: string;
    shopId: string;
    shopName: string;
    product?: { id: string; name: string; price: number; imageUrl?: string | null } | null;
  }> {
    let url = '/Chat/shop-support-session';
    if (productId) url += `?productId=${encodeURIComponent(productId)}`;
    return this.api.get(url);
  }

  /**
   * Admin: list seller-support + customer-support conversations.
   */
  getAdminConversations(): Observable<any[]> {
    return this.api.get<any[]>('/Chat/conversations').pipe(
      catchError(() => of([]))
    );
  }
}
