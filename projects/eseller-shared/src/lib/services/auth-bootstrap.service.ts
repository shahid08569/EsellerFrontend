import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';
import { AuthStore } from '../state/auth.store';

/**
 * ============================================================
 * AuthBootstrapService — Silent refresh on app start
 * ------------------------------------------------------------
 * Called once at application bootstrap (via provideAppInitializer).
 * Attempts a silent refresh using the HttpOnly refresh cookie.
 *
 * Outcomes:
 *   - Success → AuthStore populated; user stays logged in.
 *   - Failure → AuthStore cleared; user is treated as guest.
 *
 * Never throws: bootstrap must always complete so the app
 * renders, even for anonymous visitors.
 * ============================================================
 */
@Injectable({ providedIn: 'root' })
export class AuthBootstrapService {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);

  async bootstrap(): Promise<void> {
    try {
      const response = await firstValueFrom(this.authService.refreshToken());

      // The refresh response doesn't include account info.
      // We keep whatever the app already knows; on a fresh
      // page load, currentAccount will be null until the app
      // fetches /dashboard/profile or similar.
      this.authStore.updateAccessToken(
        response.accessToken,
        response.accessTokenExpiresAt
      );
    } catch {
      // No cookie / expired / invalid — user is a guest.
      this.authStore.clearAuth();
    }
  }
}

/**
 * Factory used in app.config.ts:
 *   provideAppInitializer(() => inject(AuthBootstrapService).bootstrap())
 */
export function authBootstrapFactory(): () => Promise<void> {
  return () => inject(AuthBootstrapService).bootstrap();
}