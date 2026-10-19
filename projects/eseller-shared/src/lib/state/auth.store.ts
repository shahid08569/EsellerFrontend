import { Injectable, signal, computed } from '@angular/core';

import { CurrentAccount, RoleType } from '../models/auth/auth.models';

function getCustomerLoginUrl(reason: string = 'expired'): string {
  if (typeof window === 'undefined') return '/auth/login';
  const configured = (window as any).__ESELLER_CUSTOMER_URL__;
  let base = '';
  if (configured) {
    base = String(configured).replace(/\/$/, '');
  } else {
    const host = window.location.hostname;
    if (host.includes('esellerglobal.com')) {
      base = 'https://www.esellerglobal.com';
    } else if (host === 'localhost' || host === '127.0.0.1') {
      base = 'http://localhost:4200';
    } else {
      base = window.location.origin;
    }
  }

  const currentHref = window.location.href;
  const isAlreadyLoginPage = window.location.pathname.includes('/auth/login');

  if (isAlreadyLoginPage) {
    return `${base}/auth/login?logout=true&reason=${encodeURIComponent(reason)}`;
  }

  return `${base}/auth/login?logout=true&reason=${encodeURIComponent(reason)}&returnUrl=${encodeURIComponent(currentHref)}`;
}

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

  private logoutTimer: any = null;
  private heartbeatTimer: any = null;
  private visibilityListenerAttached = false;

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
      // 1. Check sessionStorage or localStorage
      let saved = window.sessionStorage?.getItem('eseller_auth_session')
               || window.localStorage?.getItem('eseller_auth_session');

      if (!saved) return;
      const data = JSON.parse(saved);
      if (!data?.accessToken || !data?.account) {
        window.sessionStorage?.removeItem('eseller_auth_session');
        window.localStorage?.removeItem('eseller_auth_session');
        return;
      }
      const expiresAt = data.accessTokenExpiresAt ? new Date(data.accessTokenExpiresAt) : null;
      // Never restore an expired JWT from storage
      if (expiresAt && expiresAt.getTime() <= Date.now()) {
        window.sessionStorage?.removeItem('eseller_auth_session');
        window.localStorage?.removeItem('eseller_auth_session');
        return;
      }
      this._accessToken.set(data.accessToken);
      this._currentAccount.set(data.account);
      this._accessTokenExpiresAt.set(expiresAt);

      if (expiresAt) {
        this.scheduleAutoLogout(expiresAt);
      }

      // Keep both storages synchronized
      if (window.sessionStorage && window.localStorage) {
        window.sessionStorage.setItem('eseller_auth_session', saved);
        window.localStorage.setItem('eseller_auth_session', saved);
      }
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

    this.scheduleAutoLogout(expiresAt);

    if (typeof window !== 'undefined') {
      const serialized = JSON.stringify({
        accessToken: payload.accessToken,
        accessTokenExpiresAt: expiresAt.toISOString(),
        account: payload.account
      });
      window.sessionStorage?.setItem('eseller_auth_session', serialized);
      window.localStorage?.setItem('eseller_auth_session', serialized);
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

    this.scheduleAutoLogout(expiresAt);

    if (typeof window !== 'undefined') {
      for (const storage of [window.sessionStorage, window.localStorage]) {
        if (!storage) continue;
        const saved = storage.getItem('eseller_auth_session');
        if (saved) {
          try {
            const data = JSON.parse(saved);
            data.accessToken = accessToken;
            data.accessTokenExpiresAt = expiresAt.toISOString();
            storage.setItem('eseller_auth_session', JSON.stringify(data));
          } catch {}
        }
      }
    }
  }

  /**
   * Clears all auth state. Called on logout or when refresh
   * fails irrecoverably.
   */
  clearAuth(): void {
    this.cancelAutoLogout();
    this._accessToken.set(null);
    this._currentAccount.set(null);
    this._accessTokenExpiresAt.set(null);

    if (typeof window !== 'undefined') {
      window.sessionStorage?.removeItem('eseller_auth_session');
      window.localStorage?.removeItem('eseller_auth_session');
    }
  }

  /**
   * Schedules automatic logout when accessToken expires.
   * Uses both a precise setTimeout and a 15-second heartbeat interval (plus window focus/visibility listeners)
   * to catch computer sleep, hibernation, and background tab resumption.
   */
  private scheduleAutoLogout(expiresAt: Date | null): void {
    if (typeof window === 'undefined') return;

    this.cancelAutoLogout();

    if (!expiresAt) return;

    const checkAndTrigger = () => {
      const currentExpiry = this._accessTokenExpiresAt();
      if (!currentExpiry) return;
      if (Date.now() >= currentExpiry.getTime()) {
        this.triggerAutoLogout('expired');
      }
    };

    const remainingMs = expiresAt.getTime() - Date.now();
    if (remainingMs <= 0) {
      this.triggerAutoLogout('expired');
      return;
    }

    // 1. Precise timeout for exact second expiry
    this.logoutTimer = setTimeout(() => {
      checkAndTrigger();
    }, remainingMs);

    // 2. 15-second heartbeat interval (handles laptop sleep/wake or hibernation)
    this.heartbeatTimer = setInterval(() => {
      checkAndTrigger();
    }, 15000);

    // 3. Listen to window focus & visibilitychange (instant check on tab switch or wake)
    if (!this.visibilityListenerAttached) {
      this.visibilityListenerAttached = true;
      const onWakeOrFocus = () => checkAndTrigger();
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          onWakeOrFocus();
        }
      });
      window.addEventListener('focus', onWakeOrFocus);
    }
  }

  private cancelAutoLogout(): void {
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Triggers automatic logout: purges state/storage and redirects to login with reason
   */
  triggerAutoLogout(reason = 'expired'): void {
    this.cancelAutoLogout();
    this.clearAuth();

    if (typeof window !== 'undefined') {
      const loginUrl = getCustomerLoginUrl(reason);
      if (!window.location.href.includes('logout=true') || !window.location.href.includes(`reason=${reason}`)) {
        window.location.replace(loginUrl);
      }
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