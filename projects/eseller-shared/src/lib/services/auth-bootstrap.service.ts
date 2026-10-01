import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';
import { AuthStore } from '../state/auth.store';
import { RoleType } from '../models/auth/auth.models';

/**
 * ============================================================
 * AuthBootstrapService — Silent refresh on app start
 * ------------------------------------------------------------
 * Strategy (in order):
 *   1. Check URL hash for auth handoff (#auth=BASE64)
 *      Set by customer app (4200) when redirecting a Shopkeeper
 *      to seller app (54007). URL hash is not sent to server.
 *   2. Fall back to cookie-based silent refresh-token call
 *   3. If both fail → guest user
 * ============================================================
 */
@Injectable({ providedIn: 'root' })
export class AuthBootstrapService {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);

  async bootstrap(): Promise<void> {
    // ── Strategy 1: URL hash handoff from customer app ──
    if (typeof window !== 'undefined') {
      const hash = window.location.hash; // e.g. "#auth=eyJ..."
      if (hash.startsWith('#auth=')) {
        try {
          const encoded = hash.slice(6); // remove "#auth="
          const handoff = JSON.parse(atob(encoded)) as {
            accessToken: string;
            accessTokenExpiresAt: string;
            accountId: string;
            username: string;
            email: string;
            roleType: RoleType;
          };

          // Clean hash from URL so it doesn't stay visible
          window.history.replaceState(null, '', window.location.pathname);

          this.authStore.setAuth({
            accessToken: handoff.accessToken,
            accessTokenExpiresAt: handoff.accessTokenExpiresAt,
            account: {
              accountId: handoff.accountId,
              username: handoff.username,
              email: handoff.email,
              roleType: handoff.roleType
            }
          });
          return; // success — skip cookie refresh
        } catch {
          // Malformed handoff — clean up and fall through
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    }

    // ── Strategy 2: cookie-based silent refresh ──
    try {
      const response = await firstValueFrom(this.authService.refreshToken());

      this.authStore.setAuth({
        accessToken: response.accessToken,
        accessTokenExpiresAt: response.accessTokenExpiresAt,
        account: {
          accountId: response.accountId,
          username: response.username,
          email: response.email,
          roleType: response.roleType
        }
      });
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