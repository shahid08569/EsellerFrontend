import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthStore } from 'eseller-shared';

export const sellerGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated() && authStore.currentAccount()?.roleType === 'Shopkeeper') {
    return true;
  }

  // Redirect to customer portal's login page (running on port 4200) if not logged in or wrong role.
  // Alternatively, just send them to a local access-denied page, but for now we redirect to port 4200.
  if (typeof window !== 'undefined') {
    window.location.href = 'http://localhost:4200/auth/login';
    return new Promise(() => {});
  }
  return false;
};
