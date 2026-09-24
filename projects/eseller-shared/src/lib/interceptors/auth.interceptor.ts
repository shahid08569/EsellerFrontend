import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthStore } from '../state/auth.store';

/**
 * ============================================================
 * authInterceptor — Attaches the JWT to outgoing requests
 * ------------------------------------------------------------
 * - Reads the access token from AuthStore (memory only).
 * - Adds `Authorization: Bearer <token>` when present.
 * - Always sends cookies (`withCredentials`) so the backend's
 *   HttpOnly refresh cookie is included.
 * - Skips the Authorization header for auth endpoints that
 *   must not carry one (login, register, refresh, logout).
 * ============================================================
 */
const PUBLIC_AUTH_PATHS = [
  '/Auth/login',
  '/Auth/register',
  '/Affiliate/register',
  '/Auth/refresh-token',
  '/Auth/logout',
  '/Auth/forgot-password',
  '/Auth/reset-password',
  '/Auth/verify-email',
  '/Auth/resend-verification-email',
  '/Auth/send-phone-otp',
  '/Auth/verify-phone-otp'
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);

  const isPublicAuthRequest = PUBLIC_AUTH_PATHS.some((path) =>
    req.url.includes(path)
  );

  const token = authStore.accessToken();

  const headers: Record<string, string> = {};

  if (token && !isPublicAuthRequest) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cloned = req.clone({
    setHeaders: headers,
    withCredentials: true
  });

  return next(cloned);
};