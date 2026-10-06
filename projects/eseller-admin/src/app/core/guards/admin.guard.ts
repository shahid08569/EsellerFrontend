import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthStore } from 'eseller-shared';
import { environment } from '../../../environments/environment';

export const adminGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);

  const role = authStore.currentAccount()?.roleType;
  const expiresAt = authStore.accessTokenExpiresAt();
  const isExpired = expiresAt ? expiresAt.getTime() <= Date.now() : false;

  if (authStore.isAuthenticated() && !isExpired && (role === 'SuperAdmin' || role === 'Partner')) {
    return true;
  }

  // Fallback: restore from storage if AuthStore constructor race occurs
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem('eseller_auth_session');
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
          return true;
        }
        if (savedExpired) {
          window.localStorage.removeItem('eseller_auth_session');
          authStore.clearAuth();
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
  }

  if (typeof window !== 'undefined') {
    window.location.replace(
      `${environment.customerPortalUrl}/auth/login?returnUrl=${encodeURIComponent(window.location.href)}`
    );
  }
  return false;
};
