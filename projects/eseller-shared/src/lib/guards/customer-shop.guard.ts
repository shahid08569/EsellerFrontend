import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot
} from '@angular/router';

import { AuthStore } from '../state/auth.store';

/**
 * Requires a signed-in customer (User) for cart / wishlist / compare / orders / chat.
 * Guests and non-customer roles are sent to login with returnUrl.
 */
export const customerShopGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated() && authStore.role() === 'User') {
    return true;
  }

  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url }
  });
};
