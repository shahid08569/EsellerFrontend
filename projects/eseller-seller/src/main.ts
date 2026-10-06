import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';
import { safeDecodeHandoff } from 'eseller-shared';

(window as any).__ESELLER_API_URL__ = environment.apiUrl;
(window as any).__ESELLER_CHAT_HUB_URL__ = environment.chatHubUrl;
(window as any).__ESELLER_NOTIFICATION_HUB_URL__ = environment.notificationHubUrl;

/** Apply #auth= handoff BEFORE Angular guards run (avoids bounce to www login). */
function hydrateAuthHandoffFromHash(): void {
  try {
    const match = window.location.hash.match(/#auth=([^&]+)/);
    if (!match?.[1]) return;
    const payload = safeDecodeHandoff<any>(decodeURIComponent(match[1]));
    if (!payload?.accessToken || !payload?.accountId) return;
    const expiresAt = payload.accessTokenExpiresAt
      ? new Date(payload.accessTokenExpiresAt).toISOString()
      : new Date(Date.now() + 3600000).toISOString();
    window.localStorage.setItem(
      'eseller_auth_session',
      JSON.stringify({
        accessToken: payload.accessToken,
        accessTokenExpiresAt: expiresAt,
        account: {
          accountId: payload.accountId,
          username: payload.username,
          email: payload.email,
          roleType: payload.roleType
        }
      })
    );
    const clean = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', clean || '/dashboard');
  } catch (e) {
    console.error('Failed to hydrate seller auth handoff', e);
  }
}

hydrateAuthHandoffFromHash();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
