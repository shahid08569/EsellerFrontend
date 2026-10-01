import { Injectable } from '@angular/core';
import { RouteReuseStrategy, DetachedRouteHandle, ActivatedRouteSnapshot } from '@angular/router';

interface StoredRouteEntry {
  handle: DetachedRouteHandle;
  scrollY: number;
}

@Injectable({
  providedIn: 'root'
})
export class CustomRouteReuseStrategy implements RouteReuseStrategy {
  private readonly handlers = new Map<string, StoredRouteEntry>();

  /**
   * Identifies reusable superior/listing pages.
   * Returns a unique cache key, or null if the route should not be cached.
   */
  private getRouteKey(route: ActivatedRouteSnapshot): string | null {
    // Only target leaf page routes (not layout wrappers with children)
    if (route.firstChild) {
      return null;
    }

    const config = route.routeConfig;
    if (!config) return null;

    const path = config.path;
    if (path === undefined || path === null) return null;

    // We only reuse superior / listing pages (Home, Products, Collections, Lists)
    const superiorPaths = [
      '',
      'products',
      'categories',
      'brands',
      'flash-sales',
      'new-arrivals',
      'featured',
      'hot-selling',
      'best-selling'
    ];

    if (superiorPaths.includes(path)) {
      const collection = route.data?.['collection'];
      if (collection) {
        return `collection_${collection}`;
      }
      return path === '' ? 'home' : `page_${path}`;
    }

    return null;
  }

  /**
   * Decides if the route being left should be detached and stored in memory.
   */
  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    const key = this.getRouteKey(route);
    return key !== null;
  }

  /**
   * Stores the detached route handle and the current scroll position.
   */
  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this.getRouteKey(route);
    if (!key) return;

    if (handle) {
      const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
      this.handlers.set(key, { handle, scrollY });
    } else {
      this.handlers.delete(key);
    }
  }

  /**
   * Decides if a stored route handle should be re-attached instead of creating a new component.
   */
  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.getRouteKey(route);
    if (!key) return false;
    return this.handlers.has(key);
  }

  /**
   * Retrieves the stored route handle and schedules precise scroll restoration.
   */
  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.getRouteKey(route);
    if (!key) return null;

    const entry = this.handlers.get(key);
    if (!entry) return null;

    const targetY = entry.scrollY;

    if (typeof window !== 'undefined') {
      // Re-attached components have full DOM height in memory, so restoration is instant
      requestAnimationFrame(() => {
        window.scrollTo({ top: targetY, left: 0, behavior: 'instant' });
        // Secondary safeguard microtask for any browser reflow
        setTimeout(() => {
          window.scrollTo({ top: targetY, left: 0, behavior: 'instant' });
        }, 30);
      });
    }

    return entry.handle;
  }

  /**
   * Determines if a route should be reused (e.g. query param changes like pagination on the same route).
   */
  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  /**
   * Optional helper to clear saved scroll position for a route when needed (e.g. header logo click).
   */
  clearRoute(key: string): void {
    this.handlers.delete(key);
  }

  clearAll(): void {
    this.handlers.clear();
  }
}
