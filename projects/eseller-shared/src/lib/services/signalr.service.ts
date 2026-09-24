import { Injectable, inject, signal } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel
} from '@microsoft/signalr';

import { AuthStore } from '../state/auth.store';

/**
 * ============================================================
 * SignalRService — Manages Chat + Notification hubs
 * ------------------------------------------------------------
 * - Creates and maintains hub connections.
 * - Auto-reconnect with backoff.
 * - Injects the access token via accessTokenFactory.
 * - Exposes connection state as signals.
 *
 * Hub URLs are configured at bootstrap via
 * `window.__ESELLER_CHAT_HUB_URL__` and
 * `window.__ESELLER_NOTIFICATION_HUB_URL__` so the shared
 * library doesn't need per-app environment imports.
 * ============================================================
 */
@Injectable({ providedIn: 'root' })
export class SignalRService {
  private readonly authStore = inject(AuthStore);

  private chatConnection: HubConnection | null = null;
  private notificationConnection: HubConnection | null = null;

  // ============================================================
  // STATE
  // ============================================================
  readonly chatState = signal<HubConnectionState>(
    HubConnectionState.Disconnected
  );
  readonly notificationState = signal<HubConnectionState>(
    HubConnectionState.Disconnected
  );

  // ============================================================
  // CHAT HUB
  // ============================================================
  async startChatConnection(): Promise<void> {
    if (
      this.chatConnection &&
      this.chatConnection.state === HubConnectionState.Connected
    ) {
      return;
    }

    this.chatConnection = this.buildConnection(
      this.getHubUrl('__ESELLER_CHAT_HUB_URL__')
    );

    this.chatConnection.onclose(() =>
      this.chatState.set(HubConnectionState.Disconnected)
    );
    this.chatConnection.onreconnecting(() =>
      this.chatState.set(HubConnectionState.Reconnecting)
    );
    this.chatConnection.onreconnected(() =>
      this.chatState.set(HubConnectionState.Connected)
    );

    try {
      await this.chatConnection.start();
      this.chatState.set(HubConnectionState.Connected);
    } catch (err) {
      this.chatState.set(HubConnectionState.Disconnected);
      throw err;
    }
  }

  async stopChatConnection(): Promise<void> {
    if (this.chatConnection) {
      await this.chatConnection.stop();
      this.chatConnection = null;
      this.chatState.set(HubConnectionState.Disconnected);
    }
  }

  getChatConnection(): HubConnection | null {
    return this.chatConnection;
  }

  // ============================================================
  // NOTIFICATION HUB
  // ============================================================
  async startNotificationConnection(): Promise<void> {
    if (
      this.notificationConnection &&
      this.notificationConnection.state === HubConnectionState.Connected
    ) {
      return;
    }

    this.notificationConnection = this.buildConnection(
      this.getHubUrl('__ESELLER_NOTIFICATION_HUB_URL__')
    );

    this.notificationConnection.onclose(() =>
      this.notificationState.set(HubConnectionState.Disconnected)
    );
    this.notificationConnection.onreconnecting(() =>
      this.notificationState.set(HubConnectionState.Reconnecting)
    );
    this.notificationConnection.onreconnected(() =>
      this.notificationState.set(HubConnectionState.Connected)
    );

    try {
      await this.notificationConnection.start();
      this.notificationState.set(HubConnectionState.Connected);
    } catch (err) {
      this.notificationState.set(HubConnectionState.Disconnected);
      throw err;
    }
  }

  async stopNotificationConnection(): Promise<void> {
    if (this.notificationConnection) {
      await this.notificationConnection.stop();
      this.notificationConnection = null;
      this.notificationState.set(HubConnectionState.Disconnected);
    }
  }

  getNotificationConnection(): HubConnection | null {
    return this.notificationConnection;
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private buildConnection(url: string): HubConnection {
    return new HubConnectionBuilder()
      .withUrl(url, {
        accessTokenFactory: () => this.authStore.accessToken() ?? '',
        withCredentials: true
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(LogLevel.Warning)
      .build();
  }

  private getHubUrl(key: '__ESELLER_CHAT_HUB_URL__' | '__ESELLER_NOTIFICATION_HUB_URL__'): string {
    const url = (window as any)[key] as string | undefined;
    if (!url) {
      throw new Error(
        `Eseller hub URL not configured. Ensure app bootstrap sets window.${key}.`
      );
    }
    return url;
  }
}