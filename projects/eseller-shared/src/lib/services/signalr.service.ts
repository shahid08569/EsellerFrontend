import { Injectable, inject, signal } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel
} from '@microsoft/signalr';

import { AuthStore } from '../state/auth.store';
import { SignalRIncomingMessage } from '../models/chat/chat.models';

export interface SignalRIncomingNotification {
  notificationId: string;
  type: number;
  title: string;
  message: string;
  createdAt: string;
}

/**
 * SignalRService — Chat + Notification hubs with a single ReceiveMessage dispatcher
 * so multiple subscribers do not stack duplicate hub handlers.
 */
@Injectable({ providedIn: 'root' })
export class SignalRService {
  private readonly authStore = inject(AuthStore);

  private chatConnection: HubConnection | null = null;
  private notificationConnection: HubConnection | null = null;
  private chatStartPromise: Promise<void> | null = null;
  private notificationStartPromise: Promise<void> | null = null;

  private receiveMessageHandlers = new Set<(msg: SignalRIncomingMessage) => void>();
  private receiveMessageHubBound = false;

  private receiveNotificationHandlers = new Set<(payload: SignalRIncomingNotification) => void>();
  private receiveNotificationHubBound = false;
  private unreadCountHandlers = new Set<(count: number) => void>();
  private unreadCountHubBound = false;

  readonly chatState = signal<HubConnectionState>(HubConnectionState.Disconnected);
  readonly notificationState = signal<HubConnectionState>(HubConnectionState.Disconnected);

  async startChatConnection(): Promise<void> {
    if (
      this.chatConnection &&
      this.chatConnection.state === HubConnectionState.Connected
    ) {
      this.ensureReceiveMessageHubHandler();
      return;
    }

    if (this.chatStartPromise) {
      return this.chatStartPromise;
    }

    this.chatStartPromise = this.connectChat();
    try {
      await this.chatStartPromise;
    } finally {
      this.chatStartPromise = null;
    }
  }

  private async connectChat(): Promise<void> {
    // If a previous connection exists but is not Connected, rebuild cleanly
    if (this.chatConnection) {
      try { await this.chatConnection.stop(); } catch { /* ignore */ }
      this.chatConnection = null;
      this.receiveMessageHubBound = false;
    }

    const token = this.authStore.accessToken();
    if (!token) {
      this.chatState.set(HubConnectionState.Disconnected);
      return;
    }

    this.chatConnection = this.buildConnection(
      this.getHubUrl('__ESELLER_CHAT_HUB_URL__')
    );

    this.chatConnection.onclose(() => {
      this.chatState.set(HubConnectionState.Disconnected);
      this.receiveMessageHubBound = false;
    });
    this.chatConnection.onreconnecting(() =>
      this.chatState.set(HubConnectionState.Reconnecting)
    );
    this.chatConnection.onreconnected(() => {
      this.chatState.set(HubConnectionState.Connected);
      this.receiveMessageHubBound = false;
      this.ensureReceiveMessageHubHandler();
    });

    this.ensureReceiveMessageHubHandler();

    try {
      await this.chatConnection.start();
      this.chatState.set(HubConnectionState.Connected);
      this.ensureReceiveMessageHubHandler();
    } catch (err) {
      this.chatState.set(HubConnectionState.Disconnected);
      try { await this.chatConnection?.stop(); } catch { /* ignore */ }
      this.chatConnection = null;
      this.receiveMessageHubBound = false;
      throw err;
    }
  }

  async stopChatConnection(): Promise<void> {
    if (this.chatConnection) {
      await this.chatConnection.stop();
      this.chatConnection = null;
      this.receiveMessageHubBound = false;
      this.chatState.set(HubConnectionState.Disconnected);
    }
  }

  getChatConnection(): HubConnection | null {
    return this.chatConnection;
  }

  async joinOrderRoom(orderRequestId: string): Promise<void> {
    await this.joinConversation(orderRequestId);
  }

  async leaveOrderRoom(orderRequestId: string): Promise<void> {
    await this.leaveConversation(orderRequestId);
  }

  async joinConversation(conversationId: string): Promise<void> {
    if (this.chatConnection && this.chatConnection.state === HubConnectionState.Connected) {
      try {
        await this.chatConnection.invoke('JoinConversation', conversationId);
      } catch {
        await this.chatConnection.invoke('JoinOrderRoom', conversationId);
      }
    }
  }

  async leaveConversation(conversationId: string): Promise<void> {
    if (this.chatConnection && this.chatConnection.state === HubConnectionState.Connected) {
      try {
        await this.chatConnection.invoke('LeaveConversation', conversationId);
      } catch {
        await this.chatConnection.invoke('LeaveOrderRoom', conversationId);
      }
    }
  }

  onReceiveMessage(callback: (msg: SignalRIncomingMessage) => void): () => void {
    this.receiveMessageHandlers.add(callback);
    this.ensureReceiveMessageHubHandler();
    return () => {
      this.receiveMessageHandlers.delete(callback);
    };
  }

  onMessageRead(callback: (messageId: string, readAt: string) => void): () => void {
    if (!this.chatConnection) return () => {};

    const handler = (messageId: string, readAt: string) => {
      callback(messageId, readAt);
    };

    this.chatConnection.on('MessageRead', handler);
    return () => this.chatConnection?.off('MessageRead', handler);
  }

  async startNotificationConnection(): Promise<void> {
    if (
      this.notificationConnection &&
      this.notificationConnection.state === HubConnectionState.Connected
    ) {
      this.ensureReceiveNotificationHubHandler();
      return;
    }

    if (this.notificationStartPromise) {
      return this.notificationStartPromise;
    }

    this.notificationStartPromise = this.connectNotifications();
    try {
      await this.notificationStartPromise;
    } finally {
      this.notificationStartPromise = null;
    }
  }

