import { Injectable, signal, computed } from '@angular/core';

import { CurrentAccount, RoleType } from '../models/auth/auth.models';

/**
 * ============================================================
 * AuthStore — In-memory authentication state
 * ------------------------------------------------------------
 * Holds:
 *   - accessToken       (JWT — memory only, never persisted)
 *   - currentAccount    (id, username, email, roleType)
 *
 * The refreshToken is NEVER stored here — it lives in the
 * backend's HttpOnly cookie and is managed by the browser.
 *
 * State is intentionally NOT persisted to localStorage or
 * sessionStorage. On a full page reload the access token is
 * gone; the app must perform a silent refresh (via the
 * refresh-token endpoint) to restore the session.
 * ============================================================
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  // ============================================================
  // STATE (signals)
  // ============================================================
  private readonly _accessToken = signal<string | null>(null);
  private readonly _currentAccount = signal<CurrentAccount | null>(null);
  private readonly _accessTokenExpiresAt = signal<Date | null>(null);

  // ============================================================
  // PUBLIC READ-ONLY SIGNALS
  // ============================================================
  readonly accessToken = this._accessToken.asReadonly();
  readonly currentAccount = this._currentAccount.asReadonly();
  readonly accessTokenExpiresAt = this._accessTokenExpiresAt.asReadonly();

  readonly isAuthenticated = computed(
    () => this._accessToken() !== null && this._currentAccount() !== null
  );

  readonly role = computed<RoleType | null>(
    () => this._currentAccount()?.roleType ?? null
  );

  // ============================================================
  // CONSTRUCTOR
  // ============================================================
  constructor() {
    this.restoreFromStorage();
  }

  private restoreFromStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem('eseller_auth_session');
        if (saved) {
          const data = JSON.parse(saved);
          if (data && data.accessToken && data.account) {
            this._accessToken.set(data.accessToken);
            this._currentAccount.set(data.account);
            this._accessTokenExpiresAt.set(
              data.accessTokenExpiresAt ? new Date(data.accessTokenExpiresAt) : null
            );
          }
        }
      } catch (e) {
        console.error('Failed to restore auth session from storage', e);
      }
    }
  }

  // ============================================================
  // MUTATIONS
  // ============================================================
  /**
   * Sets the authentication state after a successful
   * login or silent refresh.
   */
  setAuth(payload: {
    accessToken: string;
    accessTokenExpiresAt: string | Date;
    account: CurrentAccount;
  }): void {
    this._accessToken.set(payload.accessToken);
    this._currentAccount.set(payload.account);
    const expiresAt =
      payload.accessTokenExpiresAt instanceof Date
        ? payload.accessTokenExpiresAt
        : new Date(payload.accessTokenExpiresAt);
    this._accessTokenExpiresAt.set(expiresAt);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        'eseller_auth_session',
        JSON.stringify({
          accessToken: payload.accessToken,
          accessTokenExpiresAt: expiresAt.toISOString(),
          account: payload.account
        })
      );
    }
  }

  /**
   * Updates only the access token (used by silent refresh,
   * where the account info is unchanged).
   */
  updateAccessToken(accessToken: string, accessTokenExpiresAt: string | Date): void {
    this._accessToken.set(accessToken);
    const expiresAt =
      accessTokenExpiresAt instanceof Date
        ? accessTokenExpiresAt
        : new Date(accessTokenExpiresAt);
    this._accessTokenExpiresAt.set(expiresAt);

    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('eseller_auth_session');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          data.accessToken = accessToken;
          data.accessTokenExpiresAt = expiresAt.toISOString();
          window.localStorage.setItem('eseller_auth_session', JSON.stringify(data));
        } catch {}
      }
    }
  }

  /**
   * Clears all auth state. Called on logout or when refresh
   * fails irrecoverably.
   */
  clearAuth(): void {
    this._accessToken.set(null);
    this._currentAccount.set(null);
    this._accessTokenExpiresAt.set(null);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('eseller_auth_session');
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================
  /**
   * Returns true when the current account has the given role.
   * Useful for UI-level checks; server-side authorisation is
   * still the source of truth.
   */
  hasRole(...roles: RoleType[]): boolean {
    const currentRole = this.role();
    return currentRole !== null && roles.includes(currentRole);
  }

  /**
   * Returns true when the access token is expired or about to
   * expire within the given buffer (default: 30 seconds).
   */
  isAccessTokenExpiringSoon(bufferSeconds = 30): boolean {
    const expiresAt = this._accessTokenExpiresAt();
    if (!expiresAt) return true;
    const now = Date.now();
    return expiresAt.getTime() - now <= bufferSeconds * 1000;
  }
}