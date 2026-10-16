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
  isEdited?: boolean;
  editedAt?: string | null;
  isDeletedForEveryone?: boolean;
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

export interface SignalRMessageEdited {
  messageId: string;
  orderRequestId: string;
  newContent: string;
  editedAt: string;
}

export interface SignalRMessageDeleted {
  messageId: string;
  orderRequestId: string;
  isDeletedForEveryone: boolean;
}

export interface ParsedReply {
  id: string;
  senderName: string;
  text: string;
}

export function parseMessageReply(rawMessage: string | null | undefined): { reply: ParsedReply | null; cleanText: string } {
  if (!rawMessage || typeof rawMessage !== 'string') return { reply: null, cleanText: '' };
  const trimmed = rawMessage.trim();
  const match = trimmed.match(/^\[reply:([^:]+):([^\]]+)\]([\s\S]*?)\[\/reply\]\s*([\s\S]*)$/i);
  if (match) {
    return {
      reply: {
        id: match[1].trim(),
        senderName: match[2].trim(),
        text: match[3].trim()
      },
      cleanText: (match[4] || '').trim()
    };
  }
  const altMatch = rawMessage.match(/\[reply:([^:]+):([^\]]+)\]([\s\S]*?)\[\/reply\]/i);
  if (altMatch && altMatch.index !== undefined && altMatch.index < 10) {
    const after = rawMessage.substring(altMatch.index + altMatch[0].length).trim();
    return {
      reply: {
        id: altMatch[1].trim(),
        senderName: altMatch[2].trim(),
        text: altMatch[3].trim()
      },
      cleanText: after
    };
  }
  return { reply: null, cleanText: rawMessage };
}

export function buildReplyMessage(reply: ParsedReply | null | undefined, messageText: string): string {
  if (!reply) return (messageText || '').trim();
  const cleanSender = (reply.senderName || 'Message').replace(/[:\]\n]/g, ' ').trim().slice(0, 50);
  const cleanSnippet = (reply.text || '').replace(/\s+/g, ' ').trim().slice(0, 150);
  return `[reply:${reply.id}:${cleanSender}]${cleanSnippet}[/reply]\n${(messageText || '').trim()}`;
}

export function cleanMessagePreview(rawMessage: string | null | undefined): string {
  if (!rawMessage || typeof rawMessage !== 'string') return '';
  const parsed = parseMessageReply(rawMessage);
  if (parsed.reply) {
    if (parsed.cleanText) {
      return parsed.cleanText;
    }
    return parsed.reply.senderName ? `Replied to ${parsed.reply.senderName}` : 'Reply';
  }
  return rawMessage.trim();
}
