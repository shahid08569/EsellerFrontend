import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiErrorResponse } from '../models/auth/auth.models';

/**
 * ============================================================
 * ApiService — Central HTTP wrapper
 * ------------------------------------------------------------
 * Responsibilities:
 *   - Prepends the API base URL to every request.
 *   - Sends cookies with every request (`withCredentials: true`)
 *     so the backend's HttpOnly refresh-token cookie is sent.
 *   - Normalises backend error responses into a consistent shape.
 *
 * Every feature service (Auth, Product, Cart, …) should depend
 * on this — no direct HttpClient usage outside this service.
 * ============================================================
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  /**
   * Base API URL. Read from a global config injected at bootstrap.
   * The app's bootstrap sets `window.__ESELLER_API_URL__` from
   * its environment file BEFORE Angular boots.
   *
   * This avoids duplicating the environment import inside the
   * shared library (which cannot know which app is running).
   */
  private get baseUrl(): string {
    const url = (window as any).__ESELLER_API_URL__ as string | undefined;
    if (!url) {
      throw new Error(
        'Eseller API URL not configured. Ensure app bootstrap sets window.__ESELLER_API_URL__.'
      );
    }
    return url.replace(/\/+$/, ''); // strip trailing slashes
  }

  // ============================================================
  // GET
  // ============================================================
  get<T>(path: string, options?: { headers?: HttpHeaders }): Observable<T> {
    return this.http
      .get<T>(this.buildUrl(path), {
        withCredentials: true,
        headers: options?.headers
      })
      .pipe(catchError((err) => this.handleError(err)));
  }

  // ============================================================
  // POST
  // ============================================================
  post<T>(path: string, body: unknown, options?: { headers?: HttpHeaders }): Observable<T> {
    return this.http
      .post<T>(this.buildUrl(path), body, {
        withCredentials: true,
        headers: options?.headers
      })
      .pipe(catchError((err) => this.handleError(err)));
  }

  // ============================================================
  // PUT
  // ============================================================
  put<T>(path: string, body: unknown, options?: { headers?: HttpHeaders }): Observable<T> {
    return this.http
      .put<T>(this.buildUrl(path), body, {
        withCredentials: true,
        headers: options?.headers
      })
      .pipe(catchError((err) => this.handleError(err)));
  }

  // ============================================================
  // PATCH
  // ============================================================
  patch<T>(path: string, body: unknown, options?: { headers?: HttpHeaders }): Observable<T> {
    return this.http
      .patch<T>(this.buildUrl(path), body, {
        withCredentials: true,
        headers: options?.headers
      })
      .pipe(catchError((err) => this.handleError(err)));
  }

  // ============================================================
  // DELETE
  // ============================================================
  delete<T>(path: string, options?: { headers?: HttpHeaders }): Observable<T> {
    return this.http
      .delete<T>(this.buildUrl(path), {
        withCredentials: true,
        headers: options?.headers
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

  /**
   * Normalises errors: extracts backend's { error, errorCode }
   * shape when present; otherwise passes a generic shape.
   */
  private handleError(err: HttpErrorResponse): Observable<never> {
    let normalised: ApiErrorResponse;

    if (err.error && typeof err.error === 'object') {
      normalised = {
        error: err.error.error ?? err.message,
        errorCode: err.error.errorCode ?? `HTTP_${err.status}`
      };
    } else if (typeof err.error === 'string') {
      normalised = { error: err.error, errorCode: `HTTP_${err.status}` };
    } else {
      normalised = {
        error: err.message || 'An unexpected error occurred.',
        errorCode: `HTTP_${err.status}`
      };
    }

    return throwError(() => normalised);
  }
}