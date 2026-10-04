import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthStore } from 'eseller-shared';

export const adminGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  // 1. Check in-memory store
  const role = authStore.currentAccount()?.roleType;
  const expiresAt = authStore.accessTokenExpiresAt();
  const isExpired = expiresAt ? expiresAt.getTime() <= Date.now() : false;

  if (authStore.isAuthenticated() && !isExpired && (role === 'SuperAdmin' || role === 'Partner')) {
    return true;
  }

  // 2. Fallback: check localStorage in case authStore is restoring
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem('eseller_auth_session');
      if (saved) {
        const data = JSON.parse(saved);
        const r = data?.account?.roleType;
        const savedExpires = data?.accessTokenExpiresAt ? new Date(data.accessTokenExpiresAt) : null;
        const savedExpired = savedExpires ? savedExpires.getTime() <= Date.now() : false;

        if (data && data.accessToken && !savedExpired && (r === 'SuperAdmin' || r === 'Partner')) {
          authStore.setAuth({
            accessToken: data.accessToken,
            accessTokenExpiresAt: savedExpires || new Date(Date.now() + 86400000),
            account: data.account
          });
          return true;
        } else if (savedExpired) {
          window.localStorage.removeItem('eseller_auth_session');
          authStore.clearAuth();
        }
      }
    } catch (e) {
      console.error('Error restoring admin auth session in guard', e);
    }
  }

  // 3. Redirect to main login page if not logged in as Admin
  if (typeof window !== 'undefined') {
    window.location.href = 'http://localhost:4200/auth/login?returnUrl=' + encodeURIComponent(window.location.href);
    return new Promise(() => {});
  }
  return false;
};
