import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthStore, safeDecodeHandoff } from 'eseller-shared';
import { environment } from '../../../environments/environment';

export const adminGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);

  const role = authStore.currentAccount()?.roleType;
  const expiresAt = authStore.accessTokenExpiresAt();
  const isExpired = expiresAt ? expiresAt.getTime() <= Date.now() : false;

  if (authStore.isAuthenticated() && !isExpired && (role === 'SuperAdmin' || role === 'Partner')) {
    return true;
  }

  // Fallback: restore from storage or hash if AuthStore constructor race occurs
  if (typeof window !== 'undefined') {
    try {
      // 1. Check if hash has auth handoff
      if (window.location.hash && window.location.hash.includes('#auth=')) {
        const match = window.location.hash.match(/#auth=([^&]+)/);
        if (match && match[1]) {
          const payload = safeDecodeHandoff<any>(decodeURIComponent(match[1]));
          if (payload?.accessToken && payload?.accountId) {
            const r = payload.account?.roleType || payload.roleType;
            if (r === 'SuperAdmin' || r === 'Partner') {
              const exp = payload.accessTokenExpiresAt ? new Date(payload.accessTokenExpiresAt) : new Date(Date.now() + 15 * 60 * 1000);
              const perms = payload.permissions || payload.account?.permissions || null;
              authStore.setAuth({
                accessToken: payload.accessToken,
                accessTokenExpiresAt: exp,
                account: payload.account || {
                  accountId: payload.accountId,
                  username: payload.username,
                  email: payload.email,
                  roleType: r,
                  permissions: perms
                }
              });
              window.sessionStorage?.setItem('eseller_auth_session', JSON.stringify({
                accessToken: payload.accessToken,
                accessTokenExpiresAt: exp.toISOString(),
                account: payload.account || {
                  accountId: payload.accountId,
                  username: payload.username,
                  email: payload.email,
                  roleType: r,
                  permissions: perms
                }
              }));
              return true;
            }
          }
        }
      }

      // 2. Check sessionStorage then localStorage
      const saved = window.sessionStorage?.getItem('eseller_auth_session')
        ?? window.localStorage?.getItem('eseller_auth_session');

      if (saved) {
        const data = JSON.parse(saved);
        const r = data?.account?.roleType;
        const savedExpires = data?.accessTokenExpiresAt ? new Date(data.accessTokenExpiresAt) : null;
        const savedExpired = savedExpires ? savedExpires.getTime() <= Date.now() : false;

        if (data?.accessToken && !savedExpired && (r === 'SuperAdmin' || r === 'Partner')) {
          authStore.setAuth({
            accessToken: data.accessToken,
            accessTokenExpiresAt: savedExpires || new Date(Date.now() + 15 * 60 * 1000),
            account: data.account
          });
          window.localStorage?.removeItem('eseller_auth_session');
          return true;
        }
        if (savedExpired) {
          window.sessionStorage?.removeItem('eseller_auth_session');
          window.localStorage?.removeItem('eseller_auth_session');
          authStore.clearAuth();
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
  }

  // Use main customer portal login (handoff back to admin after sign-in)
  if (typeof window !== 'undefined') {
    window.location.replace(
      `${environment.customerUrl}/auth/login?returnUrl=${encodeURIComponent(window.location.href)}`
    );
  }
  return false;
};
