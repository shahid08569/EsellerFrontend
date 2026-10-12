import {
  ApplicationConfig,
  ErrorHandler,
  provideZonelessChangeDetection,
  provideAppInitializer
} from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

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
    provideRouter(routes, withPreloading(PreloadAllModules)),
    {
      provide: ErrorHandler,
      useClass: ChunkLoadErrorHandler
    },
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        errorInterceptor,
        refreshInterceptor
      ])
    ),
    provideAppInitializer(authBootstrapFactory())
  ]
};