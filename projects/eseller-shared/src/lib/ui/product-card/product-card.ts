import {
  Component,
  input,
  computed,
  output,
  inject,
  signal,
  OnInit,
  OnDestroy
} from '@angular/core';
import { Router } from '@angular/router';

import { ProductListDto } from '../../models/catalog/catalog.models';

export type PreferredBadge =
  | 'flash_sale'
  | 'best_seller'
  | 'hot'
  | 'new'
  | 'featured'
  | null;

@Component({
  selector: 'es-product-card',
  imports: [],
  templateUrl: './product-card.html',
  host: {
    class: 'block'
  }
})
export class ProductCard implements OnInit, OnDestroy {
  private readonly router = inject(Router);

  // ============================================================
  // INPUTS
  // ============================================================
  readonly product = input.required<ProductListDto>();

  /** Flash sale end date — for countdown display */
  readonly countdownTo = input<Date | null>(null);

  /**
   * Which badge should be shown FIRST (top of the stack) when a
   * product has multiple badges. Defaults to null (natural order).
   */
  readonly preferredBadge = input<PreferredBadge>(null);

  // ============================================================
  // OUTPUTS
  // ============================================================
  readonly addToCart = output<ProductListDto>();
  readonly addToWishlist = output<ProductListDto>();
  readonly addToCompare = output<ProductListDto>();

  // ============================================================
  // BASIC COMPUTED
  // ============================================================
  readonly productLink = computed(() => `/products/${this.product().slug}`);
  readonly fullName = computed(() => this.product().name);
  readonly hasRating = computed(() => (this.product().avgRating ?? 0) > 0);

  readonly formattedPrice = computed(() =>
    this.product().basePrice.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  );

  // ============================================================
  // DISCOUNT
  // ============================================================
  readonly effectiveDiscount = computed(() => {
    const b = this.product().badges;
    if (!b) return 0;
    return Math.max(b.discountPercent ?? 0, b.flashSaleDiscountPercent ?? 0);
  });

  readonly hasDiscount = computed(() => this.effectiveDiscount() > 0);

  readonly oldPrice = computed(() => {
    const d = this.effectiveDiscount();
    if (d <= 0) return 0;
    return this.product().basePrice / (1 - d / 100);
  });

  readonly formattedOldPrice = computed(() =>
    this.oldPrice().toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  );

  // ============================================================
  // BADGES
  // ============================================================
  readonly badges = computed(() => {
    const b = this.product().badges;
    if (!b) return [];

    type BadgeItem = { label: string; classes: string; key: string };
    const list: BadgeItem[] = [];

    // Natural order (default)
    if (b.isFlashSale) {
      list.push({ label: 'Flash Sale', classes: 'bg-red-500 text-white', key: 'flash_sale' });
    }
    if (b.isBestSelling) {
      list.push({ label: 'Best Seller', classes: 'bg-[#8A9741] text-white', key: 'best_seller' });
    }
    if (b.isHotSelling) {
      list.push({ label: 'Hot', classes: 'bg-orange-500 text-white', key: 'hot' });
    }
    if (b.isNew) {
      list.push({ label: 'New', classes: 'bg-blue-500 text-white', key: 'new' });
    }
    if (b.isFeatured) {
      list.push({ label: 'Featured', classes: 'bg-primary text-white', key: 'featured' });
    }

    // ✅ Move preferred badge to first position
    const preferred = this.preferredBadge();
    if (preferred) {
      const idx = list.findIndex((x) => x.key === preferred);
      if (idx > 0) {
        const [item] = list.splice(idx, 1);
        list.unshift(item);
      }
    }

    // ✅ Out of Stock ALWAYS first (highest priority)
    if (b.isOutOfStock) {
      list.unshift({
        label: 'Out of Stock',
        classes: 'bg-gray-500 text-white',
        key: 'out_of_stock'
      });
    }

    return list.slice(0, 2);
  });

  // ============================================================
  // COUNTDOWN
  // ============================================================
  private readonly _now = signal(Date.now());
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly countdown = computed(() => {
    const target = this.countdownTo();
    if (!target) return null;

    const diff = target.getTime() - this._now();
    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    }

    const total = Math.floor(diff / 1000);
    return {
      days: Math.floor(total / 86400),
      hours: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60,
      expired: false
    };
  });

  // ============================================================
  // LIFECYCLE
  // ============================================================
  ngOnInit(): void {
    this.timer = setInterval(() => this._now.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================
  pad(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
  }

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

  onAddToCart(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.addToCart.emit(this.product());
  }

  onAddToWishlist(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.addToWishlist.emit(this.product());
  }

  onAddToCompare(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.addToCompare.emit(this.product());
  }
}