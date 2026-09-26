import { Component, input, computed, output, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ProductListDto } from 'eseller-shared';

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

  // ============================================================
  // INPUTS
  // ============================================================
  readonly product = input.required<ProductListDto>();

  // ============================================================
  // OUTPUTS
  // ============================================================
  readonly addToWishlist = output<ProductListDto>();

  // ============================================================
  // COMPUTED
  // ============================================================
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
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
    const host = apiBase.replace(/\/api\/v1\/?$/, '');
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
    this.addToWishlist.emit(this.product());
  }
}