  private async connectNotifications(): Promise<void> {
    if (this.notificationConnection) {
      try { await this.notificationConnection.stop(); } catch { /* ignore */ }
      this.notificationConnection = null;
      this.receiveNotificationHubBound = false;
      this.unreadCountHubBound = false;
    }

    const token = this.authStore.accessToken();
    if (!token) {
      this.notificationState.set(HubConnectionState.Disconnected);
      return;
    }

    this.notificationConnection = this.buildConnection(
      this.getHubUrl('__ESELLER_NOTIFICATION_HUB_URL__')
    );

    this.notificationConnection.onclose(() => {
      this.notificationState.set(HubConnectionState.Disconnected);
      this.receiveNotificationHubBound = false;
      this.unreadCountHubBound = false;
    });
    this.notificationConnection.onreconnecting(() =>
      this.notificationState.set(HubConnectionState.Reconnecting)
    );
    this.notificationConnection.onreconnected(() => {
      this.notificationState.set(HubConnectionState.Connected);
      this.receiveNotificationHubBound = false;
      this.unreadCountHubBound = false;
      this.ensureReceiveNotificationHubHandler();
    });

    try {
      await this.notificationConnection.start();
      this.notificationState.set(HubConnectionState.Connected);
      this.ensureReceiveNotificationHubHandler();
    } catch (err) {
      this.notificationState.set(HubConnectionState.Disconnected);
      try { await this.notificationConnection?.stop(); } catch { /* ignore */ }
      this.notificationConnection = null;
      this.receiveNotificationHubBound = false;
      this.unreadCountHubBound = false;
      throw err;
    }
  }

  /** Subscribe to realtime notification hub events (DB + SignalR push). */
  onReceiveNotification(callback: (payload: SignalRIncomingNotification) => void): () => void {
    this.receiveNotificationHandlers.add(callback);
    this.ensureReceiveNotificationHubHandler();
    return () => {
      this.receiveNotificationHandlers.delete(callback);
    };
  }

  onUnreadCountChanged(callback: (count: number) => void): () => void {
    this.unreadCountHandlers.add(callback);
    this.ensureUnreadCountHubHandler();
    return () => {
      this.unreadCountHandlers.delete(callback);
    };
  }

  private ensureReceiveNotificationHubHandler(): void {
    if (!this.notificationConnection || this.receiveNotificationHubBound) return;

    this.notificationConnection.on(
      'ReceiveNotification',
      (notificationId: string, type: number, title: string, message: string, createdAt: string) => {
        const payload: SignalRIncomingNotification = {
          notificationId,
          type,
          title,
          message,
          createdAt
        };
        for (const handler of this.receiveNotificationHandlers) {
          try {
            handler(payload);
          } catch {
            /* isolate subscriber errors */
          }
        }
      }
    );
    this.receiveNotificationHubBound = true;
    this.ensureUnreadCountHubHandler();
  }

  private ensureUnreadCountHubHandler(): void {
    if (!this.notificationConnection || this.unreadCountHubBound) return;

    this.notificationConnection.on('UnreadCountChanged', (unreadCount: number) => {
      for (const handler of this.unreadCountHandlers) {
        try {
          handler(Number(unreadCount) || 0);
        } catch {
          /* isolate subscriber errors */
        }
      }
    });
    this.unreadCountHubBound = true;
  }

  async stopNotificationConnection(): Promise<void> {
    if (this.notificationConnection) {
      await this.notificationConnection.stop();
      this.notificationConnection = null;
      this.receiveNotificationHubBound = false;
      this.unreadCountHubBound = false;
      this.notificationState.set(HubConnectionState.Disconnected);
    }
  }

  getNotificationConnection(): HubConnection | null {
    return this.notificationConnection;
  }

  private ensureReceiveMessageHubHandler(): void {
    if (!this.chatConnection || this.receiveMessageHubBound) return;

    this.chatConnection.on(
      'ReceiveMessage',
      (
        messageId: string,
        orderRequestId: string,
        senderAccountId: string,
        senderRole: string,
        message: string,
        sentAt: string,
        attachmentUrl?: string | null,
        attachmentFileName?: string | null,
        attachmentContentType?: string | null
      ) => {
        const payload: SignalRIncomingMessage = {
          messageId,
          orderRequestId,
          senderAccountId,
          senderRole,
          message,
          sentAt,
          attachmentUrl,
          attachmentFileName,
          attachmentContentType
        };
        for (const handler of this.receiveMessageHandlers) {
          try {
            handler(payload);
          } catch {
            /* isolate subscriber errors */
          }
        }
      }
    );
    this.receiveMessageHubBound = true;
  }

  private buildConnection(url: string): HubConnection {
    return new HubConnectionBuilder()
      .withUrl(url, {
        accessTokenFactory: () => this.authStore.accessToken() ?? '',
        withCredentials: true
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(LogLevel.Error)
      .build();
  }

  private getHubUrl(key: '__ESELLER_CHAT_HUB_URL__' | '__ESELLER_NOTIFICATION_HUB_URL__'): string {
    const configured = (window as any)[key] as string | undefined;
    if (configured) return configured;

    // Derive from API URL so missing bootstrap never crashes the whole admin page
    const api = ((window as any).__ESELLER_API_URL__ as string | undefined) || '';
    const host = api.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
    if (host) {
      return key === '__ESELLER_CHAT_HUB_URL__'
        ? `${host}/hubs/chat`
        : `${host}/hubs/notifications`;
    }
    return key === '__ESELLER_CHAT_HUB_URL__'
      ? 'https://api.esellerglobal.com/hubs/chat'
      : 'https://api.esellerglobal.com/hubs/notifications';
  }
}
