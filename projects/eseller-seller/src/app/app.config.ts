import {
  ApplicationConfig,
  ErrorHandler,
  provideZonelessChangeDetection,
  provideAppInitializer
} from '@angular/core';
import { provideRouter, withInMemoryScrolling, withPreloading, PreloadAllModules } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi
} from '@angular/common/http';

import {
  authInterceptor,
  refreshInterceptor,
  errorInterceptor,
  authBootstrapFactory,
  ChunkLoadErrorHandler,
  setupChunkLoadRecovery
} from 'eseller-shared';

import { routes } from './app.routes';

setupChunkLoadRecovery();

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        // Keep disabled: #auth=... handoff must not be treated as an anchor id
        anchorScrolling: 'disabled'
      })
    ),
    {
      provide: ErrorHandler,
      useClass: ChunkLoadErrorHandler
    },
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