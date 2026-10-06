import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  provideAppInitializer
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi
} from '@angular/common/http';

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
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        // Keep disabled: #auth=... handoff must not be treated as an anchor id
        anchorScrolling: 'disabled'
      })
    ),
    provideHttpClient(
      withInterceptorsFromDi(),
      withInterceptors([
        authInterceptor,
        errorInterceptor,
        refreshInterceptor
      ])
    ),
    provideAppInitializer(authBootstrapFactory())
  ]
};