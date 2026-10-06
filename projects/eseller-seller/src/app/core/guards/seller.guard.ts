import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthStore } from 'eseller-shared';
import { environment } from '../../../environments/environment';

export const sellerGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);

  if (authStore.isAuthenticated() && authStore.currentAccount()?.roleType === 'Shopkeeper') {
    return true;
  }

  // Fallback: check localStorage in case authStore is restoring
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem('eseller_auth_session');
      if (saved) {
        const data = JSON.parse(saved);
        if (data && data.accessToken && data.account?.roleType === 'Shopkeeper') {
          authStore.setAuth({
            accessToken: data.accessToken,
            accessTokenExpiresAt: data.accessTokenExpiresAt || new Date(Date.now() + 86400000),
            account: data.account
          });
          return true;
        }
      }
    } catch (e) {
      console.error('Error restoring seller auth session in guard', e);
    }
  }

  // Redirect to customer portal login if not logged in or wrong role.
  // Never return a hanging Promise — that freezes the seller app on a blank screen.
  if (typeof window !== 'undefined') {
    window.location.replace(
      `${environment.customerUrl}/auth/login?returnUrl=` +
        encodeURIComponent(window.location.href)
    );
  }
  return false;
};
