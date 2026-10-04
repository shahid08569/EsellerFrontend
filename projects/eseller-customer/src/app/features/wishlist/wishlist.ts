import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WishlistService, CartService, ProductListDto, ToastService, AuthActionService } from 'eseller-shared';

@Component({
  selector: 'app-wishlist',
  imports: [CommonModule, RouterLink],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css'
})
export class Wishlist implements OnInit {
  readonly wishlistService = inject(WishlistService);
  private readonly cartService = inject(CartService);
  private readonly toastService = inject(ToastService);
  private readonly authAction = inject(AuthActionService);

  readonly feedbackMessage = signal<string | null>(null);
  readonly loading = signal<boolean>(true);

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      setTimeout(() => {
        this.loading.set(false);
      }, 300);
    } else {
      this.loading.set(false);
    }
  }

  readonly showClearModal = signal<boolean>(false);

  moveToCart(product: ProductListDto): void {
    if (!this.authAction.requireLogin('add items to your cart')) return;
    const img = this.getImageUrl(product.primaryImageUrl);
    if (!this.cartService.isInCart(product.id)) {
      this.cartService.addItem({
        productId: product.id,
        productSlug: product.slug,
        name: product.name,
        imageUrl: img,
        shopId: (product as any).shopId || product.shopSlug || '',
        shopName: product.shopName || '',
        price: product.basePrice,
        quantity: 1,
        variantName: 'Standard',
        sku: null
      });
    }
    this.wishlistService.removeItem(product.id);
    this.toastService.show(`Moved "${product.name}" to cart!`, 'success');
  }

  removeFromWishlist(productId: string): void {
    this.wishlistService.removeItem(productId);
    this.toastService.show('Item removed from wishlist.', 'info');
  }

  openClearModal(): void {
    this.showClearModal.set(true);
  }

  closeClearModal(): void {
    this.showClearModal.set(false);
  }

  confirmClearWishlist(): void {
    this.wishlistService.clearWishlist();
    this.showClearModal.set(false);
    this.toastService.show('Wishlist cleared.', 'info');
  }

  getImageUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const apiBase = typeof window !== 'undefined' ? ((window as any).__ESELLER_API_URL__ as string) : '';
    const host = apiBase ? apiBase.replace(/\/api\/v1\/?$/, '') : 'https://localhost:7127';
    const path = url.startsWith('/') ? url : `/${url}`;
    if (path.startsWith('/uploads/')) {
      return `${host}${path}`;
    }
    return `${host}/uploads${path}`;
  }

  private showFeedback(msg: string): void {
    this.toastService.show(msg, 'info');
  }
}

