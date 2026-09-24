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
    this._accessTokenExpiresAt.set(
      payload.accessTokenExpiresAt instanceof Date
        ? payload.accessTokenExpiresAt
        : new Date(payload.accessTokenExpiresAt)
    );
  }

  /**
   * Updates only the access token (used by silent refresh,
   * where the account info is unchanged).
   */
  updateAccessToken(accessToken: string, accessTokenExpiresAt: string | Date): void {
    this._accessToken.set(accessToken);
    this._accessTokenExpiresAt.set(
      accessTokenExpiresAt instanceof Date
        ? accessTokenExpiresAt
        : new Date(accessTokenExpiresAt)
    );
  }

  /**
   * Clears all auth state. Called on logout or when refresh
   * fails irrecoverably.
   */
  clearAuth(): void {
    this._accessToken.set(null);
    this._currentAccount.set(null);
    this._accessTokenExpiresAt.set(null);
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