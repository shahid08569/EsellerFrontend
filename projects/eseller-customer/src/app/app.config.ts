import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  provideAppInitializer,
  inject
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import {
  authInterceptor,
  refreshInterceptor,
  errorInterceptor,
  authBootstrapFactory
} from 'eseller-shared';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([
        authInterceptor,      // 1. Attach JWT + cookies
        refreshInterceptor,   // 2. Catch 401 → silent refresh → retry
        errorInterceptor      // 3. Normalise errors
      ])
    ),
    // Silent refresh on app bootstrap (uses HttpOnly cookie)
    provideAppInitializer(authBootstrapFactory())
  ]
};