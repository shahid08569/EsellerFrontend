import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { ApiErrorResponse } from '../models/auth/auth.models';

/**
 * ============================================================
 * errorInterceptor — Normalises backend errors
 * ------------------------------------------------------------
 * Backend returns: { error: string, errorCode: string }.
 * Network / unknown errors are wrapped into the same shape so
 * every consumer sees a single, consistent contract.
 *
 * Note: this runs AFTER refreshInterceptor in the provider
 * chain, so a 401 that could not be refreshed already carries
 * the backend's error payload.
 * ============================================================
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: unknown) => {
      const normalised: ApiErrorResponse = normalise(error);
      return throwError(() => normalised);
    })
  );
};

function normalise(error: unknown): ApiErrorResponse {
  if (error instanceof HttpErrorResponse) {
    if (error.error && typeof error.error === 'object') {
      const body = error.error as Partial<ApiErrorResponse>;
      return {
        error: body.error ?? error.message,
        errorCode: body.errorCode ?? `HTTP_${error.status}`
      };
    }
    if (typeof error.error === 'string' && error.error.length > 0) {
      return { error: error.error, errorCode: `HTTP_${error.status}` };
    }
    return {
      error: error.message || 'An unexpected network error occurred.',
      errorCode: `HTTP_${error.status || 0}`
    };
  }

  if (error instanceof Error) {
    return { error: error.message, errorCode: 'CLIENT_ERROR' };
  }

  return { error: 'An unknown error occurred.', errorCode: 'UNKNOWN' };
}