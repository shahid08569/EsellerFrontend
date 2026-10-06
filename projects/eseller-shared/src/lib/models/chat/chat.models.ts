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
  attachmentUrl?: string | null;
  attachmentFileName?: string | null;
  attachmentContentType?: string | null;
  attachmentSizeBytes?: number | null;
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
  message?: string | null;
  attachmentUrl?: string | null;
  attachmentFileName?: string | null;
  attachmentContentType?: string | null;
  attachmentSizeBytes?: number | null;
}

export interface SendChatMessageResponse {
  messageId: string;
  message: string;
}

export interface ChatAttachmentUploadResult {
  url: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface SignalRIncomingMessage {
  messageId: string;
  orderRequestId: string;
  senderAccountId: string;
  senderRole: string;
  message: string;
  sentAt: string;
  attachmentUrl?: string | null;
  attachmentFileName?: string | null;
  attachmentContentType?: string | null;
}
