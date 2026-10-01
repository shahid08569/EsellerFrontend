import { Component, input, computed, output, inject } from '@angular/core';
import { Router } from '@angular/router';

import {
  ProductListDto,
  CartService,
  WishlistService,
  CompareService,
  ToastService
} from 'eseller-shared';

@Component({
  selector: 'app-category-product-card',
  imports: [],
  templateUrl: './category-product-card.html',
  host: {
    class: 'block h-full'
  }
})
export class CategoryProductCard {
  private readonly router = inject(Router);
  private readonly cartService = inject(CartService);
  private readonly wishlistService = inject(WishlistService);
  private readonly compareService = inject(CompareService);
  private readonly toastService = inject(ToastService);

  // ============================================================
  // INPUTS
  // ============================================================
  readonly product = input.required<ProductListDto>();

  // ============================================================
  // OUTPUTS
  // ============================================================
  readonly addToWishlist = output<ProductListDto>();
  readonly addToCompare = output<ProductListDto>();
  readonly addToCart = output<ProductListDto>();

  // ============================================================
  // COMPUTED
  // ============================================================
  readonly isInWishlist = computed(() => this.wishlistService.isInWishlist(this.product().id));
  readonly isInCompare = computed(() => this.compareService.isInCompare(this.product().id));
  readonly isInCart = computed(() => this.cartService.isInCart(this.product().id));
  readonly productLink = computed(() => `/products/${this.product().slug}`);
  readonly fullName = computed(() => this.product().name);

  /** Has rating — true if avgRating > 0 */
  readonly hasRating = computed(() => (this.product().avgRating ?? 0) > 0);

  /** Raw rating value (0-5, decimal) — used for star fill logic */
  readonly ratingValue = computed(() => this.product().avgRating ?? 0);

  /** Rating display — always 1 decimal (e.g., "4.5") */
  readonly ratingDisplay = computed(() => {
    const rating = this.product().avgRating ?? 0;
    return rating.toFixed(1);
  });

  /** Formatted price with commas */
  readonly formattedPrice = computed(() =>
    this.product().basePrice.toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })
  );

  /** Star array — 1 to 5 */
  readonly stars = [1, 2, 3, 4, 5];

  // ============================================================
  // HELPERS
  // ============================================================
  getImageUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    const apiBase = (window as any).__ESELLER_API_URL__ as string;
    const host = apiBase ? apiBase.replace(/\/api\/v1\/?$/, '') : '';
    const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
    return `${host}/uploads${path}`;
  }

  // ============================================================
  // ACTIONS
  // ============================================================
  onCardClick(): void {
    this.router.navigateByUrl(this.productLink());
  }

  onAddToWishlist(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const p = this.product();
    const added = this.wishlistService.toggleItem(p);
    this.toastService.show(
      added ? `Added "${p.name}" to your wishlist!` : `Removed "${p.name}" from your wishlist!`,
      added ? 'success' : 'info'
    );
    this.addToWishlist.emit(p);
  }

  onAddToCompare(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const p = this.product();
    const result = this.compareService.toggleItem(p);
    this.toastService.show(result.message, result.added ? 'success' : 'info');
    this.addToCompare.emit(p);
  }

  onAddToCart(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const p = this.product();
    if (this.isInCart()) {
      this.cartService.removeByProductId(p.id);
      this.toastService.show(`Removed "${p.name}" from your cart!`, 'info');
      return;
    }
    this.cartService.addItem({
      productId: p.id,
      productSlug: p.slug,
      name: p.name,
      imageUrl: this.getImageUrl(p.primaryImageUrl),
      shopId: '',
      shopName: p.shopName || '',
      price: p.basePrice,
      quantity: 1
    });
    this.toastService.show(`Added "${p.name}" to your cart!`, 'success');
    this.addToCart.emit(p);
  }
}