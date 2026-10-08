import { Component, input, output, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { ProductListDto, CartService, WishlistService, CompareService, ToastService, AuthActionService, ShopRatingBadge } from 'eseller-shared';

@Component({
  selector: 'app-product-list-card',
  imports: [DecimalPipe, ShopRatingBadge],
  templateUrl: './product-list-card.html',
  styleUrl: './product-list-card.css'
})
export class ProductListCard {
  private readonly router = inject(Router);
  private readonly cartService = inject(CartService);
  private readonly wishlistService = inject(WishlistService);
  private readonly compareService = inject(CompareService);
  private readonly toastService = inject(ToastService);
  private readonly authAction = inject(AuthActionService);

  // Inputs
  readonly product = input.required<ProductListDto>();

  // Outputs
  readonly addToCart = output<ProductListDto>();
  readonly addToWishlist = output<ProductListDto>();
  readonly addToCompare = output<ProductListDto>();

  readonly isInWishlist = computed(() => this.wishlistService.isInWishlist(this.product().id));
  readonly isInCompare = computed(() => this.compareService.isInCompare(this.product().id));
  readonly isInCart = computed(() => this.cartService.isInCart(this.product().id));

  // Computeds
  readonly productLink = computed(() => `/products/${this.product().slug}`);
  readonly fullName = computed(() => this.product().name);
  readonly hasRating = computed(() => (this.product().avgRating ?? 0) > 0);
  readonly reviewCount = computed(() => {
    const p = this.product();
    return Math.max(0, Number(p.reviewCount ?? p.reviewsCount ?? 0) || 0);
  });

  readonly formattedPrice = computed(() =>
    this.product().basePrice.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
  );

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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
  );

  readonly badges = computed(() => {
    const b = this.product().badges;
    if (!b) return [];

    type BadgeItem = { label: string; classes: string; key: string };
    const list: BadgeItem[] = [];

    if (b.isFlashSale) {
      list.push({ label: 'Flash Sale', classes: 'bg-red-500 text-white', key: 'flash_sale' });
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
    if (b.isBestSelling) {
      list.push({ label: 'Best Seller', classes: 'bg-[#8A9741] text-white', key: 'best_seller' });
    }
    if (b.isOutOfStock) {
      list.unshift({
        label: 'Out of Stock',
        classes: 'bg-gray-500 text-white',
        key: 'out_of_stock'
      });
    }

    return list.slice(0, 2);
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
      shopName: p.shopName,
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
