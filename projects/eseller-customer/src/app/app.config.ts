import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  provideAppInitializer
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi
} from '@angular/common/http';

import { provideLoadingBar } from '@ngx-loading-bar/core';
import { provideLoadingBarInterceptor } from '@ngx-loading-bar/http-client';
import { provideLoadingBarRouter } from '@ngx-loading-bar/router';

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

    // ✅ Loading bar setup
    provideLoadingBar({ latencyThreshold: 100 }),
    provideLoadingBarRouter(),
    provideLoadingBarInterceptor(),

    // ✅ HttpClient with interceptors
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