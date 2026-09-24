import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
  ActivatedRouteSnapshot
} from '@angular/router';

import { AuthStore } from '../state/auth.store';
import { RoleType } from '../models/auth/auth.models';

/**
 * ============================================================
 * roleGuard — Requires the user to have one of the given roles.
 * ------------------------------------------------------------
 * Usage:
 *   { path: 'admin', canActivate: [roleGuard(['SuperAdmin', 'Partner'])] }
 *
 * - Assumes authentication is already verified (compose with authGuard).
 * - If role mismatch → redirect to home.
 * ============================================================
 */
export function roleGuard(allowedRoles: RoleType[]): CanActivateFn {
  return (_route: ActivatedRouteSnapshot) => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    if (authStore.hasRole(...allowedRoles)) {
      return true;
    }

    return router.createUrlTree(['/']);
  };
}