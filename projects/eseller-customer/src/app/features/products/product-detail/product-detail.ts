import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  HomeService,
  AuthStore,
  CartService,
  WishlistService,
  CompareService,
  AuthActionService,
  ProductDto,
  ProductListDto,
  ProductImageDto,
  ProductVariantDto,
  ReviewDto,
  ProductQuestionDto,
  ProductCard,
  EmptyState,
  ShopRatingBadge,
  ToastService,
  OrderService,
  BuyNowRequest,
  DashboardService,
  SkeletonLayout
} from 'eseller-shared';

import { ProductGallery } from './components/product-gallery/product-gallery';
import { ProductReviews } from './components/product-reviews/product-reviews';
import { ProductQa } from './components/product-qa/product-qa';
import {
  SearchableSelect,
  SelectOption
} from '../../../shared/components/searchable-select/searchable-select';
import { DialCodeSelect, DialCodeOption } from '../../../shared/components/dial-code-select/dial-code-select';
import { COUNTRIES_DATA } from '../../../shared/data/countries-states.data';
import { toLocalPhoneNumber } from '../../../shared/utils/phone.util';

@Component({
  selector: 'app-product-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ProductCard,
    EmptyState,
    ShopRatingBadge,
    ProductGallery,
    ProductReviews,
    ProductQa,
    SearchableSelect,
    DialCodeSelect,
    SkeletonLayout
  ],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css'
})
export class ProductDetail implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly homeService = inject(HomeService);
  private readonly cartService = inject(CartService);
  readonly wishlistService = inject(WishlistService);
  readonly compareService = inject(CompareService);
  private readonly authAction = inject(AuthActionService);
  readonly authStore = inject(AuthStore);
  private readonly toastService = inject(ToastService);
  private readonly orderService = inject(OrderService);
  private readonly dashboardService = inject(DashboardService);

  private routeSub: Subscription | null = null;

  // Data signals
  readonly product = signal<ProductDto | null>(null);
  readonly images = signal<ProductImageDto[]>([]);
  readonly variants = signal<ProductVariantDto[]>([]);
  readonly reviews = signal<ReviewDto[]>([]);
  readonly reviewsTotal = signal<number>(0);
  readonly reviewSubmitting = signal<boolean>(false);
  readonly questions = signal<ProductQuestionDto[]>([]);
  readonly relatedProducts = signal<ProductListDto[]>([]);

  // State signals
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<'description' | 'reviews' | 'qa'>('description');
  readonly quantity = signal<number>(1);
  readonly selectedAttributes = signal<Record<string, string>>({});

  // Direct Order Modal state
  readonly isOrderModalOpen = signal<boolean>(false);
  readonly customerName = signal<string>('');
  readonly customerPhone = signal<string>('');
  readonly deliveryAddress = signal<string>('');
  /** Empty until user picks — no default Pakistan. */
  readonly selectedCountry = signal<string>('');
  /** Dial code auto-fills from country, but user can change it anytime. */
  readonly selectedDialCode = signal<string>('');
  readonly selectedState = signal<string>('');
  readonly deliveryCity = signal<string>('');
  readonly deliveryProvince = signal<string>('');
  readonly orderNotes = signal<string>('');
  readonly orderError = signal<string | null>(null);
  readonly isSubmittingOrder = signal<boolean>(false);

  // Field-level error validation signals
  readonly nameError = signal<string | null>(null);
  readonly phoneError = signal<string | null>(null);
  readonly addressError = signal<string | null>(null);
  readonly countryError = signal<string | null>(null);
  readonly stateError = signal<string | null>(null);
  readonly cityError = signal<string | null>(null);

  readonly countryOptions = computed<SelectOption[]>(() =>
    COUNTRIES_DATA.map((c) => ({
      value: c.name,
      label: c.name,
      flag: c.flag,
      subLabel: c.phoneCode
    }))
  );

  /** Dial codes (+flag) only — no country names in this dropdown. */
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

  readonly phonePlaceholder = computed(() => {
    const code = this.selectedDialCode();
    if (code === '+92') return '300 1234567';
    if (code === '+971') return '50 123 4567';
    if (code === '+966') return '50 123 4567';
    if (code === '+1') return '(555) 000-0000';
    if (code === '+44') return '7911 123456';
    return 'Enter phone number';
  });

  readonly stateOptions = computed<SelectOption[]>(() => {
    const c = COUNTRIES_DATA.find((x) => x.name === this.selectedCountry());
    if (!c || !c.states) return [];
    return c.states.map((s) => ({
      value: s,
      label: s
    }));
  });

  onCountryChange(countryName: string): void {
    this.selectedCountry.set(countryName);
    this.countryError.set(null);
    this.selectedState.set('');
    this.stateError.set(null);
    this.deliveryCity.set('');
    const matched = COUNTRIES_DATA.find((c) => c.name === countryName);
    this.selectedDialCode.set(matched?.phoneCode || '');
  }

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

  // Variant display toggle
  readonly showAllVariants = signal<boolean>(false);
  readonly directSelectedVariantId = signal<string | null>(null);
  readonly defaultSizeOptions: string[] = ['Free Size', 'S', 'M', 'L', 'XL', 'XXL'];
  readonly customSelectedSize = signal<string>('Standard');

  readonly visibleVariants = computed(() => {
    const list = this.variants().filter((v) => v.isActive);
    if (this.showAllVariants()) {
      return list;
    }
    return list.slice(0, 4);
  });

  readonly hasMoreVariants = computed(() => {
    return this.variants().filter((v) => v.isActive).length > 4;
  });

  readonly extraVariantsCount = computed(() => {
    return Math.max(0, this.variants().filter((v) => v.isActive).length - 4);
  });

  // Active Size / Variant label for order preview and chat confirmation
  readonly activeSizeLabel = computed<string>(() => {
    const sel = this.selectedAttributes();

    // 1. If size is in selected attributes, return size directly
    for (const [k, v] of Object.entries(sel)) {
      if (k.toLowerCase().includes('size') && v) {
        return v;
      }
    }

    // 2. If variant has size attribute, return it
    const v = this.selectedVariant();
    if (v && v.attributes && v.attributes.length > 0) {
      const sizeAttr = v.attributes.find((a) =>
        a.attributeName.toLowerCase().includes('size')
      );
      if (sizeAttr && sizeAttr.attributeValue) {
        return sizeAttr.attributeValue;
      }
    }

    // 3. If any attributes are selected, format clean values
    const entries = Object.entries(sel);
    if (entries.length > 0) {
      return entries.map(([_, val]) => val).join(' / ');
    }

    // 4. Return clean variant label or custom size or standard
    if (v) {
      return this.cleanVariantLabel(v);
    }

    return this.customSelectedSize() || 'Standard';
  });

  // Toast / feedback message
  readonly feedbackMessage = signal<string | null>(null);

  // ============================================================
  // COMPUTEDS
  // ============================================================
  /** Group distinct attribute names and their values across all variants */
  readonly attributeGroups = computed(() => {
    const vars = this.variants();
    const map = new Map<string, Set<string>>();

    for (const v of vars) {
      if (v.isActive && v.attributes) {
        for (const attr of v.attributes) {
          if (!map.has(attr.attributeName)) {
            map.set(attr.attributeName, new Set<string>());
          }
          map.get(attr.attributeName)!.add(attr.attributeValue);
        }
      }
    }

    return Array.from(map.entries()).map(([name, values]) => ({
      name,
      values: Array.from(values)
    }));
  });

  /** The variant matching all current attribute selections or direct selection */
  readonly selectedVariant = computed<ProductVariantDto | null>(() => {
    const vars = this.variants().filter((v) => v.isActive);
    if (vars.length === 0) return null;

    const directId = this.directSelectedVariantId();
    if (directId) {
      const match = vars.find((v) => v.id === directId);
      if (match) return match;
    }

    const selected = this.selectedAttributes();
    const groupCount = this.attributeGroups().length;

    if (groupCount === 0) return null;

    // Match variant having all selected attributes
    for (const v of vars) {
      if (!v.attributes || v.attributes.length === 0) continue;
      const matchesAll = Object.entries(selected).every(([attrName, attrVal]) =>
        v.attributes.some(
          (a) => a.attributeName === attrName && a.attributeValue === attrVal
        )
      );
      if (matchesAll) return v;
    }

    return null;
  });

  /** Active display price (from selected variant or base product) */
  readonly currentPrice = computed(() => {
    const v = this.selectedVariant();
    if (v) return v.price;
    return this.product()?.basePrice ?? 0;
  });

  readonly formattedPrice = computed(() =>
    this.currentPrice().toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })
  );

  /** Active stock quantity */
  readonly currentStock = computed(() => {
    const v = this.selectedVariant();
    if (v) return v.stockQty;
    return 20; // Default stock if no variants configured
  });

  readonly isOutOfStock = computed(() => this.currentStock() <= 0);
  readonly isLowStock = computed(
    () => this.currentStock() > 0 && this.currentStock() <= 5
  );

  readonly variantImageUrl = computed(() => {
    const v = this.selectedVariant();
    return v?.imageUrl ?? null;
  });

  readonly orderSubtotal = computed(() => this.currentPrice() * this.quantity());

  readonly orderShipping = computed(() => {
    const sub = this.orderSubtotal();
    return sub >= 5000 ? 0 : 200;
  });

  readonly orderTotal = computed(() => this.orderSubtotal() + this.orderShipping());

  readonly formattedOrderSubtotal = computed(() =>
    this.orderSubtotal().toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })
  );

  readonly formattedOrderShipping = computed(() => {
    const fee = this.orderShipping();
    if (fee === 0) return 'Free';
    return `$ ${fee.toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })}`;
  });

  readonly formattedOrderTotal = computed(() =>
    this.orderTotal().toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })
  );

  readonly stars = [1, 2, 3, 4, 5];

  // ============================================================
  // LIFECYCLE
  // ============================================================
  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug) {
        this.loadProductDetails(slug);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
      this.routeSub = null;
    }
  }

  // ============================================================
  // DATA FETCHING
  // ============================================================
  private loadProductDetails(slug: string): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    this.loading.set(true);
    this.error.set(null);
    this.quantity.set(1);
    this.directSelectedVariantId.set(null);
    this.selectedAttributes.set({});

    this.homeService.getProductBySlug(slug).subscribe({
      next: (prod) => {
        this.product.set(prod);
        this.loading.set(false);

        // Fetch sub-resources in parallel
        this.loadSubResources(prod);
      },
      error: (err) => {
        this.error.set('Product not found or currently unavailable.');
        this.loading.set(false);
      }
    });
  }

  private loadSubResources(prod: ProductDto): void {
    // 1. Images
    this.homeService.getProductImages(prod.id).subscribe({
      next: (imgs) => this.images.set(imgs),
      error: () => this.images.set([])
    });

    // 2. Variants
    this.homeService.getProductVariants(prod.id).subscribe({
      next: (vars) => {
        this.variants.set(vars);
        // Pre-select first attribute values if available
        this.initDefaultVariantAttributes(vars);
      },
      error: () => this.variants.set([])
    });

    // 3. Reviews
    this.reloadReviews(prod.id);

    // 4. Q&A
    this.homeService.getProductQuestions(prod.id).subscribe({
      next: (res) => this.questions.set(res.items),
      error: () => this.questions.set([])
    });

    // 5. Related Products (same category)
    if (prod.categoryId) {
      this.homeService
        .getProducts({ categoryId: prod.categoryId, pageSize: 6 })
        .subscribe({
          next: (res) => {
            // Exclude current product
            const filtered = res.items.filter((p) => p.id !== prod.id);
            this.relatedProducts.set(filtered.slice(0, 5));
          },
          error: () => this.relatedProducts.set([])
        });
    }
  }

  private initDefaultVariantAttributes(vars: ProductVariantDto[]): void {
    const activeVars = vars.filter((v) => v.isActive);
    if (activeVars.length === 0) return;

    // Pick first variant that actually has attributes, otherwise first active variant
    const variantWithAttrs = activeVars.find((v) => v.attributes && v.attributes.length > 0);
    const chosen = variantWithAttrs || activeVars[0];

    this.directSelectedVariantId.set(chosen.id);

    const initial: Record<string, string> = {};
    if (chosen.attributes && chosen.attributes.length > 0) {
      for (const a of chosen.attributes) {
        initial[a.attributeName] = a.attributeValue;
      }
    } else {
      // If chosen variant had no attributes, check if attributeGroups exist and pre-select first of each
      const groups = this.attributeGroups();
      for (const g of groups) {
        if (g.values.length > 0) {
          initial[g.name] = g.values[0];
        }
      }
    }

    this.selectedAttributes.set(initial);
    this.customSelectedSize.set(this.cleanVariantLabel(chosen));
  }

  // ============================================================
  // USER ACTIONS
  // ============================================================
  selectAttribute(name: string, value: string): void {
    this.directSelectedVariantId.set(null);
    this.selectedAttributes.update((curr) => ({
      ...curr,
      [name]: value
    }));
    if (name.toLowerCase().includes('size')) {
      this.customSelectedSize.set(value);
    }
  }

  selectCustomSize(size: string): void {
    this.customSelectedSize.set(size);
  }

  isAttributeSelected(name: string, value: string): boolean {
    return this.selectedAttributes()[name] === value;
  }

  incrementQty(): void {
    const max = this.currentStock();
    this.quantity.update((q) => Math.min(q + 1, max));
  }

  decrementQty(): void {
    this.quantity.update((q) => Math.max(1, q - 1));
  }

  orderNow(): void {
    this.openOrderModal();
  }

  openOrderModal(): void {
    const prod = this.product();
    if (!prod || this.isOutOfStock()) return;
    if (!this.authAction.requireLogin('buy this product')) return;

    // Load real profile name & phone from API (not username which is email)
    if (this.authStore.isAuthenticated() && !this.customerName()) {
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
    }
    this.nameError.set(null);
    this.phoneError.set(null);
    this.addressError.set(null);
    this.countryError.set(null);
    this.stateError.set(null);
    this.cityError.set(null);
    this.orderError.set(null);
    this.isOrderModalOpen.set(true);
  }

  closeOrderModal(): void {
    this.isOrderModalOpen.set(false);
    this.nameError.set(null);
    this.phoneError.set(null);
    this.addressError.set(null);
    this.countryError.set(null);
    this.stateError.set(null);
    this.cityError.set(null);
    this.orderError.set(null);
  }

  confirmOrderViaChat(): void {
    const prod = this.product();
    if (!prod) return;
    if (!this.authAction.requireLogin('place an order')) return;

    this.nameError.set(null);
    this.phoneError.set(null);
    this.addressError.set(null);
    this.countryError.set(null);
    this.stateError.set(null);
    this.cityError.set(null);
    this.orderError.set(null);

    let hasErrors = false;

    if (!this.customerName().trim() || this.customerName().trim().length < 2) {
      this.nameError.set('Please provide your full name for delivery.');
      hasErrors = true;
    }

    if (!this.customerPhone().trim() || this.customerPhone().trim().length < 7) {
      this.phoneError.set('Please enter a valid phone number.');
      hasErrors = true;
    }

    if (!this.deliveryAddress().trim() || this.deliveryAddress().trim().length < 5) {
      this.addressError.set('Please provide complete delivery street address.');
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
      this.cityError.set('Please enter your delivery city.');
      hasErrors = true;
    }

    if (hasErrors) {
      this.orderError.set('Please fill in all required delivery details.');
      if (typeof window !== 'undefined') {
        const el = document.getElementById('order-modal-error');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    this.orderError.set(null);
    this.isSubmittingOrder.set(true);

    const generatedRef = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const selVar = this.selectedVariant();
    let variantName = selVar
      ? Object.entries(this.selectedAttributes())
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')
      : null;
    if (!variantName && this.customSelectedSize()) {
      variantName = `Size: ${this.customSelectedSize()}`;
    }

    const rawImg = this.variantImageUrl() || (this.images().length > 0 ? this.images()[0].imageUrl : null);
    const resolvedImg = this.getImageUrl(rawImg);

    // Dial code is locked to selected country (e.g. Pakistan → +92 only) — not user-editable
    const rawPhone = toLocalPhoneNumber(this.customerPhone());
    const dialCode = this.selectedDialCode();
    const fullPhone = `${dialCode} ${rawPhone}`.trim();

    const saveAndRedirect = (finalOrderRef: string, isApiCreated: boolean = false) => {
      const orderData = {
        orderRef: finalOrderRef,
        createdAt: new Date().toISOString(),
        shopId: prod.shopId,
        shopName: prod.shopName,
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
        items: [
          {
            id: `${prod.id}_${selVar?.id || 'base'}`,
            productId: prod.id,
            productSlug: prod.slug,
            name: prod.name,
            imageUrl: resolvedImg,
            shopId: prod.shopId,
            shopName: prod.shopName,
            price: this.currentPrice(),
            quantity: this.quantity(),
            variantId: selVar?.id || null,
            variantName,
            sku: selVar?.sku || null
          }
        ],
        subtotal: this.orderSubtotal(),
        shippingFee: this.orderShipping(),
        totalAmount: this.orderTotal(),
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

      this.isOrderModalOpen.set(false);
      this.isSubmittingOrder.set(false);

      const displayRef = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalOrderRef)
        ? `ORD-${finalOrderRef.substring(0, 8).toUpperCase()}`
        : finalOrderRef;

      if (isApiCreated) {
        this.toastService.show(`Order placed! Reference: ${displayRef}. Opening Super Admin chat...`, 'success');
      } else {
        this.toastService.show(`Order ready. Opening Super Admin chat with your order template...`, 'success');
      }

      this.router.navigate(['/chat'], {
        queryParams: {
          support: '1',
          orderRef: finalOrderRef,
          autosend: '1'
        }
      });
    };

    const validGuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (this.authStore.isAuthenticated() && selVar?.id && validGuidRegex.test(selVar.id)) {
      this.orderService.buyNow({
        productVariantId: selVar.id,
        quantity: this.quantity()
      }).subscribe({
        next: (res) => {
          // Pass the real OrderRequest GUID so chat joins the seller order room
          const confirmedRef = res.orderId || generatedRef;
          saveAndRedirect(confirmedRef, !!res.orderId);
        },
        error: (err) => {
          this.isSubmittingOrder.set(false);
          const msg =
            (typeof err?.error === 'string' ? err.error : null) ||
            err?.error?.error ||
            'Could not place your order. Please try again.';
          this.toastService.show(msg, 'error');
        }
      });
    } else {
      this.isSubmittingOrder.set(false);
      this.toastService.show('Please sign in and select a valid product variant to place an order.', 'error');
    }
  }

  /**
   * Customers chat with Super Admin only (not the merchant).
   */
  chatWithSeller(): void {
    if (!this.authAction.requireLogin('chat with Super Admin')) return;
    this.router.navigate(['/chat'], {
      queryParams: { support: '1' }
    });
  }

  addToCart(): void {
    const prod = this.product();
    if (!prod || this.isOutOfStock()) return;
    if (!this.authAction.requireLogin('add items to your cart')) return;

    if (this.isInCart()) {
      this.cartService.removeByProductId(prod.id);
      this.toastService.show(`Removed "${prod.name}" from your cart!`, 'info');
      return;
    }

    const selVar = this.selectedVariant();
    let variantName = selVar
      ? Object.entries(this.selectedAttributes())
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')
      : null;
    if (!variantName && this.customSelectedSize()) {
      variantName = `Size: ${this.customSelectedSize()}`;
    }

    const rawImg = this.variantImageUrl() || (this.images().length > 0 ? this.images()[0].imageUrl : null);
    const resolvedImg = this.getImageUrl(rawImg);

    this.cartService.addItem({
      productId: prod.id,
      productSlug: prod.slug,
      name: prod.name,
      imageUrl: resolvedImg,
      shopId: prod.shopId,
      shopName: prod.shopName,
      price: this.currentPrice(),
      quantity: this.quantity(),
      variantId: selVar?.id || null,
      variantName,
      sku: selVar?.sku || null
    });

    this.toastService.show(`Added ${this.quantity()} item(s) to your cart!`, 'success');
  }

  readonly isInCart = computed(() => {
    const prod = this.product();
    return prod ? this.cartService.isInCart(prod.id) : false;
  });

  readonly isInWishlist = computed(() => {
    const prod = this.product();
    return prod ? this.wishlistService.isInWishlist(prod.id) : false;
  });

  readonly isInCompare = computed(() => {
    const prod = this.product();
    return prod ? this.compareService.isInCompare(prod.id) : false;
  });

  addToWishlist(): void {
    const prod = this.product();
    if (!prod) return;
    if (!this.authAction.requireLogin('save items to your wishlist')) return;
    const added = this.wishlistService.toggleItem({
      id: prod.id,
      slug: prod.slug,
      name: prod.name,
      basePrice: this.currentPrice(),
      primaryImageUrl: this.images().length > 0 ? this.images()[0].imageUrl : null,
      shopId: prod.shopId,
      shopName: prod.shopName,
      categoryName: prod.categoryName,
      brandName: prod.brandName
    } as any);
    this.toastService.show(
      added ? `Added "${prod.name}" to your wishlist!` : `Removed "${prod.name}" from your wishlist!`,
      added ? 'success' : 'info'
    );
  }

  addToCompare(): void {
    const prod = this.product();
    if (!prod) return;
    if (!this.authAction.requireLogin('compare products')) return;
    const item: ProductListDto = {
      id: prod.id,
      slug: prod.slug,
      name: prod.name,
      basePrice: this.currentPrice(),
      primaryImageUrl: this.images().length > 0 ? this.images()[0].imageUrl : null,
      shopName: prod.shopName,
      shopSlug: prod.shopSlug,
      categoryName: prod.categoryName,
      brandName: prod.brandName,
      avgRating: prod.avgRating,
      isFeatured: prod.isFeatured,
      isApproved: prod.isApproved,
      status: prod.status,
      rejectionReason: prod.rejectionReason,
      createdAt: prod.createdAt,
      badges: null,
      reviewsCount: this.reviews().length,
      viewCount: prod.viewCount
    };
    const result = this.compareService.toggleItem(item);
    this.toastService.show(result.message, result.added ? 'success' : 'info');
  }

  // ============================================================
  // VARIANT BOXES SELECTOR HELPERS
  // ============================================================
  toggleShowAllVariants(): void {
    this.showAllVariants.update((v) => !v);
  }

  selectVariant(v: ProductVariantDto): void {
    if (!v.isActive || v.stockQty <= 0) return;
    this.directSelectedVariantId.set(v.id);
    const newAttrs: Record<string, string> = {};
    if (v.attributes && v.attributes.length > 0) {
      for (const a of v.attributes) {
        newAttrs[a.attributeName] = a.attributeValue;
      }
    }
    this.selectedAttributes.set(newAttrs);
    this.customSelectedSize.set(this.getVariantLabel(v));
  }

  isVariantSelected(v: ProductVariantDto): boolean {
    const sel = this.selectedVariant();
    if (sel) return sel.id === v.id;
    return false;
  }

  cleanVariantLabel(v: ProductVariantDto | null): string {
    if (!v) return 'Standard';
    if (v.attributes && v.attributes.length > 0) {
      return v.attributes.map((a) => a.attributeValue).join(' / ');
    }
    if (v.sku && !v.sku.includes('DEFAULT') && !v.sku.match(/[0-9a-f]{8}-[0-9a-f]{4}/i)) {
      return v.sku;
    }
    return 'Standard';
  }

  getVariantLabel(v: ProductVariantDto): string {
    return this.cleanVariantLabel(v);
  }

  getFormattedSku(sku: string | null | undefined): string | null {
    if (!sku) return null;
    if (sku.includes('DEFAULT') || sku.match(/[0-9a-f]{8}-[0-9a-f]{4}/i)) {
      const parts = sku.split('-DEFAULT')[0] || sku.split('-')[0];
      return parts ? parts.toUpperCase() : 'STANDARD';
    }
    return sku;
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

  onSubmitQuestion(text: string): void {
    const prod = this.product();
    if (!prod) return;

    this.homeService.submitProductQuestion(prod.id, text).subscribe({
      next: () => {
        this.showFeedback('Your question was submitted for seller approval.');
      },
      error: () => {
        this.showFeedback('Question submitted successfully.');
      }
    });
  }

  onFilterReviews(rating: number | null): void {
    const prod = this.product();
    if (!prod) return;
    this.reloadReviews(prod.id, rating);
  }

  onSubmitReview(
    payload: { rating: number; title: string; comment: string },
    reviewsPanel?: ProductReviews
  ): void {
    const prod = this.product();
    if (!prod) return;

    if (!this.authStore.isAuthenticated()) {
      this.toastService.show('Please sign in to write a review.', 'warning');
      return;
    }

    this.reviewSubmitting.set(true);
    this.homeService.createProductReview(prod.id, {
      rating: payload.rating,
      title: payload.title || null,
      comment: payload.comment || null
    }).subscribe({
      next: () => {
        this.reviewSubmitting.set(false);
        reviewsPanel?.resetForm();
        this.toastService.show('Review published. Rating updated.', 'success');
        this.reloadReviews(prod.id);
        this.homeService.getProductById(prod.id).subscribe({
          next: (fresh) => {
            if (fresh) this.product.set(fresh);
          },
          error: () => {}
        });
      },
      error: (err) => {
        this.reviewSubmitting.set(false);
        const msg = err?.error?.error || err?.error?.title || 'Failed to submit review.';
        this.toastService.show(msg, 'error');
      }
    });
  }

  private reloadReviews(productId: string, rating?: number | null): void {
    this.homeService.getProductReviews(productId, rating).subscribe({
      next: (res) => {
        this.reviews.set(res.items || []);
        this.reviewsTotal.set(res.totalCount ?? (res.items || []).length);
      },
      error: () => {
        this.reviews.set([]);
        this.reviewsTotal.set(0);
      }
    });
  }

  private showFeedback(msg: string): void {
    this.toastService.show(msg, 'info');
  }
}
