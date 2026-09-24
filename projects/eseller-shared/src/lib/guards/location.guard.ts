import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot
} from '@angular/router';

import { LocationService } from '../services/location.service';

/**
 * ============================================================
 * locationGuard — Functional Route Guard
 * ------------------------------------------------------------
 * Blocks navigation when the browser location is not available.
 * Backend requires latitude/longitude on register/login, so
 * any route that leads to those flows must be guarded.
 *
 * Behaviour:
 *   - If location is already granted → allow navigation.
 *   - Otherwise → try to request it.
 *     - If granted → allow.
 *     - If denied / unsupported / error → redirect to
 *       `/location-required` with the attempted URL saved in
 *       `returnUrl` so the user can be sent back after enabling.
 * ============================================================
 */
export const locationGuard: CanActivateFn = async (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const locationService = inject(LocationService);
  const router = inject(Router);

  // ----------------------------------------------------------
  // 1. Already granted? Allow immediately.
  // ----------------------------------------------------------
  if (locationService.hasLocation()) {
    return true;
  }

  // ----------------------------------------------------------
  // 2. Unsupported browser? Redirect to the required page.
  // ----------------------------------------------------------
  if (locationService.isUnsupported()) {
    return router.createUrlTree(['/location-required'], {
      queryParams: { returnUrl: state.url }
    });
  }

  // ----------------------------------------------------------
  // 3. Try requesting location once.
  // ----------------------------------------------------------
  const coords = await locationService.requestLocation();

  if (coords) {
    return true;
  }

  // ----------------------------------------------------------
  // 4. Still no location → block and redirect.
  // ----------------------------------------------------------
  return router.createUrlTree(['/location-required'], {
    queryParams: { returnUrl: state.url }
  });
};