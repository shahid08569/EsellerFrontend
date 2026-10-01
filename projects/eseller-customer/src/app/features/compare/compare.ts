import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  CompareService,
  CartService,
  WishlistService,
  ProductListDto,
  MAX_COMPARE_ITEMS,
  ToastService
} from 'eseller-shared';

@Component({
  selector: 'app-compare',
  imports: [CommonModule, RouterLink, DecimalPipe],
  templateUrl: './compare.html',
  styleUrl: './compare.css'
})
export class Compare implements OnInit {
  private readonly router = inject(Router);
  readonly compareService = inject(CompareService);
  private readonly cartService = inject(CartService);
  readonly wishlistService = inject(WishlistService);
  private readonly toastService = inject(ToastService);

  readonly maxItems = MAX_COMPARE_ITEMS;
  readonly feedbackMessage = signal<string | null>(null);
  readonly showClearModal = signal<boolean>(false);
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

  removeFromCompare(productId: string): void {
    this.compareService.removeItem(productId);
    this.showFeedback('Product removed from comparison.', 'info');
  }

  openClearModal(): void {
    this.showClearModal.set(true);
  }

  closeClearModal(): void {
    this.showClearModal.set(false);
  }

  confirmClearCompare(): void {
    this.compareService.clearCompare();
    this.closeClearModal();
    this.showFeedback('All products removed from comparison.', 'info');
  }

  addToCart(product: ProductListDto): void {
    const img = this.getImageUrl(product.primaryImageUrl);
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
    this.showFeedback(`Added "${product.name}" to cart!`, 'success');
  }

  toggleWishlist(product: ProductListDto): void {
    const added = this.wishlistService.toggleItem(product);
    this.showFeedback(
      added ? `Added "${product.name}" to wishlist!` : `Removed "${product.name}" from wishlist!`,
      added ? 'success' : 'info'
    );
  }

  isInWishlist(productId: string): boolean {
    return this.wishlistService.isInWishlist(productId);
  }

  isInCart(productId: string): boolean {
    return this.cartService.isInCart(productId);
  }

  hasDiscount(product: ProductListDto): boolean {
    return this.getDiscountPercent(product) > 0;
  }

  getDiscountPercent(product: ProductListDto): number {
    const b = product.badges;
    if (!b) return 0;
    return Math.max(b.discountPercent ?? 0, b.flashSaleDiscountPercent ?? 0);
  }

  getOldPrice(product: ProductListDto): number {
    const d = this.getDiscountPercent(product);
    if (d <= 0) return 0;
    return product.basePrice / (1 - d / 100);
  }

  getSavings(product: ProductListDto): number {
    const oldPrice = this.getOldPrice(product);
    return oldPrice > product.basePrice ? oldPrice - product.basePrice : 0;
  }

  getImageUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    const apiBase = (typeof window !== 'undefined' ? (window as any).__ESELLER_API_URL__ : '') as string;
    if (apiBase) {
      const host = apiBase.replace(/\/api\/v1\/?$/, '');
      const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
      return `${host}/uploads${path}`;
    }
    return imageUrl;
  }

  showFeedback(msg: string, type: 'success' | 'info' | 'error' | 'warning' = 'info'): void {
    this.toastService.show(msg, type);
  }
}
