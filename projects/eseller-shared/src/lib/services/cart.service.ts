import { Injectable, signal, computed, effect } from '@angular/core';

export interface CartItem {
  id: string; // Composite key: `${productId}_${variantId || 'base'}`
  productId: string;
  productSlug: string;
  name: string;
  imageUrl: string | null;
  shopId: string;
  shopName: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  variantId?: string | null;
  variantName?: string | null;
  sku?: string | null;
}

export interface OrderCheckoutDto {
  fullName: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  province: string;
  country?: string;
  state?: string;
  postalCode?: string;
  orderNotes?: string;
  paymentMethod: 'COD' | 'CHAT_CONFIRMATION' | 'BANK_TRANSFER';
  items: CartItem[];
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
}

const CART_STORAGE_KEY = 'eseller_cart_items_v1';

@Injectable({ providedIn: 'root' })
export class CartService {
  // Cart items signal initialized from localStorage if available
  readonly items = signal<CartItem[]>(this.loadStoredItems());

  // Direct buy-now item (for instant single-product checkout from PDP)
  readonly buyNowItem = signal<CartItem | null>(null);

  // Computeds
  readonly totalItemsCount = computed(() =>
    this.items().reduce((acc, item) => acc + item.quantity, 0)
  );

  readonly subtotal = computed(() =>
    this.items().reduce((acc, item) => acc + item.price * item.quantity, 0)
  );

  // Free shipping threshold: Rs. 5,000, otherwise flat Rs. 200
  readonly shippingFee = computed(() => {
    const sub = this.subtotal();
    if (sub <= 0) return 0;
    return sub >= 5000 ? 0 : 200;
  });

  readonly totalAmount = computed(() => this.subtotal() + this.shippingFee());

  readonly formattedSubtotal = computed(() =>
    this.subtotal().toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })
  );

  readonly formattedShipping = computed(() => {
    const fee = this.shippingFee();
    if (fee === 0) return 'Free';
    return `Rs. ${fee.toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })}`;
  });

  readonly formattedTotal = computed(() =>
    this.totalAmount().toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })
  );

  constructor() {
    // Automatically persist cart items to localStorage on change
    effect(() => {
      const itemsList = this.items();
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(itemsList));
        } catch {
          // Ignore localStorage quota errors
        }
      }
    });
  }

  private loadStoredItems(): CartItem[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }
    try {
      const stored = window.localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // ============================================================
  // CART ACTIONS
  // ============================================================
  isInCart(productId: string): boolean {
    return this.items().some((i) => i.productId === productId);
  }

  addItem(item: Omit<CartItem, 'id'>): void {
    const compositeId = `${item.productId}_${item.variantId || 'base'}`;
    const current = this.items();
    const existingIndex = current.findIndex((i) => i.id === compositeId);

    if (existingIndex > -1) {
      const updated = [...current];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + item.quantity
      };
      this.items.set(updated);
    } else {
      this.items.set([...current, { ...item, id: compositeId }]);
    }
  }

  updateQuantity(id: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(id);
      return;
    }
    const current = this.items();
    this.items.set(
      current.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }

  updateItemVariant(id: string, newVariantName: string): void {
    const current = this.items();
    this.items.set(
      current.map((item) => (item.id === id ? { ...item, variantName: newVariantName } : item))
    );
  }

  removeItem(id: string): void {
    const current = this.items();
    this.items.set(current.filter((item) => item.id !== id));
  }

  removeByProductId(productId: string): void {
    const current = this.items();
    this.items.set(current.filter((item) => item.productId !== productId));
  }

  toggleItem(item: Omit<CartItem, 'id'>): boolean {
    if (this.isInCart(item.productId)) {
      this.removeByProductId(item.productId);
      return false; // Removed from cart
    } else {
      this.addItem(item);
      return true; // Added to cart
    }
  }

  clearCart(): void {
    this.items.set([]);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(CART_STORAGE_KEY);
      } catch {}
    }
  }

  // ============================================================
  // DIRECT BUY NOW (PDP Instant Order)
  // ============================================================
  setBuyNow(item: Omit<CartItem, 'id'>): void {
    const compositeId = `${item.productId}_${item.variantId || 'base'}`;
    this.buyNowItem.set({ ...item, id: compositeId });
  }

  clearBuyNow(): void {
    this.buyNowItem.set(null);
  }
}
