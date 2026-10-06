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
import { CommonModule } from '@angular/common';

import { ProductListDto } from '../../models/catalog/catalog.models';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { CompareService } from '../../services/compare.service';
import { ToastService } from '../../services/toast.service';
import { AuthActionService } from '../../services/auth-action.service';

export type PreferredBadge =
  | 'flash_sale'
  | 'best_seller'
  | 'hot'
  | 'new'
  | 'featured'
  | null;

const SECTION_BADGE_META: Record<
  Exclude<PreferredBadge, null>,
  { label: string; classes: string; key: string }
> = {
  flash_sale: { label: 'Flash Sale', classes: 'bg-red-500 text-white', key: 'flash_sale' },
  hot: { label: 'Hot Selling', classes: 'bg-orange-500 text-white', key: 'hot' },
  new: { label: 'New Arrival', classes: 'bg-blue-500 text-white', key: 'new' },
  featured: { label: 'Featured', classes: 'bg-violet-600 text-white', key: 'featured' },
  best_seller: { label: 'Best Seller', classes: 'bg-slate-700 text-white', key: 'best_seller' }
};

@Component({
  selector: 'es-product-card',
  imports: [CommonModule],
  templateUrl: './product-card.html',
  host: {
    class: 'block h-full'
  }
})
export class ProductCard implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly cartService = inject(CartService);
  private readonly wishlistService = inject(WishlistService);
  private readonly compareService = inject(CompareService);
  private readonly toastService = inject(ToastService);
  private readonly authAction = inject(AuthActionService);

  readonly isInWishlist = computed(() => this.wishlistService.isInWishlist(this.product().id));
  readonly isInCart = computed(() => this.cartService.isInCart(this.product().id));
  readonly isInCompare = computed(() => this.compareService.isInCompare(this.product().id));

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
  // BADGES — 1st = section tag (always), 2nd = next priority
  // ============================================================
  readonly badges = computed(() => {
    type BadgeItem = { label: string; classes: string; key: string };
    const b = this.product().badges;
    const preferred = this.preferredBadge();
    const list: BadgeItem[] = [];

    // Always show section tag first when on a curated homepage section
    if (preferred && SECTION_BADGE_META[preferred]) {
      list.push({ ...SECTION_BADGE_META[preferred] });
    }

    const candidates: BadgeItem[] = [];
    if (b?.isFlashSale) {
      candidates.push({ label: 'Flash Sale', classes: 'bg-red-500 text-white', key: 'flash_sale' });
    }
    if (b?.isHotSelling) {
      candidates.push({ label: 'Hot Selling', classes: 'bg-orange-500 text-white', key: 'hot' });
    }
    if (b?.isNew) {
      candidates.push({ label: 'New Arrival', classes: 'bg-blue-500 text-white', key: 'new' });
    }
    if (b?.isFeatured) {
      candidates.push({ label: 'Featured', classes: 'bg-violet-600 text-white', key: 'featured' });
    }
    if (b?.isBestSelling) {
      candidates.push({ label: 'Best Seller', classes: 'bg-slate-700 text-white', key: 'best_seller' });
    }

    for (const c of candidates) {
      if (list.some((x) => x.key === c.key)) continue;
      list.push(c);
      if (list.length >= 2) break;
    }

    if (b?.isOutOfStock) {
      list.unshift({
        label: 'Out of Stock',
        classes: 'bg-gray-500 text-white',
        key: 'out_of_stock'
      });
    }

    return list.slice(0, 2);
  });

  readonly tierLabel = computed(() => {
    const raw = String(this.product().shopBadgeText || '').trim();
    if (!raw) return 'Bronze';
    const lower = raw.toLowerCase();
    if (lower.includes('diamond')) return 'Diamond';
    if (lower.includes('gold')) return 'Gold';
    if (lower.includes('bronze')) return 'Bronze';
    if (lower.includes('silver')) return 'Silver';
    if (lower.includes('platinum') || lower.includes('platnium')) return 'Platinum';
    const first = raw.split(/[\s($/]/).find((w) => w.length > 0);
    return first || 'Bronze';
  });

  readonly tierStyles = computed(() => {
    const label = this.tierLabel().toLowerCase();
    if (label.includes('diamond')) return { bg: '#ECFEFF', color: '#0E7490', border: '#A5F3FC' };
    if (label.includes('gold')) return { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' };
    if (label.includes('platinum')) return { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' };
    if (label.includes('silver')) return { bg: '#F1F5F9', color: '#334155', border: '#CBD5E1' };
    const custom = String(this.product().shopBadgeColor || '').trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(custom)) {
      return { bg: `${custom}1A`, color: custom, border: `${custom}55` };
    }
    return { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' };
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
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    const apiBase =
      ((typeof window !== 'undefined' ? (window as any).__ESELLER_API_URL__ : '') as string) ||
      'https://localhost:7127/api/v1';
    const host = apiBase.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
    const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
    // DB already stores "/uploads/..." — do not prefix again
    if (path.startsWith('/uploads')) return `${host}${path}`;
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
    if (!this.authAction.requireLogin('add items to your cart')) return;
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
      shopId: (p as any).shopId || '',
      shopName: p.shopName || '',
      price: p.basePrice,
      quantity: 1
    });
    this.toastService.show(`Added "${p.name}" to your cart!`, 'success');
    this.addToCart.emit(p);
  }

  onAddToWishlist(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.authAction.requireLogin('save items to your wishlist')) return;
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
    if (!this.authAction.requireLogin('compare products')) return;
    const p = this.product();
    const result = this.compareService.toggleItem(p);
    this.toastService.show(result.message, result.added ? 'success' : 'info');
    this.addToCompare.emit(p);
  }
}