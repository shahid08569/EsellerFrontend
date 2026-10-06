import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from 'eseller-shared';

export const adminGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

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

  // Stay on admin origin — local login (no www bounce)
  return router.createUrlTree(['/login']);
};
