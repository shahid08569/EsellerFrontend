import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../state/auth.store';
import { ToastService } from './toast.service';

/**
 * Blocks cart / wishlist / compare / checkout for guests and
 * redirects them to the customer login page with returnUrl.
 */
@Injectable({ providedIn: 'root' })
export class AuthActionService {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** True when a signed-in customer (User) can perform commerce actions. */
  canShop(): boolean {
    return this.authStore.isAuthenticated() && this.authStore.role() === 'User';
  }

  /**
   * Require login before cart/wishlist/compare/checkout.
   * Guests are redirected to /auth/login?returnUrl=… (current page).
   */
  requireLogin(actionLabel = 'continue'): boolean {
    return this.requireLoginFor(this.router.url || '/', actionLabel);
  }

  /**
   * Same as requireLogin, but returnUrl points at the intended destination
   * (e.g. navbar Compare → /compare after login).
   */
  requireLoginFor(returnUrl: string, actionLabel = 'continue'): boolean {
    if (this.canShop()) return true;

    if (!this.authStore.isAuthenticated()) {
      this.toast.show(`Please sign in or create an account to ${actionLabel}.`, 'warning');
    } else {
      this.toast.show('Please sign in with a customer account to shop.', 'warning');
    }

    void this.router.navigate(['/auth/login'], {
      queryParams: { returnUrl: returnUrl || '/' }
    });
    return false;
  }
}
