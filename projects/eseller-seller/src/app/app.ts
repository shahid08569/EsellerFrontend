import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore, ToastService, safeDecodeHandoff } from 'eseller-shared';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly title = signal('eseller-seller');
  private readonly authStore = inject(AuthStore);
  readonly toastService = inject(ToastService);

  ngOnInit(): void {
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/#auth=([^&]+)/);
      if (match && match[1]) {
        try {
          let encoded = match[1];
          try {
            encoded = decodeURIComponent(encoded);
          } catch {
            // keep raw
          }
          const payload = safeDecodeHandoff<any>(encoded);
          if (payload && payload.accessToken && payload.accountId) {
            this.authStore.setAuth({
              accessToken: payload.accessToken,
              accessTokenExpiresAt: payload.accessTokenExpiresAt,
              account: {
                accountId: payload.accountId,
                username: payload.username,
                email: payload.email,
                roleType: payload.roleType
              }
            });
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        } catch (e) {
          console.error('Failed to parse auth handoff', e);
        }
      }
    }
  }
}
