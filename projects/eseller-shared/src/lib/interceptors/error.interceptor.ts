import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { ApiErrorResponse } from '../models/auth/auth.models';

/**
 * Normalises backend errors to { error, errorCode, errors? }.
 * Preserves FluentValidation `errors` map for field-level UI.
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
      const body = error.error as Partial<ApiErrorResponse> & { errors?: Record<string, string[]> };
      const firstFieldMsg = body.errors
        ? Object.values(body.errors).flat().find((m) => !!m)
        : undefined;
      return {
        error: body.error || firstFieldMsg || error.message || 'Request failed.',
        errorCode: body.errorCode ?? `HTTP_${error.status}`,
        errors: body.errors
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

  // Already normalised by a prior layer
  if (error && typeof error === 'object' && 'error' in (error as object) && 'errorCode' in (error as object)) {
    return error as ApiErrorResponse;
  }

  if (error instanceof Error) {
    return { error: error.message, errorCode: 'CLIENT_ERROR' };
  }

  return { error: 'An unknown error occurred.', errorCode: 'UNKNOWN' };
}
