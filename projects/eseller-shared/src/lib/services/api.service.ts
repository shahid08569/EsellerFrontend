import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiErrorResponse } from '../models/auth/auth.models';

interface RequestOptions {
  headers?: HttpHeaders;
  params?: HttpParams;
}

/**
 * ============================================================
 * ApiService — Central HTTP wrapper
 * ============================================================
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    const url = (window as any).__ESELLER_API_URL__ as string | undefined;
    if (!url) {
      throw new Error(
        'Eseller API URL not configured. Ensure app bootstrap sets window.__ESELLER_API_URL__.'
      );
    }
    return url.replace(/\/+$/, '');
  }

  // ============================================================
  // GET
  // ============================================================
  get<T>(path: string, options?: RequestOptions): Observable<T> {
    return this.http
      .get<T>(this.buildUrl(path), {
        withCredentials: true,
        headers: options?.headers,
        params: options?.params
      })
      .pipe(catchError((err) => this.handleError(err)));
  }

  // ============================================================
  // POST
  // ============================================================
  post<T>(path: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http
      .post<T>(this.buildUrl(path), body, {
        withCredentials: true,
        headers: options?.headers,
        params: options?.params
      })
      .pipe(catchError((err) => this.handleError(err)));
  }

  // ============================================================
  // PUT
  // ============================================================
  put<T>(path: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http
      .put<T>(this.buildUrl(path), body, {
        withCredentials: true,
        headers: options?.headers,
        params: options?.params
      })
      .pipe(catchError((err) => this.handleError(err)));
  }

  // ============================================================
  // PATCH
  // ============================================================
  patch<T>(path: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http
      .patch<T>(this.buildUrl(path), body, {
        withCredentials: true,
        headers: options?.headers,
        params: options?.params
      })
      .pipe(catchError((err) => this.handleError(err)));
  }

  // ============================================================
  // DELETE
  // ============================================================
  delete<T>(path: string, options?: RequestOptions): Observable<T> {
    return this.http
      .delete<T>(this.buildUrl(path), {
        withCredentials: true,
        headers: options?.headers,
        params: options?.params
      })
      .pipe(catchError((err) => this.handleError(err)));
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${cleanPath}`;
  }

  private handleError(err: unknown): Observable<never> {
    // errorInterceptor already normalised — pass through
    if (err && typeof err === 'object' && 'error' in err && 'errorCode' in err && !('status' in err)) {
      return throwError(() => err as ApiErrorResponse);
    }

    const httpErr = err as HttpErrorResponse;
    let normalised: ApiErrorResponse;

    if (httpErr?.error && typeof httpErr.error === 'object') {
      const body = httpErr.error as Partial<ApiErrorResponse>;
      const firstFieldMsg = body.errors
        ? Object.values(body.errors).flat().find((m) => !!m)
        : undefined;
      normalised = {
        error: body.error || firstFieldMsg || httpErr.message || 'Request failed.',
        errorCode: body.errorCode ?? `HTTP_${httpErr.status}`,
        errors: body.errors
      };
    } else if (typeof httpErr?.error === 'string') {
      normalised = { error: httpErr.error, errorCode: `HTTP_${httpErr.status}` };
    } else {
      normalised = {
        error: httpErr?.message || 'An unexpected error occurred.',
        errorCode: `HTTP_${httpErr?.status ?? 0}`
      };
    }

    return throwError(() => normalised);
  }
}