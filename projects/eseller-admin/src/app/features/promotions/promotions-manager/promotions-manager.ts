import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminCouponDto, AdminFlashSaleDto, AdminBannerDto, AdminPaymentLogoDto } from '../../../core/models/admin.models';
import { environment } from '../../../../environments/environment';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';

type PromoTab = 'coupons' | 'flash-sales' | 'banners' | 'payment-logos';

@Component({
  selector: 'app-promotions-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModal],
  templateUrl: './promotions-manager.html'
})
export class PromotionsManager implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly activeTab = signal<PromoTab>('coupons');
  readonly deleteConfirmOpen = signal(false);
  readonly deleteConfirmTitle = signal('Delete item?');
  readonly deleteConfirmMessage = signal('This action cannot be undone.');
  readonly deleteConfirmHighlight = signal('');
  readonly deleteConfirmBusy = signal(false);
  private deleteConfirmAction: (() => void) | null = null;

  readonly coupons = signal<AdminCouponDto[]>([]);
  readonly flashSales = signal<AdminFlashSaleDto[]>([]);
  readonly banners = signal<AdminBannerDto[]>([]);
  readonly paymentLogos = signal<AdminPaymentLogoDto[]>([]);

  // Modal State for Coupon
  readonly couponModalOpen = signal<boolean>(false);
  readonly cCode = signal<string>('');
  readonly cDiscountType = signal<'Percentage' | 'Fixed'>('Percentage');
  readonly cValue = signal<number>(10);
  readonly cMinOrder = signal<number>(50);
  readonly cExpiresAt = signal<string>('');

  // Modal State for Flash Sale
  readonly flashModalOpen = signal<boolean>(false);
  readonly fTitle = signal<string>('');
  readonly fDiscountPercentage = signal<number>(20);
  readonly fStartDate = signal<string>('');
  readonly fEndDate = signal<string>('');
  readonly flashCatalog = signal<Array<{ id: string; name: string }>>([]);
  readonly selectedFlashProductIds = signal<string[]>([]);
  readonly flashCatalogLoading = signal(false);

  // Modal State for Banner (Management Full Control & Pinterest 3D Hero)
  readonly bannerModalOpen = signal<boolean>(false);
  readonly editingBannerId = signal<string | null>(null);
  readonly bTitle = signal<string>('');
  readonly bSubtitle = signal<string>('');
  readonly bDescription = signal<string>('');
  readonly bImageUrl = signal<string>('');
  readonly bLinkUrl = signal<string>('');
  readonly bPrice = signal<number | null>(null);
  readonly bOriginalPrice = signal<number | null>(null);
  readonly bButtonText = signal<string>('Get the look >');
  readonly bBackgroundColor = signal<string>('from-[#ea580c] via-[#c2410c] to-[#431407]');
  readonly bTextColor = signal<'light' | 'dark' | 'auto'>('auto');
  readonly bAvailableSizes = signal<string>('36, 38, 40');
  readonly bSortOrder = signal<number>(1);
  readonly bIsActive = signal<boolean>(true);
  readonly isUploadingBanner = signal<boolean>(false);
  readonly isSavingBanner = signal<boolean>(false);
  readonly busyBannerId = signal<string | null>(null);

  // Delete confirm modal (no browser alert)
  readonly deleteModalOpen = signal(false);
  readonly bannerToDelete = signal<AdminBannerDto | null>(null);
  readonly isDeletingBanner = signal(false);

  // Payment logo showcase (homepage marquee)
  readonly paymentLogoModalOpen = signal(false);
  readonly editingPaymentLogoId = signal<string | null>(null);
  readonly pName = signal('');
  readonly pImageUrl = signal('');
  readonly pSortOrder = signal(1);
  readonly pIsActive = signal(true);
  readonly isUploadingPaymentLogo = signal(false);
  readonly isSavingPaymentLogo = signal(false);
  readonly busyPaymentLogoId = signal<string | null>(null);

  private readonly bannerDraftKey = 'eseller.admin.bannerDraft';

  readonly bgPresets = [
    { label: 'Amber & Sunset (Platform Theme)', value: 'from-[#ea580c] via-[#c2410c] to-[#431407]', text: 'light' as const },
    { label: 'Pure White & Minimal (Light Theme)', value: 'from-[#ffffff] via-[#f8fafc] to-[#e2e8f0]', text: 'dark' as const },
    { label: 'Midnight Obsidian (Dark Stealth)', value: 'from-[#334155] via-[#1e293b] to-[#0f172a]', text: 'light' as const },
    { label: 'Soft Cashmere Cream (Light Theme)', value: 'from-[#fef3c7] via-[#fde68a] to-[#f59e0b]', text: 'dark' as const },
    { label: 'Arctic Mist Silver (Light Theme)', value: 'from-[#f1f5f9] via-[#e2e8f0] to-[#cbd5e1]', text: 'dark' as const },
    { label: 'Royal Velvet Violet (Dark Theme)', value: 'from-[#581c87] via-[#3b0764] to-[#1e1b4b]', text: 'light' as const },
    { label: 'Emerald Deep Forest (Dark Theme)', value: 'from-[#065f46] via-[#064e3b] to-[#022c22]', text: 'light' as const }
  ];

  selectBgPreset(preset: { label: string; value: string; text: 'light' | 'dark' }): void {
    this.bBackgroundColor.set(preset.value);
    this.bTextColor.set(preset.text);
    this.persistBannerDraft();
  }

  getBackgroundStyle(raw?: string | null): string {
    if (!raw) {
      return 'linear-gradient(135deg, #ea580c 0%, #c2410c 50%, #431407 100%)';
    }
    const val = raw.trim();
    if (val.startsWith('linear-gradient') || val.startsWith('radial-gradient') || val.startsWith('#') || val.startsWith('rgb')) {
      return val;
    }
    const hexMatches = val.match(/#(?:[0-9a-fA-F]{3,8})/g);
    if (hexMatches && hexMatches.length >= 2) {
      if (hexMatches.length === 2) {
        return `linear-gradient(135deg, ${hexMatches[0]} 0%, ${hexMatches[1]} 100%)`;
      }
      return `linear-gradient(135deg, ${hexMatches[0]} 0%, ${hexMatches[1]} 50%, ${hexMatches[2]} 100%)`;
    }
    if (val.includes('white') || val.includes('f8fafc') || val.includes('f1f5f9')) {
      return 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 50%, #e2e8f0 100%)';
    }
    if (val.includes('cream') || val.includes('cashmere') || val.includes('fef3c7')) {
      return 'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #f59e0b 100%)';
    }
    if (val.includes('334155') || val.includes('1e293b') || val.includes('0f172a') || val.includes('obsidian') || val.includes('midnight') || val.includes('black')) {
      return 'linear-gradient(135deg, #334155 0%, #1e293b 50%, #0f172a 100%)';
    }
    if (val.includes('ea580c') || val.includes('c2410c') || val.includes('431407') || val.includes('orange') || val.includes('amber')) {
      return 'linear-gradient(135deg, #ea580c 0%, #c2410c 50%, #431407 100%)';
    }
    if (val.includes('581c87') || val.includes('violet') || val.includes('purple')) {
      return 'linear-gradient(135deg, #581c87 0%, #3b0764 50%, #1e1b4b 100%)';
    }
    if (val.includes('065f46') || val.includes('emerald') || val.includes('forest')) {
      return 'linear-gradient(135deg, #065f46 0%, #064e3b 50%, #022c22 100%)';
    }
    return val;
  }

  readonly isModalDarkText = computed(() => {
    return this.isDarkText(this.bTextColor(), this.bBackgroundColor());
  });

  isDarkText(textColor?: string | null, bg?: string | null): boolean {
    if (textColor === 'dark') return true;
    if (textColor === 'light') return false;
    const bgStyle = this.getBackgroundStyle(bg).toLowerCase();
    const hexMatches = bgStyle.match(/#(?:[0-9a-fA-F]{6})/g);
    if (hexMatches && hexMatches.length > 0) {
      let totalLuminance = 0;
      for (const hex of hexMatches) {
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b;
      }
      return (totalLuminance / hexMatches.length) > 140;
    }
    return (
      bgStyle.includes('ffffff') ||
      bgStyle.includes('f8fafc') ||
      bgStyle.includes('fde68a') ||
      bgStyle.includes('fef3c7') ||
      bgStyle.includes('f1f5f9') ||
      bgStyle.includes('white') ||
      bgStyle.includes('cream')
    );
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);

    this.adminService.getCoupons().subscribe({
      next: (data) => this.coupons.set(data || []),
      error: () => {}
    });

    this.adminService.getFlashSales().subscribe({
      next: (data) => this.flashSales.set(data || []),
      error: () => {}
    });

    this.adminService.getBanners().subscribe({
      next: (data) => {
        const sorted = (data || []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        this.banners.set(sorted);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });

    this.adminService.getPaymentLogos().subscribe({
      next: (data) => {
        const sorted = (data || []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        this.paymentLogos.set(sorted);
      },
      error: () => {}
    });
  }

  // --- COUPON ACTIONS ---
  openCouponModal(): void {
    this.cCode.set('');
    this.cDiscountType.set('Percentage');
    this.cValue.set(10);
    this.cMinOrder.set(50);
    this.cExpiresAt.set('');
    this.couponModalOpen.set(true);
  }

  saveCoupon(): void {
    const code = this.cCode().trim().toUpperCase();
    if (!code) {
      this.toast.show('Coupon code is required', 'error');
      return;
    }

    this.adminService.createCoupon({
      code,
      discountType: this.cDiscountType(),
      value: this.cValue(),
      minOrderAmount: this.cMinOrder(),
      expiresAt: this.cExpiresAt() || undefined
    }).subscribe({
      next: () => {
        this.toast.show(`Coupon "${code}" created`, 'success');
        this.couponModalOpen.set(false);
        this.loadData();
      },
      error: (err) => {
        this.toast.show(err?.error?.error || 'Failed to create coupon', 'error');
      }
    });
  }

  private askDelete(title: string, message: string, highlight: string, action: () => void): void {
    this.deleteConfirmTitle.set(title);
    this.deleteConfirmMessage.set(message);
    this.deleteConfirmHighlight.set(highlight);
    this.deleteConfirmAction = action;
    this.deleteConfirmBusy.set(false);
    this.deleteConfirmOpen.set(true);
  }

  cancelDeleteConfirm(): void {
    if (this.deleteConfirmBusy()) return;
    this.deleteConfirmOpen.set(false);
    this.deleteConfirmAction = null;
  }

  runDeleteConfirm(): void {
    const action = this.deleteConfirmAction;
    if (!action) return;
    this.deleteConfirmBusy.set(true);
    action();
  }

  deleteCoupon(coupon: AdminCouponDto): void {
    this.askDelete(
      'Delete coupon?',
      'This coupon will be removed permanently.',
      coupon.code,
      () => {
        this.adminService.deleteCoupon(coupon.id).subscribe({
          next: () => {
            this.deleteConfirmBusy.set(false);
            this.deleteConfirmOpen.set(false);
            this.toast.show(`Coupon deleted`, 'info');
            this.loadData();
          },
          error: (err) => {
            this.deleteConfirmBusy.set(false);
            this.toast.show(err?.error?.error || 'Failed to delete coupon', 'error');
          }
        });
      }
    );
  }

  // --- FLASH SALE ACTIONS ---
  openFlashModal(): void {
    this.fTitle.set('');
    this.fDiscountPercentage.set(20);
    this.fStartDate.set('');
    this.fEndDate.set('');
    this.selectedFlashProductIds.set([]);
    this.flashModalOpen.set(true);
    this.flashCatalogLoading.set(true);
    this.adminService.getHomepageProducts('all', 1, 100).subscribe({
      next: (res) => {
        this.flashCatalog.set((res?.items || []).map((p: any) => ({
          id: String(p.id),
          name: p.name || 'Product'
        })));
        this.flashCatalogLoading.set(false);
      },
      error: () => {
        this.flashCatalog.set([]);
        this.flashCatalogLoading.set(false);
      }
    });
  }

  toggleFlashProduct(productId: string): void {
    const cur = this.selectedFlashProductIds();
    if (cur.includes(productId)) {
      this.selectedFlashProductIds.set(cur.filter(id => id !== productId));
    } else {
      this.selectedFlashProductIds.set([...cur, productId]);
    }
  }

  saveFlashSale(): void {
    const title = this.fTitle().trim();
    if (!title) {
      this.toast.show('Campaign title is required', 'error');
      return;
    }
    const productIds = this.selectedFlashProductIds();
    if (productIds.length === 0) {
      this.toast.show('Select at least one catalog product for the flash sale.', 'error');
      return;
    }

    const discount = Number(this.fDiscountPercentage()) || 10;
    this.adminService.createFlashSale({
      name: title,
      startDate: this.fStartDate() || new Date().toISOString(),
      endDate: this.fEndDate() || new Date(Date.now() + 86400000 * 3).toISOString(),
      products: productIds.map(productId => ({
        productId,
        discountType: 1, // Percentage
        discountValue: discount
      }))
    }).subscribe({
      next: () => {
        this.toast.show(`Flash Sale created`, 'success');
        this.flashModalOpen.set(false);
        this.loadData();
      },
      error: (err) => this.toast.show(err?.error?.error || 'Failed to create campaign', 'error')
    });
  }

  // --- BANNER ACTIONS (Management Order Priority & Showcase Customization) ---
  formatBannerImageUrl(url?: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
    const apiBase = environment.apiUrl || 'https://localhost:7127/api/v1';
    const host = apiBase.replace(/\/api\/v1\/?$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return path.startsWith('/uploads') ? `${host}${path}` : `${host}/uploads${path}`;
  }

  persistBannerDraft(): void {
    try {
      const draft = {
        editingBannerId: this.editingBannerId(),
        title: this.bTitle(),
        subtitle: this.bSubtitle(),
        description: this.bDescription(),
        imageUrl: this.bImageUrl(),
        linkUrl: this.bLinkUrl(),
        price: this.bPrice(),
        originalPrice: this.bOriginalPrice(),
        buttonText: this.bButtonText(),
        backgroundColor: this.bBackgroundColor(),
        textColor: this.bTextColor(),
        availableSizes: this.bAvailableSizes(),
        sortOrder: this.bSortOrder(),
        isActive: this.bIsActive()
      };
      sessionStorage.setItem(this.bannerDraftKey, JSON.stringify(draft));
    } catch {
      /* ignore quota / private mode */
    }
  }

  private clearBannerDraft(): void {
    try {
      sessionStorage.removeItem(this.bannerDraftKey);
    } catch {
      /* ignore */
    }
  }

  private restoreBannerDraft(): boolean {
    try {
      const raw = sessionStorage.getItem(this.bannerDraftKey);
      if (!raw) return false;
      const d = JSON.parse(raw);
      this.editingBannerId.set(d.editingBannerId || null);
      this.bTitle.set(d.title || '');
      this.bSubtitle.set(d.subtitle || '');
      this.bDescription.set(d.description || '');
      this.bImageUrl.set(d.imageUrl || '');
      this.bLinkUrl.set(d.linkUrl || '/products');
      this.bPrice.set(d.price ?? null);
      this.bOriginalPrice.set(d.originalPrice ?? null);
      this.bButtonText.set(d.buttonText || 'Get the look >');
      this.bBackgroundColor.set(d.backgroundColor || 'from-[#ea580c] via-[#c2410c] to-[#431407]');
      this.bTextColor.set(d.textColor || 'auto');
      this.bAvailableSizes.set(d.availableSizes || '36, 38, 40');
      this.bSortOrder.set(d.sortOrder ?? 1);
      this.bIsActive.set(d.isActive ?? true);
      return true;
    } catch {
      return false;
    }
  }

  openBannerModal(banner?: AdminBannerDto): void {
    if (banner) {
      this.editingBannerId.set(banner.id);
      this.bTitle.set(banner.title || '');
      this.bSubtitle.set(banner.subtitle || '');
      this.bDescription.set(banner.description || '');
      this.bImageUrl.set(banner.imageUrl || '');
      this.bLinkUrl.set(banner.linkUrl || banner.targetUrl || '');
      this.bPrice.set(banner.price ?? null);
      this.bOriginalPrice.set(banner.originalPrice ?? null);
      this.bButtonText.set(banner.buttonText || 'Get the look >');
      this.bBackgroundColor.set(banner.backgroundColor || 'from-[#ea580c] via-[#c2410c] to-[#431407]');
      this.bTextColor.set((banner.textColor as any) || 'auto');
      this.bAvailableSizes.set(banner.availableSizes || '36, 38, 40');
      this.bSortOrder.set(banner.sortOrder ?? 1);
      this.bIsActive.set(banner.isActive ?? true);
      this.clearBannerDraft();
    } else if (!this.restoreBannerDraft()) {
      this.editingBannerId.set(null);
      this.bTitle.set('Stand out without trying');
      this.bSubtitle.set('Confidence, wrapped in warmth');
      this.bDescription.set(
        'Embrace the cold with this bold, insulated puffer. Lightweight yet cozy, designed for effortless style.'
      );
      this.bImageUrl.set('');
      this.bLinkUrl.set('/products');
      this.bPrice.set(149);
      this.bOriginalPrice.set(199);
      this.bButtonText.set('Get the look >');
      this.bBackgroundColor.set('from-[#ea580c] via-[#c2410c] to-[#431407]');
      this.bTextColor.set('auto');
      this.bAvailableSizes.set('36, 38, 40');
      this.bSortOrder.set(this.banners().length + 1);
      this.bIsActive.set(true);
    }
    this.bannerModalOpen.set(true);
    this.persistBannerDraft();
  }

  closeBannerModal(discard = false): void {
    if (!discard) {
      this.persistBannerDraft();
    } else {
      this.clearBannerDraft();
    }
    this.bannerModalOpen.set(false);
  }

  onBannerFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.isUploadingBanner.set(true);
    this.adminService.uploadBannerImage(file).subscribe({
      next: (res) => {
        this.isUploadingBanner.set(false);
        if (res?.imageUrl) {
          this.bImageUrl.set(res.imageUrl);
          this.persistBannerDraft();
          this.toast.show('Image uploaded successfully', 'success');
        }
      },
      error: (err) => {
        this.isUploadingBanner.set(false);
        const msg =
          err?.error ||
          err?.error?.error ||
          err?.message ||
          'Failed to upload image';
        this.toast.show(typeof msg === 'string' ? msg : 'Failed to upload image', 'error');
      }
    });
  }

  moveBannerUp(index: number): void {
    const list = [...this.banners()];
    if (index <= 0 || index >= list.length) return;
    const current = list[index];
    const prev = list[index - 1];

    const currentOrder = current.sortOrder ?? index + 1;
    const prevOrder = prev.sortOrder ?? index;

    current.sortOrder = prevOrder;
    prev.sortOrder = currentOrder;

    list[index] = prev;
    list[index - 1] = current;
    this.banners.set(list);

    this.adminService.updateBanner(current.id, this.toBannerPayload(current)).subscribe();
    this.adminService.updateBanner(prev.id, this.toBannerPayload(prev)).subscribe({
      next: () => {
        this.toast.show('Priority updated: Move up', 'success');
        this.loadData();
      },
      error: (err) => this.toast.show(err?.error?.error || 'Failed to update priority', 'error')
    });
  }

  moveBannerDown(index: number): void {
    const list = [...this.banners()];
    if (index < 0 || index >= list.length - 1) return;
    const current = list[index];
    const next = list[index + 1];

    const currentOrder = current.sortOrder ?? index + 1;
    const nextOrder = next.sortOrder ?? index + 2;

    current.sortOrder = nextOrder;
    next.sortOrder = currentOrder;

    list[index] = next;
    list[index + 1] = current;
    this.banners.set(list);

    this.adminService.updateBanner(current.id, this.toBannerPayload(current)).subscribe();
    this.adminService.updateBanner(next.id, this.toBannerPayload(next)).subscribe({
      next: () => {
        this.toast.show('Priority updated: Move down', 'success');
        this.loadData();
      },
      error: (err) => this.toast.show(err?.error?.error || 'Failed to update priority', 'error')
    });
  }

  private toBannerPayload(b: AdminBannerDto): any {
    return {
      title: b.title || 'Banner',
      subtitle: b.subtitle || null,
      description: b.description || null,
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl || b.targetUrl || null,
      price: b.price ?? null,
      originalPrice: b.originalPrice ?? null,
      buttonText: b.buttonText || 'Get the look >',
      backgroundColor: b.backgroundColor || 'from-[#ea580c] via-[#c2410c] to-[#431407]',
      textColor: b.textColor || 'auto',
      availableSizes: b.availableSizes || null,
      sortOrder: b.sortOrder ?? 0,
      isActive: b.isActive !== false,
      startDate: b.startDate || null,
      endDate: b.endDate || null
    };
  }

  saveBanner(): void {
    const title = this.bTitle().trim();
    const imageUrl = this.bImageUrl().trim();
    if (!imageUrl) {
      this.toast.show('Product image is required — upload a file or paste a URL.', 'error');
      return;
    }
    if (!title) {
      this.toast.show('Headline title is required.', 'error');
      return;
    }
    if (this.isSavingBanner() || this.isUploadingBanner()) return;

    const payload: any = {
      title,
      subtitle: this.bSubtitle().trim() || null,
      description: this.bDescription().trim() || null,
      imageUrl,
      linkUrl: this.bLinkUrl().trim() || null,
      price: this.bPrice(),
      originalPrice: this.bOriginalPrice(),
      buttonText: this.bButtonText().trim() || 'Get the look >',
      backgroundColor: this.bBackgroundColor().trim() || 'from-[#ea580c] via-[#c2410c] to-[#431407]',
      textColor: this.bTextColor(),
      availableSizes: this.bAvailableSizes().trim() || null,
      sortOrder: Number(this.bSortOrder()) || 1,
      isActive: this.bIsActive() !== false,
      startDate: null,
      endDate: null
    };

    this.isSavingBanner.set(true);
    const id = this.editingBannerId();
    const req$ = id
      ? this.adminService.updateBanner(id, payload)
      : this.adminService.createBanner(payload);

    req$.subscribe({
      next: () => {
        this.isSavingBanner.set(false);
        this.clearBannerDraft();
        this.bannerModalOpen.set(false);
        this.toast.show(id ? `Banner "${title}" updated` : `Banner "${title}" published`, 'success');
        this.loadData();
      },
      error: (err) => {
        this.isSavingBanner.set(false);
        this.persistBannerDraft();
        const msg =
          (typeof err?.error === 'string' ? err.error : null) ||
          err?.error?.error ||
          err?.message ||
          err?.error?.errors?.[0] ||
          'Failed to publish banner';
        this.toast.show(msg, 'error');
      }
    });
  }

  toggleBannerVisibility(banner: AdminBannerDto): void {
    if (this.busyBannerId()) return;
    const next = banner.isActive === false;
    this.busyBannerId.set(banner.id);

    const payload = {
      ...this.toBannerPayload(banner),
      isActive: next
    };

    this.adminService.updateBanner(banner.id, payload).subscribe({
      next: () => {
        this.busyBannerId.set(null);
        this.banners.update((list) =>
          list.map((b) => (b.id === banner.id ? { ...b, isActive: next } : b))
        );
        this.toast.show(
          next ? `"${banner.title}" is now Live on homepage` : `"${banner.title}" is now Hidden`,
          'success'
        );
      },
      error: (err) => {
        this.busyBannerId.set(null);
        this.toast.show(err?.error?.error || 'Failed to update visibility.', 'error');
      }
    });
  }

  askDeleteBanner(banner: AdminBannerDto): void {
    this.bannerToDelete.set(banner);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    if (this.isDeletingBanner()) return;
    this.deleteModalOpen.set(false);
    this.bannerToDelete.set(null);
  }

  confirmDeleteBanner(): void {
    const banner = this.bannerToDelete();
    if (!banner || this.isDeletingBanner()) return;

    this.isDeletingBanner.set(true);
    this.adminService.deleteBanner(banner.id).subscribe({
      next: () => {
        this.isDeletingBanner.set(false);
        this.deleteModalOpen.set(false);
        this.bannerToDelete.set(null);
        this.banners.update((list) => list.filter((b) => b.id !== banner.id));
        this.toast.show(`Banner "${banner.title}" permanently deleted`, 'info');
        this.loadData();
      },
      error: (err) => {
        this.isDeletingBanner.set(false);
        this.toast.show(err?.error?.error || 'Failed to delete banner', 'error');
      }
    });
  }

  // --- PAYMENT LOGOS (homepage infinite showcase) ---
  openPaymentLogoModal(logo?: AdminPaymentLogoDto): void {
    if (logo) {
      this.editingPaymentLogoId.set(logo.id);
      this.pName.set(logo.name || '');
      this.pImageUrl.set(logo.imageUrl || '');
      this.pSortOrder.set(logo.sortOrder ?? 1);
      this.pIsActive.set(logo.isActive !== false);
    } else {
      this.editingPaymentLogoId.set(null);
      this.pName.set('');
      this.pImageUrl.set('');
      this.pSortOrder.set((this.paymentLogos().length || 0) + 1);
      this.pIsActive.set(true);
    }
    this.paymentLogoModalOpen.set(true);
  }

  closePaymentLogoModal(): void {
    if (this.isSavingPaymentLogo() || this.isUploadingPaymentLogo()) return;
    this.paymentLogoModalOpen.set(false);
  }

  onPaymentLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.isUploadingPaymentLogo.set(true);
    this.adminService.uploadPaymentLogoImage(file).subscribe({
      next: (res) => {
        this.isUploadingPaymentLogo.set(false);
        if (res?.imageUrl) {
          this.pImageUrl.set(res.imageUrl);
          this.toast.show('Logo uploaded', 'success');
        }
      },
      error: (err) => {
        this.isUploadingPaymentLogo.set(false);
        this.toast.show(err?.error?.error || 'Failed to upload logo', 'error');
      }
    });
  }

  savePaymentLogo(): void {
    const imageUrl = this.pImageUrl().trim();
    const name = this.pName().trim() || 'Payment method';
    if (!imageUrl) {
      this.toast.show('Upload a payment logo image first.', 'error');
      return;
    }
    if (this.isSavingPaymentLogo() || this.isUploadingPaymentLogo()) return;

    const payload = {
      name,
      imageUrl,
      sortOrder: Number(this.pSortOrder()) || 1,
      isActive: this.pIsActive() !== false
    };

    this.isSavingPaymentLogo.set(true);
    const id = this.editingPaymentLogoId();
    const req$ = id
      ? this.adminService.updatePaymentLogo(id, payload)
      : this.adminService.createPaymentLogo(payload);

    req$.subscribe({
      next: () => {
        this.isSavingPaymentLogo.set(false);
        this.paymentLogoModalOpen.set(false);
        this.toast.show(id ? 'Payment logo updated' : 'Payment logo added to homepage showcase', 'success');
        this.loadData();
      },
      error: (err) => {
        this.isSavingPaymentLogo.set(false);
        this.toast.show(err?.error?.error || 'Failed to save payment logo', 'error');
      }
    });
  }

  togglePaymentLogoVisibility(logo: AdminPaymentLogoDto): void {
    if (this.busyPaymentLogoId()) return;
    const next = logo.isActive === false;
    this.busyPaymentLogoId.set(logo.id);
    this.adminService.updatePaymentLogo(logo.id, {
      name: logo.name,
      imageUrl: logo.imageUrl,
      sortOrder: logo.sortOrder ?? 0,
      isActive: next
    }).subscribe({
      next: () => {
        this.busyPaymentLogoId.set(null);
        this.paymentLogos.update((list) =>
          list.map((x) => (x.id === logo.id ? { ...x, isActive: next } : x))
        );
        this.toast.show(next ? `"${logo.name}" is Live` : `"${logo.name}" is Hidden`, 'success');
      },
      error: (err) => {
        this.busyPaymentLogoId.set(null);
        this.toast.show(err?.error?.error || 'Failed to update visibility', 'error');
      }
    });
  }

  deletePaymentLogo(logo: AdminPaymentLogoDto): void {
    this.askDelete(
      'Delete payment logo?',
      'This logo will no longer appear on checkout / payout UIs.',
      logo.name,
      () => {
        this.adminService.deletePaymentLogo(logo.id).subscribe({
          next: () => {
            this.deleteConfirmBusy.set(false);
            this.deleteConfirmOpen.set(false);
            this.toast.show('Payment logo deleted', 'info');
            this.loadData();
          },
          error: (err) => {
            this.deleteConfirmBusy.set(false);
            this.toast.show(err?.error?.error || 'Failed to delete logo', 'error');
          }
        });
      }
    );
  }
}
