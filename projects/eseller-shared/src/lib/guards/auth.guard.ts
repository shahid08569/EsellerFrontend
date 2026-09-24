import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot
} from '@angular/router';

import { AuthStore } from '../state/auth.store';

/**
 * ============================================================
 * authGuard — Requires the user to be authenticated.
 * ------------------------------------------------------------
 * - If AuthStore says authenticated → allow.
 * - Else → redirect to /auth/login with returnUrl saved.
 *
 * Silent refresh on bootstrap should run before this guard,
 * so a valid cookie produces an authenticated session even
 * after a full page reload.
 * ============================================================
 */
export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url }
  });
};