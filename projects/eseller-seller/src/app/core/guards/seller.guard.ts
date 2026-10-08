import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthStore } from 'eseller-shared';
import { environment } from '../../../environments/environment';

export const sellerGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);

  const expiresAt = authStore.accessTokenExpiresAt();
  const isExpired = expiresAt ? expiresAt.getTime() <= Date.now() : false;

  if (
    authStore.isAuthenticated() &&
    !isExpired &&
    authStore.currentAccount()?.roleType === 'Shopkeeper'
  ) {
    return true;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem('eseller_auth_session');
      if (saved) {
        const data = JSON.parse(saved);
        const savedExpires = data?.accessTokenExpiresAt ? new Date(data.accessTokenExpiresAt) : null;
        const savedExpired = savedExpires ? savedExpires.getTime() <= Date.now() : false;

        if (
          data?.accessToken &&
          !savedExpired &&
          data.account?.roleType === 'Shopkeeper'
        ) {
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
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get('ref') || urlParams.get('referral');
      const isRegisterPath = window.location.pathname.toLowerCase().includes('register');

      if (ref || isRegisterPath) {
        const query = ref ? `?ref=${encodeURIComponent(ref)}` : window.location.search;
        window.location.replace(`${environment.customerUrl}/auth/seller-register${query}`);
        return false;
      }
    } catch {
      /* ignore URL parse error */
    }

    window.location.replace(
      `${environment.customerUrl}/auth/login?returnUrl=${encodeURIComponent(window.location.href)}`
    );
  }
  return false;
};
