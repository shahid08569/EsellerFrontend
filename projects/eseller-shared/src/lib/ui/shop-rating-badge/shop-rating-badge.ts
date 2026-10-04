import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Store name + Verified + platform star rating (SuperAdmin-set).
 * Safe for visitors / logged-out users.
 */
@Component({
  selector: 'es-shop-rating-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shop-rating-badge.html'
})
export class ShopRatingBadge {
  readonly shopName = input<string>('');
  readonly rating = input<number | null | undefined>(0);
  readonly showVerified = input<boolean>(true);
  readonly showName = input<boolean>(true);
  readonly size = input<'sm' | 'md'>('sm');

  readonly stars = [1, 2, 3, 4, 5];

  readonly safeRating = computed(() => {
    const r = Number(this.rating() ?? 0);
    if (!Number.isFinite(r) || r <= 0) return 0;
    return Math.min(5, Math.max(0, Math.round(r * 10) / 10));
  });

  readonly hasRating = computed(() => this.safeRating() > 0);

  isFilled(star: number): boolean {
    return star <= Math.round(this.safeRating());
  }
}
