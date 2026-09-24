import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

(window as any).__ESELLER_API_URL__ = environment.apiUrl;
(window as any).__ESELLER_CHAT_HUB_URL__ = environment.chatHubUrl;
(window as any).__ESELLER_NOTIFICATION_HUB_URL__ = environment.notificationHubUrl;

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));