export interface ChatMessageDto {
  id: string;
  orderRequestId: string;
  senderAccountId: string;
  senderRole: string;
  message: string;
  isRead: boolean;
  readAt?: string | null;
  deliveredAt?: string | null;
  sentAt: string;
}

export interface PagedChatMessages {
  items: ChatMessageDto[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface SendChatMessageRequest {
  message: string;
}

export interface SendChatMessageResponse {
  messageId: string;
  message: string;
}

export interface SignalRIncomingMessage {
  messageId: string;
  orderRequestId: string;
  senderAccountId: string;
  senderRole: string;
  message: string;
  sentAt: string;
}
