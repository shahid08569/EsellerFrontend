import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

// ============================================================
// Set environment config on window BEFORE Angular boots.
// The shared library reads these globals — it can't import
// app-specific environment files.
// ============================================================
(window as any).__ESELLER_API_URL__ = environment.apiUrl;
(window as any).__ESELLER_CHAT_HUB_URL__ = environment.chatHubUrl;
(window as any).__ESELLER_NOTIFICATION_HUB_URL__ = environment.notificationHubUrl;

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));