import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  provideAppInitializer
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
        authInterceptor,
        refreshInterceptor,
        errorInterceptor
      ])
    ),
    provideAppInitializer(authBootstrapFactory())
  ]
};