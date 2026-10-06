import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Store name + tier badge (Gold / Diamond / …) + platform star rating.
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
  /** @deprecated Use shopBadgeText — verified chip removed. */
  readonly showVerified = input<boolean>(false);
  readonly shopBadgeText = input<string | null | undefined>(null);
  readonly shopBadgeColor = input<string | null | undefined>(null);
  readonly showName = input<boolean>(true);
  readonly size = input<'sm' | 'md'>('sm');

  readonly stars = [1, 2, 3, 4, 5];

  readonly safeRating = computed(() => {
    const r = Number(this.rating() ?? 0);
    if (!Number.isFinite(r) || r <= 0) return 0;
    return Math.min(5, Math.max(0, Math.round(r * 10) / 10));
  });

  readonly hasRating = computed(() => this.safeRating() > 0);

  /** Short tier label: Gold / Diamond / Bronze — always shown next to shop name */
  readonly tierLabel = computed(() => {
    const raw = String(this.shopBadgeText() || '').trim();
    if (!raw) return 'Bronze';
    const lower = raw.toLowerCase();
    if (lower.includes('diamond')) return 'Diamond';
    if (lower.includes('gold')) return 'Gold';
    if (lower.includes('bronze')) return 'Bronze';
    if (lower.includes('silver')) return 'Silver';
    if (lower.includes('platinum') || lower.includes('platnium')) return 'Platinum';
    // First word only — skip prices / free suffixes
    const first = raw.split(/[\s($/]/).find((w) => w.length > 0);
    return first || 'Bronze';
  });

  readonly tierStyles = computed(() => {
    const label = (this.tierLabel() || '').toLowerCase();
    const custom = String(this.shopBadgeColor() || '').trim();

    if (label.includes('diamond')) {
      return { bg: '#ECFEFF', color: '#0E7490', border: '#A5F3FC' };
    }
    if (label.includes('gold')) {
      return { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' };
    }
    if (label.includes('bronze')) {
      return { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' };
    }
    if (label.includes('silver')) {
      return { bg: '#F1F5F9', color: '#334155', border: '#CBD5E1' };
    }
    if (label.includes('platinum')) {
      return { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' };
    }
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(custom)) {
      return { bg: `${custom}1A`, color: custom, border: `${custom}55` };
    }
    return { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' };
  });

  isFilled(star: number): boolean {
    return star <= Math.round(this.safeRating());
  }
}
