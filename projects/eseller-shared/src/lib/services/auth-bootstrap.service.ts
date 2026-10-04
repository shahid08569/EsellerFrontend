import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';
import { AuthStore } from '../state/auth.store';
import { RoleType } from '../models/auth/auth.models';

export function safeEncodeHandoff(data: any): string {
  try {
    const jsonStr = JSON.stringify(data);
    const bytes = new TextEncoder().encode(jsonStr);
    let binString = '';
    for (let i = 0; i < bytes.length; i++) {
      binString += String.fromCharCode(bytes[i]);
    }
    return btoa(binString);
  } catch {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  }
}

export function safeDecodeHandoff<T = any>(str: string): T | null {
  if (!str) return null;
  try {
    const binString = atob(str);
    const bytes = Uint8Array.from(binString, (m) => m.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    return JSON.parse(decoded) as T;
  } catch {
    try {
      return JSON.parse(decodeURIComponent(escape(atob(str)))) as T;
    } catch {
      try {
        return JSON.parse(atob(str)) as T;
      } catch {
        return null;
      }
    }
  }
}

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
    // ── Strategy 0: Explicit Cross-App Logout Signal ──
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      const hash = window.location.hash;
      if (search.includes('logout=true') || hash.includes('logout=true')) {
        this.authStore.clearAuth();
        try {
          // Clean logout param from URL without reloading
          const cleanUrl = window.location.pathname;
          window.history.replaceState(null, '', cleanUrl);
        } catch {}
        return; // User explicitly logged out from another portal
      }
    }

    // ── Strategy 1: URL hash handoff from customer app ──
    if (typeof window !== 'undefined') {
      const hash = window.location.hash; // e.g. "#auth=eyJ..."
      if (hash.startsWith('#auth=')) {
        try {
          // Support both raw and URI-encoded base64 handoffs
          let encoded = hash.slice(6); // remove "#auth="
          try {
            encoded = decodeURIComponent(encoded);
          } catch {
            // keep raw slice
          }
          const handoff = safeDecodeHandoff<{
            accessToken: string;
            accessTokenExpiresAt: string;
            accountId: string;
            username: string;
            email: string;
            roleType: RoleType;
          }>(encoded);

          // Clean hash from URL so it doesn't stay visible
          window.history.replaceState(null, '', window.location.pathname + window.location.search);

          if (handoff && handoff.accessToken && handoff.accountId) {
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
          }
        } catch {
          // Malformed handoff — clean up and fall through
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    }

    // ── Strategy 2: cookie-based silent refresh (hard timeout so app never stays blank) ──
    try {
      const response = await Promise.race([
        firstValueFrom(this.authService.refreshToken()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AUTH_REFRESH_TIMEOUT')), 8000)
        )
      ]);

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
      // If cookie refresh fails (e.g. cross-port dev server where browser blocks Lax cookies),
      // keep current localStorage session active so refresh doesn't log the user out.
      if (!this.authStore.currentAccount()) {
        this.authStore.clearAuth();
      }
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