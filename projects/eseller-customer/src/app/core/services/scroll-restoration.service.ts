import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd, RouteReuseStrategy, ActivatedRouteSnapshot } from '@angular/router';
import { CustomRouteReuseStrategy } from './custom-route-reuse-strategy';

@Injectable({
  providedIn: 'root'
})
export class ScrollRestorationService {
  private readonly router = inject(Router);
  private readonly reuseStrategy = inject(RouteReuseStrategy, { optional: true });

  constructor() {
    this.init();
  }

  private init(): void {
    if (typeof window === 'undefined') return;

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const strategy = this.reuseStrategy as CustomRouteReuseStrategy | null;
        const currentSnapshot = this.router.routerState.snapshot.root;
        const leaf = this.getLeafSnapshot(currentSnapshot);

        // If the route was attached from memory cache, CustomRouteReuseStrategy restores its exact scroll position
        if (strategy && leaf && strategy.shouldAttach(leaf)) {
          return;
        }

        // For new pages, start from the absolute top (0, 0)
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    });
  }

  private getLeafSnapshot(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let curr = route;
    while (curr.firstChild) {
      curr = curr.firstChild;
    }
    return curr;
  }
}
