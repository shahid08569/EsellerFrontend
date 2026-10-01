import { Injectable, signal, computed, effect } from '@angular/core';
import { ProductListDto } from '../models/catalog/catalog.models';

const WISHLIST_STORAGE_KEY = 'eseller_wishlist_items_v1';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  readonly items = signal<ProductListDto[]>(this.loadStoredItems());

  readonly totalCount = computed(() => this.items().length);

  constructor() {
    effect(() => {
      const list = this.items();
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(list));
        } catch {}
      }
    });
  }

  private loadStoredItems(): ProductListDto[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }
    try {
      const stored = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  isInWishlist(productId: string): boolean {
    return this.items().some((p) => p.id === productId);
  }

  toggleItem(product: ProductListDto): boolean {
    if (this.isInWishlist(product.id)) {
      this.removeItem(product.id);
      return false; // Removed
    } else {
      this.addItem(product);
      return true; // Added
    }
  }

  addItem(product: ProductListDto): void {
    const current = this.items();
    if (!current.some((p) => p.id === product.id)) {
      this.items.set([product, ...current]);
    }
  }

  removeItem(productId: string): void {
    const current = this.items();
    this.items.set(current.filter((p) => p.id !== productId));
  }

  clearWishlist(): void {
    this.items.set([]);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(WISHLIST_STORAGE_KEY);
      } catch {}
    }
  }
}
