import { Injectable, signal, computed, effect } from '@angular/core';
import { ProductListDto } from '../models/catalog/catalog.models';

const COMPARE_STORAGE_KEY = 'eseller_compare_items_v1';
export const MAX_COMPARE_ITEMS = 4;

export interface CompareToggleResult {
  added: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class CompareService {
  readonly items = signal<ProductListDto[]>(this.loadStoredItems());

  readonly totalCount = computed(() => this.items().length);

  readonly isFull = computed(() => this.items().length >= MAX_COMPARE_ITEMS);

  constructor() {
    effect(() => {
      const list = this.items();
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(list));
        } catch {}
      }
    });
  }

  private loadStoredItems(): ProductListDto[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }
    try {
      const stored = window.localStorage.getItem(COMPARE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  isInCompare(productId: string): boolean {
    return this.items().some((p) => p.id === productId);
  }

  addItem(product: ProductListDto): { success: boolean; message: string } {
    const current = this.items();
    if (current.some((p) => p.id === product.id)) {
      return { success: false, message: `"${product.name}" is already in comparison.` };
    }

    if (current.length >= MAX_COMPARE_ITEMS) {
      return {
        success: false,
        message: `You can compare up to ${MAX_COMPARE_ITEMS} products at a time. Please remove an item first.`
      };
    }

    this.items.set([...current, product]);
    return {
      success: true,
      message: `Added "${product.name}" to comparison.`
    };
  }

  removeItem(productId: string): void {
    const current = this.items();
    this.items.set(current.filter((p) => p.id !== productId));
  }

  toggleItem(product: ProductListDto): CompareToggleResult {
    if (this.isInCompare(product.id)) {
      this.removeItem(product.id);
      return {
        added: false,
        message: `Removed "${product.name}" from comparison.`
      };
    } else {
      const result = this.addItem(product);
      return {
        added: result.success,
        message: result.message
      };
    }
  }

  clearCompare(): void {
    this.items.set([]);
  }
}
