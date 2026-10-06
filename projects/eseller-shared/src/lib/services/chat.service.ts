import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { ApiService } from './api.service';
import {
  ChatAttachmentUploadResult,
  ChatMessageDto,
  PagedChatMessages,
  SendChatMessageRequest,
  SendChatMessageResponse
} from '../models/chat/chat.models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(ApiService);

  getMessages(
    orderId: string,
    pageNumber: number = 1,
    pageSize: number = 30
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

  sendMessage(
    orderId: string,
    message: string,
    attachment?: Partial<SendChatMessageRequest> | null
  ): Observable<SendChatMessageResponse> {
    const body: SendChatMessageRequest = {
      message: message || undefined,
      attachmentUrl: attachment?.attachmentUrl,
      attachmentFileName: attachment?.attachmentFileName,
      attachmentContentType: attachment?.attachmentContentType,
      attachmentSizeBytes: attachment?.attachmentSizeBytes
    };
    return this.api.post<SendChatMessageResponse>(`/Chat/${orderId}/messages`, body);
  }

  uploadAttachment(file: File): Observable<ChatAttachmentUploadResult> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.api.postForm<ChatAttachmentUploadResult>('/Chat/attachments', form);
  }

  markAsRead(messageId: string): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/Chat/messages/${messageId}/read`, {});
  }

  markConversationAsRead(orderRequestId: string): Observable<{ message: string; markedCount?: number }> {
    return this.api.put<{ message: string; markedCount?: number }>(`/Chat/${orderRequestId}/read`, {});
  }

  getUnreadCount(): Observable<{ unreadCount: number }> {
    return this.api.get<{ unreadCount: number }>('/Chat/unread-count');
  }

  getSupportSession(): Observable<{ orderRequestId: string; conversationId?: string; orderRef: string }> {
    return this.api.get('/Chat/support-session');
  }

  getShopSupportSession(productId?: string | null): Observable<{
    orderRequestId: string;
    conversationId?: string;
    orderRef: string;
    shopId: string;
    shopName: string;
    product?: { id: string; name: string; price: number; imageUrl?: string | null } | null;
  }> {
    let url = '/Chat/shop-support-session';
    if (productId) url += `?productId=${encodeURIComponent(productId)}`;
    return this.api.get(url);
  }

  getAdminConversations(): Observable<any[]> {
    return this.api.get<any[]>('/Chat/conversations').pipe(
      catchError(() => of([]))
    );
  }
}
