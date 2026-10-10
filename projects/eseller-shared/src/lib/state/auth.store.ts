import { Injectable, signal, computed } from '@angular/core';

import { CurrentAccount, RoleType } from '../models/auth/auth.models';

/**
 * ============================================================
 * AuthStore — In-memory authentication state
 * ------------------------------------------------------------
 * Holds:
 *   - accessToken       (JWT — in memory; mirrored to localStorage for
 *                        reload/cross-port bootstrap, cleared when expired)
 *   - currentAccount    (id, username, email, roleType)
 *
 * The refreshToken is NEVER stored here — it lives in the
 * backend's HttpOnly cookie and is managed by the browser.
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
    if (typeof window === 'undefined') return;

    // If an explicit logout signal is present in URL, immediately purge storage and do not restore
    try {
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      if (search.includes('logout=true') || hash.includes('logout=true')) {
        window.sessionStorage?.removeItem('eseller_auth_session');
        window.localStorage?.removeItem('eseller_auth_session');
        return;
      }
    } catch {}

    try {
      // 1. Check secure sessionStorage first
      let saved = window.sessionStorage?.getItem('eseller_auth_session');

      // 2. Backward compatibility: if in localStorage, migrate and immediately purge from localStorage
      if (!saved && window.localStorage) {
        const legacy = window.localStorage.getItem('eseller_auth_session');
        if (legacy) {
          saved = legacy;
          window.sessionStorage?.setItem('eseller_auth_session', legacy);
          window.localStorage.removeItem('eseller_auth_session');
        }
      } else if (window.localStorage) {
        // Guarantee localStorage has zero residual tokens
        window.localStorage.removeItem('eseller_auth_session');
      }

      if (!saved) return;
      const data = JSON.parse(saved);
      if (!data?.accessToken || !data?.account) {
        window.sessionStorage?.removeItem('eseller_auth_session');
        window.localStorage?.removeItem('eseller_auth_session');
        return;
      }
      const expiresAt = data.accessTokenExpiresAt ? new Date(data.accessTokenExpiresAt) : null;
      // Never restore an expired JWT from storage (XSS surface + stale auth)
      if (expiresAt && expiresAt.getTime() <= Date.now()) {
        window.sessionStorage?.removeItem('eseller_auth_session');
        window.localStorage?.removeItem('eseller_auth_session');
        return;
      }
      this._accessToken.set(data.accessToken);
      this._currentAccount.set(data.account);
      this._accessTokenExpiresAt.set(expiresAt);
    } catch {
      window.sessionStorage?.removeItem('eseller_auth_session');
      window.localStorage?.removeItem('eseller_auth_session');
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

    if (typeof window !== 'undefined') {
      // Save strictly to tab-scoped sessionStorage, never permanent localStorage
      if (window.sessionStorage) {
        window.sessionStorage.setItem(
          'eseller_auth_session',
          JSON.stringify({
            accessToken: payload.accessToken,
            accessTokenExpiresAt: expiresAt.toISOString(),
            account: payload.account
          })
        );
      }
      // Guarantee localStorage is purged
      if (window.localStorage) {
        window.localStorage.removeItem('eseller_auth_session');
      }
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

    if (typeof window !== 'undefined') {
      if (window.sessionStorage) {
        const saved = window.sessionStorage.getItem('eseller_auth_session');
        if (saved) {
          try {
            const data = JSON.parse(saved);
            data.accessToken = accessToken;
            data.accessTokenExpiresAt = expiresAt.toISOString();
            window.sessionStorage.setItem('eseller_auth_session', JSON.stringify(data));
          } catch {}
        }
      }
      if (window.localStorage) {
        window.localStorage.removeItem('eseller_auth_session');
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

    if (typeof window !== 'undefined') {
      window.sessionStorage?.removeItem('eseller_auth_session');
      window.localStorage?.removeItem('eseller_auth_session');
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