import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import {
  CartService,
  CartItem,
  AuthStore,
  AuthActionService,
  ToastService,
  DashboardService,
  AddressDto,
  OrderService,
  CreateOrderRequest
} from 'eseller-shared';
import {
  SearchableSelect,
  SelectOption
} from '../../shared/components/searchable-select/searchable-select';
import { DialCodeSelect, DialCodeOption } from '../../shared/components/dial-code-select/dial-code-select';
import {
  COUNTRIES_DATA,
  phonePlaceholderForDialCode
} from '../../shared/data/countries-states.data';
import { toLocalPhoneNumber } from '../../shared/utils/phone.util';

@Component({
  selector: 'app-cart',
  imports: [CommonModule, FormsModule, RouterLink, SearchableSelect, DialCodeSelect],
  templateUrl: './cart.html',
  styleUrl: './cart.css'
})
export class Cart implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly cartService = inject(CartService);
  readonly authStore = inject(AuthStore);
  private readonly authAction = inject(AuthActionService);
  private readonly toastService = inject(ToastService);
  private readonly dashboardService = inject(DashboardService);
  private readonly orderService = inject(OrderService);

  // Delivery details form state
  readonly customerName = signal<string>('');
  readonly customerPhone = signal<string>('');
  readonly deliveryAddress = signal<string>('');
  /** Empty until user picks — no default Pakistan. */
  readonly selectedCountry = signal<string>('');
  /** Dial code auto-fills from country, but user can change it anytime. */
  readonly selectedDialCode = signal<string>('');
  readonly selectedState = signal<string>('');
  readonly deliveryCity = signal<string>('');
  readonly orderNotes = signal<string>('');

  // Field-level error validation signals
  readonly nameError = signal<string | null>(null);
  readonly phoneError = signal<string | null>(null);
  readonly addressError = signal<string | null>(null);
  readonly cityError = signal<string | null>(null);
  readonly countryError = signal<string | null>(null);
  readonly stateError = signal<string | null>(null);
  readonly orderError = signal<string | null>(null);

  readonly isSubmitting = signal<boolean>(false);
  readonly feedbackMessage = signal<string | null>(null);

  // Searchable Country options (dial code shown after selection)
  readonly countryOptions = computed<SelectOption[]>(() =>
    COUNTRIES_DATA.map((c) => ({
      value: c.name,
      label: c.name,
      flag: c.flag,
      subLabel: c.phoneCode
    }))
  );

  /** Changeable dial-code list — codes (+flag) only, no country names. */
  readonly dialCodeOptions = computed<DialCodeOption[]>(() => {
    const seen = new Set<string>();
    return COUNTRIES_DATA.filter((c) => {
      if (!c.phoneCode || seen.has(c.phoneCode)) return false;
      seen.add(c.phoneCode);
      return true;
    }).map((c) => ({
      code: c.phoneCode,
      flag: c.flag
    }));
  });

  readonly selectedCountryData = computed(() => {
    const name = this.selectedCountry();
    if (!name) return null;
    return COUNTRIES_DATA.find((x) => x.name === name) || null;
  });

  readonly selectedFlag = computed(() => {
    const code = this.selectedDialCode();
    if (code) {
      const byCode = COUNTRIES_DATA.find((c) => c.phoneCode === code);
      if (byCode) return byCode.flag;
    }
    return this.selectedCountryData()?.flag || '🌍';
  });

  readonly phonePlaceholder = computed(() =>
    phonePlaceholderForDialCode(this.selectedDialCode())
  );

  // Searchable Cascading State options based on selectedCountry
  readonly stateOptions = computed<SelectOption[]>(() => {
    const c = COUNTRIES_DATA.find((x) => x.name === this.selectedCountry());
    if (!c || !c.states) return [];
    return c.states.map((s) => ({
      value: s,
      label: s
    }));
  });

  readonly savedAddresses = signal<AddressDto[]>([]);
  readonly selectedSavedAddressId = signal<string | null>(null);

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    // Auto-populate customer info if logged in
    if (this.authStore.isAuthenticated()) {
      // Load profile to get real full name & phone
      this.dashboardService.getProfile().subscribe({
        next: (profile) => {
          if (profile.name && !this.customerName()) {
            this.customerName.set(profile.name);
          }
          if (profile.phone && !this.customerPhone()) {
            this.customerPhone.set(toLocalPhoneNumber(profile.phone));
          }
        },
        error: () => {}
      });

      // Load saved addresses
      this.dashboardService.getAddresses().subscribe({
        next: (addrs) => {
          this.savedAddresses.set(addrs);
          const def = addrs.find((a) => a.isDefault) || addrs[0];
          if (def && !this.deliveryAddress()) {
            this.selectSavedAddress(def);
          }
        },
        error: () => {}
      });
    }
  }

  selectSavedAddress(addr: AddressDto): void {
    this.selectedSavedAddressId.set(addr.id);
    this.customerName.set(addr.fullName);
    this.customerPhone.set(toLocalPhoneNumber(addr.phone));
    const fullStreet = addr.addressLine1 + (addr.addressLine2 ? ', ' + addr.addressLine2 : '');
    this.deliveryAddress.set(fullStreet);
    // Resolve to a known country name so dial code matches (Pakistan → +92, etc.)
    const matched = COUNTRIES_DATA.find(
      (c) => c.name.toLowerCase() === (addr.country || '').trim().toLowerCase()
        || c.code.toLowerCase() === (addr.country || '').trim().toLowerCase()
    );
    this.selectedCountry.set(matched?.name || '');
    this.selectedDialCode.set(matched?.phoneCode || '');
    this.selectedState.set(addr.state || '');
    this.deliveryCity.set(addr.city);
    this.nameError.set(null);
    this.phoneError.set(null);
    this.addressError.set(null);
    this.cityError.set(null);
    this.countryError.set(null);
  }

  onCountryChange(countryName: string): void {
    this.selectedCountry.set(countryName);
    this.countryError.set(null);
    this.selectedState.set('');
    this.stateError.set(null);
    this.deliveryCity.set('');
    // Auto-fill dial code from country (user can still change it afterwards)
    const matched = COUNTRIES_DATA.find((c) => c.name === countryName);
    this.selectedDialCode.set(matched?.phoneCode || '');
  }

  /** User can freely change dial code (not locked to country). */
  onDialCodeChange(phoneCode: string): void {
    this.selectedDialCode.set(phoneCode);
    this.phoneError.set(null);
  }

  onStateChange(stateName: string): void {
    this.selectedState.set(stateName);
    this.stateError.set(null);
  }

  /** Autofill / paste may include +92 — keep only the local number in the input. */
  onPhoneInput(value: string): void {
    this.customerPhone.set(toLocalPhoneNumber(value));
    this.phoneError.set(null);
  }

  readonly availableSizes: string[] = ['Free Size', 'S', 'M', 'L', 'XL', 'XXL'];

  getItemSize(item: CartItem): string {
    if (!item.variantName) return 'Free Size';
    const match = item.variantName.match(/Size:\s*([^,]+)/i);
    if (match) return match[1].trim();
    return item.variantName;
  }

  onSizeChange(item: CartItem, newSize: string): void {
    let updatedVariant = item.variantName || '';
    if (updatedVariant.includes('Size:')) {
      updatedVariant = updatedVariant.replace(/Size:\s*[^,]+/i, `Size: ${newSize}`);
    } else if (updatedVariant) {
      updatedVariant = `${updatedVariant}, Size: ${newSize}`;
    } else {
      updatedVariant = `Size: ${newSize}`;
    }
    this.cartService.updateItemVariant(item.id, updatedVariant);
    this.showFeedback(`Updated size to "${newSize}" for ${item.name}`);
  }

  incrementQty(item: CartItem): void {
    this.cartService.updateQuantity(item.id, item.quantity + 1);
  }

  decrementQty(item: CartItem): void {
    if (item.quantity > 1) {
      this.cartService.updateQuantity(item.id, item.quantity - 1);
    } else {
      this.removeItem(item.id);
    }
  }

  readonly showClearModal = signal<boolean>(false);

  removeItem(itemId: string): void {
    this.cartService.removeItem(itemId);
    this.toastService.show('Item removed from cart.', 'info');
  }

  openClearModal(): void {
    this.showClearModal.set(true);
  }

  closeClearModal(): void {
    this.showClearModal.set(false);
  }

  confirmClearCart(): void {
    this.cartService.clearCart();
    this.showClearModal.set(false);
    this.toastService.show('Shopping cart cleared.', 'info');
  }

  finalizeOrderViaChat(): void {
    if (!this.authAction.requireLogin('checkout')) return;

    const items = this.cartService.items();
    if (items.length === 0) {
      this.orderError.set('Your cart is empty. Please add products to proceed.');
      return;
    }

    // Reset errors
    this.nameError.set(null);
    this.phoneError.set(null);
    this.addressError.set(null);
    this.countryError.set(null);
    this.stateError.set(null);
    this.cityError.set(null);
    this.orderError.set(null);

    let hasErrors = false;

    if (!this.customerName().trim()) {
      this.nameError.set('Please provide your full name for delivery.');
      hasErrors = true;
    }

    if (!this.customerPhone().trim() || this.customerPhone().trim().length < 7) {
      this.phoneError.set('Please enter a valid phone number (e.g. (555) 123-4567).');
      hasErrors = true;
    }

    if (!this.deliveryAddress().trim() || this.deliveryAddress().trim().length < 5) {
      this.addressError.set('Please enter complete street address, house #, or flat.');
      hasErrors = true;
    }

    if (!this.selectedCountry().trim()) {
      this.countryError.set('Please select your destination country.');
      hasErrors = true;
    }

    if (!this.selectedDialCode().trim()) {
      this.phoneError.set('Please select a country dial code.');
      hasErrors = true;
    }

    if (this.stateOptions().length > 0 && !this.selectedState().trim()) {
      this.stateError.set('Please select your state / province.');
      hasErrors = true;
    }

    if (!this.deliveryCity().trim()) {
      this.cityError.set('Please enter your city.');
      hasErrors = true;
    }

    if (hasErrors) {
      this.orderError.set('Please fill in all required delivery details to finalize your order.');
      if (typeof window !== 'undefined') {
        const el = document.getElementById('delivery-form-container');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    this.orderError.set(null);
    this.isSubmitting.set(true);

    const generatedRef = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const primaryShopId = items[0].shopId || '';
    const primaryShopName = items[0].shopName || 'Eseller Store';

    // Dial code is locked to selected country (e.g. Pakistan → +92 only) — not user-editable
    const rawPhone = toLocalPhoneNumber(this.customerPhone());
    const dialCode = this.selectedDialCode();
    const fullPhone = `${dialCode} ${rawPhone}`.trim();

    const orderPayload: CreateOrderRequest = {
      customerName: this.customerName().trim(),
      customerPhone: fullPhone,
      shippingAddress: this.deliveryAddress().trim(),
      city: this.deliveryCity().trim(),
      state: this.selectedState()?.trim() || '',
      country: this.selectedCountry()?.trim() || '',
      orderNotes: this.orderNotes().trim(),
      referralCode: null
    };

    const saveAndRedirect = (finalOrderRef: string, isApiCreated: boolean = false) => {
      const orderData = {
        orderRef: finalOrderRef,
        createdAt: new Date().toISOString(),
        shopId: primaryShopId,
        shopName: primaryShopName,
        customer: {
          fullName: this.customerName().trim(),
          phone: fullPhone,
          address: this.deliveryAddress().trim(),
          city: this.deliveryCity().trim(),
          state: this.selectedState()?.trim() || '',
          country: this.selectedCountry()?.trim() || '',
          province: this.selectedState()?.trim() || '',
          notes: this.orderNotes().trim()
        },
        items: items.map((item) => ({ ...item })),
        subtotal: this.cartService.subtotal(),
        shippingFee: this.cartService.shippingFee(),
        totalAmount: this.cartService.totalAmount(),
        status: 'PENDING_SELLER_CONFIRMATION'
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem('eseller_latest_order', JSON.stringify(orderData));
          const historyStr = window.localStorage.getItem('eseller_orders_history');
          const history = historyStr ? JSON.parse(historyStr) : [];
          window.localStorage.setItem(
            'eseller_orders_history',
            JSON.stringify([orderData, ...history.slice(0, 19)])
          );
        } catch {}
      }

      this.cartService.clearCart();
      this.isSubmitting.set(false);

      const displayRef = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalOrderRef)
        ? `ORD-${finalOrderRef.substring(0, 8).toUpperCase()}`
        : finalOrderRef;

      if (isApiCreated) {
        this.toastService.show(`Order placed! Reference: ${displayRef}. Opening Customer Support chat...`, 'success');
      } else {
        this.toastService.show(`Order ready. Opening Customer Support chat with your order template...`, 'success');
      }

      this.router.navigate(['/chat'], {
        queryParams: {
          support: '1',
          orderRef: finalOrderRef,
          autosend: '1'
        }
      });
    };

    if (this.authStore.isAuthenticated()) {
      const validGuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const guidItems = items.filter(
        (i) => i.variantId && validGuidRegex.test(i.variantId)
      );

      const executeCreateOrder = () => {
        this.orderService.createOrder(orderPayload).subscribe({
          next: (res) => {
            // Pass the real OrderRequest GUID so chat joins the seller order room
            const confirmedRef = res.orderId || generatedRef;
            saveAndRedirect(confirmedRef, !!res.orderId);
          },
          error: (err) => {
            this.isSubmitting.set(false);
            const msg =
              (typeof err?.error === 'string' ? err.error : null) ||
              err?.error?.error ||
              'Could not place your order. Please try again.';
            this.toastService.show(msg, 'error');
          }
        });
      };

      if (guidItems.length > 0) {
        let completed = 0;
        guidItems.forEach((item) => {
          this.orderService.syncCartItem(item.variantId!, item.quantity).subscribe({
            next: () => {
              completed++;
              if (completed === guidItems.length) {
                executeCreateOrder();
              }
            },
            error: () => {
              completed++;
              if (completed === guidItems.length) {
                executeCreateOrder();
              }
            }
          });
        });
      } else {
        executeCreateOrder();
      }
    } else {
      this.isSubmitting.set(false);
      this.toastService.show('Please sign in to place an order.', 'error');
    }
  }

  getImageUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const apiBase = typeof window !== 'undefined' ? ((window as any).__ESELLER_API_URL__ as string) : '';
    const host = apiBase ? apiBase.replace(/\/api\/v1\/?$/, '') : 'https://localhost:7127';
    const path = url.startsWith('/') ? url : `/${url}`;
    if (path.startsWith('/uploads/')) {
      return `${host}${path}`;
    }
    return `${host}/uploads${path}`;
  }

  private showFeedback(msg: string): void {
    this.toastService.show(msg, 'info');
  }
}
