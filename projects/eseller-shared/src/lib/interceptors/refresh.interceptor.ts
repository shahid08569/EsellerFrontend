import {
  HttpErrorResponse,
  HttpInterceptorFn
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, BehaviorSubject, filter, take } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { AuthStore } from '../state/auth.store';

/**
 * ============================================================
 * refreshInterceptor — Silent token refresh on 401
 * ------------------------------------------------------------
 * When a request fails with 401:
 *   1. Attempt ONE silent refresh via /Auth/refresh-token
 *      (uses the HttpOnly cookie, no body needed).
 *   2. On success: update AuthStore, replay the original request.
 *   3. On failure: clear AuthStore, propagate the error.
 *
 * Concurrent 401s share a single refresh via a BehaviorSubject
 * gate, so we never fire multiple refresh calls in parallel.
 *
 * Never attempts refresh for the refresh endpoint itself or
 * for public auth endpoints (login/register) — those are
 * expected to fail with 401 for bad credentials.
 * ============================================================
 */
const SKIP_REFRESH_PATHS = [
  '/Auth/login',
  '/Auth/register',
  '/Affiliate/register',
  '/Auth/refresh-token'
];

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const authStore = inject(AuthStore);

  const shouldSkip = SKIP_REFRESH_PATHS.some((path) => req.url.includes(path));

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        shouldSkip
      ) {
        return throwError(() => error);
      }

      // --------------------------------------------------------
      // If a refresh is already in-flight, queue this request.
      // --------------------------------------------------------
      if (isRefreshing) {
        return refreshTokenSubject.pipe(
          filter((token): token is string => token !== null),
          take(1),
          switchMap((token) =>
            next(
              req.clone({
                setHeaders: { Authorization: `Bearer ${token}` }
              })
            )
          )
        );
      }

      // --------------------------------------------------------
      // Start a refresh.
      // --------------------------------------------------------
      isRefreshing = true;
      refreshTokenSubject.next(null);

      return authService.refreshToken().pipe(
        switchMap((response) => {
          isRefreshing = false;

          authStore.updateAccessToken(
            response.accessToken,
            response.accessTokenExpiresAt
          );

          refreshTokenSubject.next(response.accessToken);

          // Replay the original request with the new token.
          return next(
            req.clone({
              setHeaders: { Authorization: `Bearer ${response.accessToken}` }
            })
          );
        }),
        catchError((refreshError) => {
          isRefreshing = false;
          authStore.clearAuth();
          refreshTokenSubject.next(null);
          return throwError(() => refreshError);
        })
      );
    })
  );
};