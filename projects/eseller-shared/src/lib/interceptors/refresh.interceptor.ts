import {
  HttpErrorResponse,
  HttpInterceptorFn
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, BehaviorSubject, filter, take } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { AuthStore } from '../state/auth.store';

const SKIP_REFRESH_PATHS = [
  '/Auth/login',
  '/Auth/register',
  '/Affiliate/register',
  '/Auth/refresh-token'
];

/** null = idle/pending start; '' = refresh failed; otherwise new access token */
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

      if (isRefreshing) {
        return refreshTokenSubject.pipe(
          filter((token): token is string => token !== null),
          take(1),
          switchMap((token) => {
            if (token === '') {
              return throwError(() => error);
            }
            return next(
              req.clone({
                setHeaders: { Authorization: `Bearer ${token}` }
              })
            );
          })
        );
      }

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

          return next(
            req.clone({
              setHeaders: { Authorization: `Bearer ${response.accessToken}` }
            })
          );
        }),
        catchError((refreshError) => {
          isRefreshing = false;
          authStore.clearAuth();
          // Unblock waiters (empty string = failed), then reset gate
          refreshTokenSubject.next('');
          refreshTokenSubject.next(null);
          return throwError(() => refreshError);
        })
      );
    })
  );
};
