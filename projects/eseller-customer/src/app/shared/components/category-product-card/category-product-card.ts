import { Component, input, computed, inject, output } from '@angular/core';
import { Router } from '@angular/router';
import {
  ProductListDto,
  CartService,
  WishlistService,
  CompareService,
  ToastService,
  AuthActionService
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
  private readonly authAction = inject(AuthActionService);

  readonly product = input.required<ProductListDto>();
  readonly addToCart = output<ProductListDto>();
  readonly addToWishlist = output<ProductListDto>();
  readonly addToCompare = output<ProductListDto>();

  readonly productLink = computed(() => `/products/${this.product().slug}`);
  readonly fullName = computed(() => this.product().name);

  readonly isInWishlist = computed(() => this.wishlistService.isInWishlist(this.product().id));
  readonly isInCompare = computed(() => this.compareService.isInCompare(this.product().id));
  readonly isInCart = computed(() => this.cartService.isInCart(this.product().id));

  /** One-line description for category cards */
  readonly shortDesc = computed(() => {
    const raw = String(this.product().description || '').replace(/\s+/g, ' ').trim();
    if (raw) return raw;
    const brand = (this.product().brandName || '').trim();
    const cat = (this.product().categoryName || '').trim();
    if (brand && cat) return `${brand} · ${cat}`;
    return brand || cat || '';
  });

  readonly formattedPrice = computed(() =>
    this.product().basePrice.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  );

  readonly effectiveDiscount = computed(() => {
    const b = this.product().badges;
    if (!b) return 0;
    return Math.max(b.discountPercent ?? 0, b.flashSaleDiscountPercent ?? 0);
  });

  readonly hasDiscount = computed(() => this.effectiveDiscount() > 0);

  readonly formattedOldPrice = computed(() => {
    const d = this.effectiveDiscount();
    if (d <= 0) return '';
    const old = this.product().basePrice / (1 - d / 100);
    return old.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });

  /** Store tier only — no reviews */
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

  getImageUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    const apiBase =
      ((typeof window !== 'undefined' ? (window as any).__ESELLER_API_URL__ : '') as string) ||
      'https://localhost:7127/api/v1';
    const host = apiBase.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
    const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
    if (path.startsWith('/uploads')) return `${host}${path}`;
    return `${host}/uploads${path}`;
  }

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
