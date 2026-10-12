import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideZonelessChangeDetection,
  provideAppInitializer
} from '@angular/core';
import {
  PreloadAllModules,
  RouteReuseStrategy,
  provideRouter,
  withInMemoryScrolling,
  withPreloading
} from '@angular/router';
import { CustomRouteReuseStrategy } from './core/services/custom-route-reuse-strategy';
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
  authBootstrapFactory,
  ChunkLoadErrorHandler,
  setupChunkLoadRecovery
} from 'eseller-shared';

import { routes } from './app.routes';
import { SeoBrandingService } from './core/services/seo-branding.service';

setupChunkLoadRecovery();

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withInMemoryScrolling({
        scrollPositionRestoration: 'disabled',
        anchorScrolling: 'enabled'
      })
    ),
    {
      provide: ErrorHandler,
      useClass: ChunkLoadErrorHandler
    },
    {
      provide: RouteReuseStrategy,
      useClass: CustomRouteReuseStrategy
    },

    // ✅ Loading bar setup
    // Avoid flickering top bar on short MonsterASP round-trips
    provideLoadingBar({ latencyThreshold: 400 }),
    provideLoadingBarRouter(),
    provideLoadingBarInterceptor(),

    // ✅ HttpClient with interceptors
    provideHttpClient(
      withInterceptorsFromDi(),
      withInterceptors([
        authInterceptor,
        errorInterceptor,
        refreshInterceptor
      ])
    ),

    provideAppInitializer(authBootstrapFactory()),
    // SuperAdmin site title / meta description / nav-logo favicon
    provideAppInitializer(() => inject(SeoBrandingService).bootstrap())
  ]
};