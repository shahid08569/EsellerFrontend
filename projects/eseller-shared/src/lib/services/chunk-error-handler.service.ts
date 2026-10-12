import { ErrorHandler, Injectable } from '@angular/core';

/**
 * Global ErrorHandler that intercepts chunk loading failures.
 *
 * This typically happens when:
 * 1. A new build/deployment replaced hashed chunks on the server while the user
 *    kept the tab open for 20-30 minutes.
 * 2. Idle TCP keep-alive socket was reset by the server/Cloudflare (net::ERR_CONNECTION_RESET).
 *
 * It automatically reloads the page to cleanly fetch the latest index.html and fresh bundles.
 */
@Injectable({
  providedIn: 'root'
})
export class ChunkLoadErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    const message =
      error?.message ||
      (typeof error === 'string' ? error : '') ||
      error?.toString?.() ||
      '';

    const isChunkFailure =
      /Failed to fetch dynamically imported module/i.test(message) ||
      /Loading chunk [\w-]+ failed/i.test(message) ||
      /ERR_CONNECTION_RESET/i.test(message) ||
      /error loading dynamically imported module/i.test(message);

    if (isChunkFailure && typeof window !== 'undefined') {
      const lastReload = Number(window.sessionStorage?.getItem('chunk_reload_ts') || '0');
      const now = Date.now();
      // Guard against infinite reload loop: reload only if last reload was > 10 seconds ago
      if (now - lastReload > 10000) {
        window.sessionStorage?.setItem('chunk_reload_ts', now.toString());
        console.warn('Chunk loading failed or stale version detected. Auto-reloading to fetch latest app version...');
        window.location.reload();
        return;
      }
    }

    // Default console error for ordinary application errors
    console.error(error);
  }
}

/**
 * Sets up global window unhandledrejection listener for native dynamic import failures.
 */
export function setupChunkLoadRecovery(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event) => {
    const msg =
      event?.reason?.message ||
      (typeof event?.reason === 'string' ? event.reason : '') ||
      '';

    if (
      /Failed to fetch dynamically imported module/i.test(msg) ||
      /Loading chunk .* failed/i.test(msg) ||
      /ERR_CONNECTION_RESET/i.test(msg)
    ) {
      event.preventDefault();
      const lastReload = Number(window.sessionStorage?.getItem('chunk_reload_ts') || '0');
      const now = Date.now();
      if (now - lastReload > 10000) {
        window.sessionStorage?.setItem('chunk_reload_ts', now.toString());
        console.warn('Recovering from dynamic chunk import failure. Reloading to latest app version...');
        window.location.reload();
      }
    }
  });
}
