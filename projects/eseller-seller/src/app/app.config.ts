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
        anchorScrolling: 'enabled'
      })
    ),
    provideHttpClient(
      withInterceptorsFromDi(),
      withInterceptors([
        authInterceptor,
        refreshInterceptor,
        errorInterceptor
      ])
    ),
    provideAppInitializer(authBootstrapFactory())
  ]
};