import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthStore, ToastService, SignalRService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminShopkeeperDto, AdminShopDto, ShopCategoryDto } from '../../../core/models/admin.models';
import { environment } from '../../../../environments/environment';

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';
type ViewMode = 'stores' | 'applications' | 'tiers';

export interface TierUpgradeRequest {
  id: string;
  shopId: string;
  shopName: string;
  merchantName: string;
  currentTier: string;
  requestedTier: string;
  requestedCategoryId?: string;
  badgeText: string;
  price: number;
  paymentMethod: string;
  referenceNote: string;
  receiptUrl?: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestedAt: string;
  maxProductListings?: number;
}

@Component({
  selector: 'app-shop-management',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
  templateUrl: './shop-management.html'
})
export class ShopManagement implements OnInit, OnDestroy {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly authStore = inject(AuthStore);
  private readonly signalR = inject(SignalRService);
  private unsubNotif: (() => void) | null = null;

  /** Only Management can create / edit / delete tier packages. */
  readonly canManageTiers = computed(() => this.authStore.hasRole('SuperAdmin'));

  readonly isLoading = signal<boolean>(true);
  readonly tiersLoading = signal<boolean>(true);
  readonly viewMode = signal<ViewMode>('stores');
  readonly allShopkeepers = signal<AdminShopkeeperDto[]>([]);
  readonly activeShops = signal<AdminShopDto[]>([]);
  readonly shopCategories = signal<ShopCategoryDto[]>([]);
  readonly tierRequests = signal<TierUpgradeRequest[]>([]);
  /** Status filter for tier upgrade table */
  readonly tierStatusFilter = signal<'ALL' | 'Pending' | 'Approved' | 'Rejected'>('ALL');
  /** Plan/category filter (Gold, Diamond, …) */
  readonly tierPlanFilter = signal<string>('ALL');
  readonly selectedCategoryFilter = signal<string>('all');
  readonly activeTab = signal<FilterTab>('all');
  readonly searchTerm = signal<string>('');
  readonly actionInProgress = signal<string | null>(null);

  /** One row per shop — newest request only */
  readonly latestTierRequests = computed(() => {
    const byShop = new Map<string, TierUpgradeRequest>();
    const sorted = [...this.tierRequests()].sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
    for (const r of sorted) {
      const key = this.tierShopKey(r);
      if (!byShop.has(key)) byShop.set(key, r);
    }
    return Array.from(byShop.values()).sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
  });

  readonly countPendingTiers = computed(() =>
    this.tierRequests().filter(r => r.status === 'Pending').length
  );

  readonly countLatestTiers = computed(() => this.latestTierRequests().length);

  readonly filteredTierRequests = computed(() => {
    let list = this.latestTierRequests();
    const status = this.tierStatusFilter();
    const plan = this.tierPlanFilter().toLowerCase();
    const term = this.searchTerm().trim().toLowerCase();

    if (status !== 'ALL') {
      list = list.filter(r => String(r.status || '').toLowerCase() === status.toLowerCase());
    }
    if (plan !== 'all') {
      list = list.filter(r => {
        const requested = (r.requestedTier || '').toLowerCase();
        const badge = (r.badgeText || '').toLowerCase();
        return requested === plan || badge === plan ||
          requested.includes(plan) || badge.includes(plan) ||
          plan.includes(requested) || plan.includes(badge);
      });
    }
    if (term) {
      list = list.filter(r =>
        (r.shopName || '').toLowerCase().includes(term) ||
        (r.merchantName || '').toLowerCase().includes(term) ||
        (r.requestedTier || '').toLowerCase().includes(term) ||
        (r.currentTier || '').toLowerCase().includes(term)
      );
    }
    return list;
  });

  readonly tierPlanOptions = computed(() => {
    const fromCats = this.shopCategories().map(c => c.name).filter(Boolean);
    const fromReqs = this.tierRequests().map(r => r.requestedTier).filter(Boolean);
    return Array.from(new Set([...fromCats, ...fromReqs])).sort((a, b) => a.localeCompare(b));
  });

  // Tier history detail modal
  readonly tierHistoryModalOpen = signal<boolean>(false);
  readonly tierHistoryShop = signal<TierUpgradeRequest | null>(null);
  readonly tierHistoryRows = computed(() => {
    const shop = this.tierHistoryShop();
    if (!shop) return [] as TierUpgradeRequest[];
    const key = this.tierShopKey(shop);
    return this.tierRequests()
      .filter(r => this.tierShopKey(r) === key)
      .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
  });

  // Pagination
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 20, 50];

  // Reject Modal
  readonly rejectModalOpen = signal<boolean>(false);
  readonly selectedShop = signal<AdminShopkeeperDto | null>(null);
  readonly rejectionReason = signal<string>('');

  // Approve Shop Modal
  readonly approveModalOpen = signal<boolean>(false);
  readonly shopToApprove = signal<AdminShopkeeperDto | null>(null);

  // Edit Store Details & Media Modal
  readonly editStoreModalOpen = signal<boolean>(false);
  readonly editingShop = signal<AdminShopDto | null>(null);
  readonly editName = signal<string>('');
  readonly editDescription = signal<string>('');
  readonly editPhone = signal<string>('');
  readonly editAddress = signal<string>('');
  readonly editCity = signal<string>('');
  readonly editCountry = signal<string>('');
  readonly editLogoUrl = signal<string>('');
  readonly editBannerUrl = signal<string>('');
  readonly isUploadingLogo = signal<boolean>(false);
  readonly isUploadingBanner = signal<boolean>(false);
  readonly isSavingShopDetails = signal<boolean>(false);

  // Store Details Modal
  readonly detailsModalOpen = signal<boolean>(false);
  readonly selectedStoreDetails = signal<AdminShopDto | null>(null);
  readonly selectedApplicant = signal<AdminShopkeeperDto | null>(null);
  readonly detailsLoading = signal<boolean>(false);

  // Delete Shop Modal
  readonly deleteShopModalOpen = signal<boolean>(false);
  readonly shopToDelete = signal<AdminShopDto | null>(null);
  readonly deleteShopReason = signal<string>('');

  // Receipt / Document Preview Modal (lightbox)
  readonly previewReceiptModalOpen = signal<boolean>(false);
  readonly previewReceiptUrl = signal<string | null>(null);
  readonly previewReceiptStore = signal<string>('');
  readonly previewDocTitle = signal<string>('Document Preview');

  openReceiptPreview(url: string, storeName: string): void {
    this.openDocumentLightbox(url, storeName, 'Payment Receipt Preview');
  }

  openDocumentLightbox(url: string | null | undefined, label: string, title = 'Identity Document Preview'): void {
    const resolved = this.formatImageUrl(url);
    if (!resolved) {
      this.toast.show('Document image is not available. Seller may need to re-upload.', 'warning');
      return;
    }
    this.previewReceiptUrl.set(resolved);
    this.previewReceiptStore.set(label);
    this.previewDocTitle.set(title);
    this.previewReceiptModalOpen.set(true);
  }

  closeReceiptPreview(): void {
    this.previewReceiptModalOpen.set(false);
    this.previewReceiptUrl.set(null);
    this.previewReceiptStore.set('');
    this.previewDocTitle.set('Document Preview');
  }

  // Assign Tier Modal
  readonly assignTierModalOpen = signal<boolean>(false);
  readonly shopToAssign = signal<AdminShopDto | null>(null);
  readonly assignSelectedTierId = signal<string | null>(null);
  readonly assignCustomBadge = signal<string>('');

  // Manage Tiers Modal
  readonly manageTiersModalOpen = signal<boolean>(false);
  readonly editingTierModalOpen = signal<boolean>(false);
  readonly editingTier = signal<ShopCategoryDto | null>(null);
  readonly tierFormName = signal<string>('');
  readonly tierFormBadgeText = signal<string>('');
  readonly tierFormBadgeColor = signal<string>('#F59E0B');
  readonly tierFormIcon = signal<string>('👑');
  readonly tierFormDesc = signal<string>('');
  readonly tierFormOrder = signal<number>(1);
  readonly tierFormPriceUsd = signal<number>(0);
  readonly tierFormMaxProducts = signal<number>(200);
  readonly tierFormIsRecommended = signal<boolean>(false);
  readonly isSavingTier = signal<boolean>(false);
  readonly deleteTierModalOpen = signal<boolean>(false);
  readonly tierToDelete = signal<ShopCategoryDto | null>(null);

  formatImageUrl(url?: string | null): string {
    return this.adminService.formatImageUrl(url);
  }

  onImgError(event: Event, name?: string): void {
    const img = event.target as HTMLImageElement;
    img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Shop')}&background=EA580C&color=fff&bold=true`;
  }

  onInlineTierChange(_store: AdminShopDto, _newTierId: string): void {
    this.toast.show(
      'Direct tier change band hai. Seller apply kare → Tier Upgrade Requests se Approve/Reject karo.',
      'warning'
    );
    this.loadData();
  }

  openDeleteShopModal(shop: AdminShopDto): void {
    this.shopToDelete.set(shop);
    this.deleteShopReason.set('');
    this.deleteShopModalOpen.set(true);
  }

  openDeleteShopkeeperModal(applicant: AdminShopkeeperDto): void {
    const matched = this.activeShops().find(s => 
      (applicant.shopId && s.id === applicant.shopId) || 
      (applicant.storeName && s.name.toLowerCase() === applicant.storeName.toLowerCase())
    );
    // Prefer real shopId so delete hits the shop + cascaded shopkeeper cleanup
    const shopDetail: AdminShopDto = matched || {
      id: applicant.shopId || applicant.id,
      name: applicant.storeName || applicant.name + "'s Store",
      slug: applicant.storeUrl || 'store',
      logoUrl: null,
      city: applicant.city,
      country: applicant.country,
      phone: applicant.phone,
      rating: applicant.rating || 0,
      totalProducts: applicant.totalProducts || 0,
      createdAt: applicant.createdAt
    };
    this.openDeleteShopModal(shopDetail);
  }

  closeDeleteShopModal(): void {
    this.deleteShopModalOpen.set(false);
    this.shopToDelete.set(null);
    this.deleteShopReason.set('');
  }

  confirmDeleteShop(): void {
    const shop = this.shopToDelete();
    const reason = this.deleteShopReason().trim();
    if (!shop) return;
    if (!reason) {
      this.toast.show('Please enter a reason for deleting this store.', 'error');
      return;
    }
    this.actionInProgress.set(shop.id);
    this.closeDeleteShopModal();
    this.closeDetailsModal();

    const finishOk = (label: string) => {
      this.actionInProgress.set(null);
      this.activeShops.update(list => list.filter(s => s.id !== shop.id));
      this.allShopkeepers.update(list => list.filter(k =>
        k.shopId !== shop.id && k.id !== shop.id
      ));
      this.toast.show(label, 'success');
      this.loadData();
    };

    // Prefer shopkeeper delete (cascades shop + account). Also try shop delete.
    this.adminService.deleteShopkeeper(shop.id, reason).subscribe({
      next: () => finishOk(`Store "${shop.name}" has been deleted successfully.`),
      error: () => {
        this.adminService.deleteShop(shop.id).subscribe({
          next: () => finishOk(`Store "${shop.name}" has been deleted successfully.`),
          error: (err2) => {
            this.actionInProgress.set(null);
            this.toast.show(err2?.error?.error || 'Failed to delete store.', 'error');
          }
        });
      }
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const tabParam = params.get('tab') as FilterTab | null;
      const viewParam = params.get('view') as ViewMode | null;

      if (viewParam && ['stores', 'applications', 'tiers'].includes(viewParam)) {
        this.viewMode.set(viewParam);
      } else if (tabParam === 'pending') {
        this.viewMode.set('applications');
      }

      if (tabParam && ['all', 'pending', 'approved', 'rejected'].includes(tabParam)) {
        this.activeTab.set(tabParam);
      }
      this.currentPage.set(1);
    });

    this.loadData();

    void this.signalR.startNotificationConnection().catch(() => {});
    this.unsubNotif = this.signalR.onReceiveNotification((payload) => {
      const t = String(payload?.title || '').toLowerCase();
      const m = String(payload?.message || '').toLowerCase();
      // Only tier-request notifications — do NOT force navigate (that caused stuck blank pages)
      const isTierReq =
        t.includes('tier') ||
        t.includes('badge request') ||
        m.includes('tier upgrade') ||
        m.includes('package upgrade') ||
        m.includes('badge request');
      if (isTierReq) {
        this.reloadTierRequests();
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubNotif?.();
    this.unsubNotif = null;
  }

  private normalizeTierRequests(reqs: any[]): TierUpgradeRequest[] {
    return (reqs || [])
      .map((r: any) => {
        const statusRaw = String(r?.status || r?.Status || 'Pending');
        const statusNorm =
          statusRaw.toLowerCase() === 'approved' ? 'Approved'
          : statusRaw.toLowerCase() === 'rejected' ? 'Rejected'
          : 'Pending';
        return {
          id: String(r?.id || r?.Id || '').trim(),
          shopId: String(r?.shopId || r?.ShopId || ''),
          shopName: String(r?.shopName || r?.ShopName || 'Unknown store'),
          merchantName: String(r?.merchantName || r?.MerchantName || ''),
          currentTier: String(r?.currentTier || r?.CurrentTier || 'Bronze (Free)'),
          requestedTier: String(r?.requestedTier || r?.RequestedTier || ''),
          requestedCategoryId: r?.requestedCategoryId || r?.RequestedCategoryId,
          badgeText: String(r?.badgeText || r?.BadgeText || r?.requestedTier || r?.RequestedTier || ''),
          price: Number(r?.price ?? r?.Price ?? 0) || 0,
          paymentMethod: String(r?.paymentMethod || r?.PaymentMethod || ''),
          referenceNote: String(r?.referenceNote || r?.ReferenceNote || ''),
          receiptUrl: r?.receiptUrl || r?.ReceiptUrl || null,
          status: statusNorm as TierUpgradeRequest['status'],
          requestedAt: r?.requestedAt || r?.RequestedAt || new Date().toISOString(),
          maxProductListings: Number(r?.maxProductListings ?? r?.MaxProductListings ?? 0) || undefined
        };
      })
      .filter(r => !!r.id && r.id !== 'undefined' && r.id !== 'null');
  }

  private reloadTierRequests(): void {
    this.tiersLoading.set(true);
    this.adminService.getTierUpgradeRequests().subscribe({
      next: (reqs) => {
        this.tiersLoading.set(false);
        // null = aborted / 204 / network swallow — keep current rows
        if (reqs === null || reqs === undefined) return;
        if (!Array.isArray(reqs)) {
          console.warn('tier-requests unexpected payload', reqs);
          return;
        }
        const normalized = this.normalizeTierRequests(reqs);
        this.tierRequests.set(normalized);
      },
      error: (err) => {
        this.tiersLoading.set(false);
        console.error('tier-requests failed', err);
        this.toast.show(err?.error || err?.message || 'Could not load tier upgrade requests.', 'error');
      }
    });
  }

  loadData(): void {
    this.isLoading.set(true);
    this.tiersLoading.set(true);

    // Fetch all shopkeepers from admin API
    this.adminService.getShopkeepers().subscribe({
      next: (list) => {
        this.allShopkeepers.set(list || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.show(err?.error?.error || 'Failed to load shopkeepers.', 'error');
      }
    });

    // Fetch active public shops
    this.adminService.getShops(1, 100).subscribe({
      next: (res) => {
        this.activeShops.set(res?.items || []);
      },
      error: () => {}
    });

    // Load shop categories; seed is best-effort (Management only — ignore 401 for Partner)
    this.adminService.getShopCategories().subscribe({
      next: (cats) => this.shopCategories.set(cats || []),
      error: () => {}
    });
    if (this.canManageTiers()) {
      this.adminService.seedStandardTiers().subscribe({
        next: () => {
          this.adminService.getShopCategories().subscribe({
            next: (cats) => this.shopCategories.set(cats || []),
            error: () => {}
          });
        },
        error: () => {}
      });
    }

    // Fetch tier upgrade requests (Pending + Approved + Rejected)
    this.reloadTierRequests();
  }

  // Filtered Applications List
  readonly filteredShopkeepers = computed(() => {
    let list = this.allShopkeepers();
    const tab = this.activeTab();
    const term = this.searchTerm().trim().toLowerCase();

    // Deleted stores (soft-delete + account disabled) should not clutter the main list
    if (tab === 'all') {
      list = list.filter(s => !(String(s.status).toLowerCase() === 'rejected' && s.isActive === false));
    }

    // Tab filter
    if (tab === 'pending') {
      list = list.filter(s => String(s.status).toLowerCase() === 'pending');
    } else if (tab === 'approved') {
      list = list.filter(s => String(s.status).toLowerCase() === 'approved');
    } else if (tab === 'rejected') {
      list = list.filter(s => String(s.status).toLowerCase() === 'rejected');
    }

    // Search filter
    if (term) {
      list = list.filter(s => 
        (s.storeName && s.storeName.toLowerCase().includes(term)) ||
        (s.name && s.name.toLowerCase().includes(term)) ||
        (s.email && s.email.toLowerCase().includes(term)) ||
        (s.city && s.city.toLowerCase().includes(term)) ||
        (s.phone && s.phone.includes(term))
      );
    }

    return list;
  });

  // Filtered Active Stores List
  readonly filteredActiveStores = computed(() => {
    let list = this.activeShops();
    const term = this.searchTerm().trim().toLowerCase();
    const catFilter = this.selectedCategoryFilter();

    if (catFilter !== 'all') {
      list = list.filter(s => s.shopCategoryId === catFilter);
    }

    if (term) {
      list = list.filter(s =>
        (s.name && s.name.toLowerCase().includes(term)) ||
        (s.slug && s.slug.toLowerCase().includes(term)) ||
        (s.city && s.city.toLowerCase().includes(term)) ||
        (s.country && s.country.toLowerCase().includes(term)) ||
        (s.shopCategoryName && s.shopCategoryName.toLowerCase().includes(term)) ||
        (s.badgeText && s.badgeText.toLowerCase().includes(term))
      );
    }

    return list;
  });

  // Tab counts for Applications
  readonly countPending = computed(() => 
    this.allShopkeepers().filter(s => String(s.status).toLowerCase() === 'pending').length
  );
  readonly countApproved = computed(() => 
    this.allShopkeepers().filter(s => String(s.status).toLowerCase() === 'approved').length
  );
  readonly countRejected = computed(() => 
    this.allShopkeepers().filter(s => String(s.status).toLowerCase() === 'rejected').length
  );

  // Paginated Slices
  readonly pagedShopkeepers = computed(() => {
    const list = this.filteredShopkeepers();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  readonly totalShopkeeperPages = computed(() => 
    Math.ceil(this.filteredShopkeepers().length / this.pageSize()) || 1
  );

  readonly pagedActiveStores = computed(() => {
    const list = this.filteredActiveStores();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  readonly totalActiveStorePages = computed(() => 
    Math.ceil(this.filteredActiveStores().length / this.pageSize()) || 1
  );

  readonly currentTotalPages = computed(() => 
    this.viewMode() === 'stores' ? this.totalActiveStorePages() : this.totalShopkeeperPages()
  );

  readonly currentTotalItems = computed(() => 
    this.viewMode() === 'stores' ? this.filteredActiveStores().length : this.filteredShopkeepers().length
  );

  readonly startItemIndex = computed(() => {
    if (this.currentTotalItems() === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  readonly endItemIndex = computed(() => {
    return Math.min(this.currentPage() * this.pageSize(), this.currentTotalItems());
  });

  readonly pageNumbers = computed(() => {
    const total = this.currentTotalPages();
    const current = Math.min(this.currentPage(), total);
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  goToPage(page: number): void {
    if (page >= 1 && page <= this.currentTotalPages()) {
      this.currentPage.set(page);
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  switchViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    this.currentPage.set(1);
    // Replace query so leftover tab=pending doesn't stick on stores/tiers
    this.router.navigate([], {
      queryParams: mode === 'applications'
        ? { view: mode, tab: this.activeTab() }
        : { view: mode, tab: null },
      queryParamsHandling: ''
    });
    if (mode === 'tiers') {
      this.reloadTierRequests();
    }
  }

  switchTab(tab: FilterTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.router.navigate([], { queryParams: { tab: tab }, queryParamsHandling: 'merge' });
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1);
  }

  openApproveModal(shop: AdminShopkeeperDto): void {
    this.shopToApprove.set(shop);
    this.approveModalOpen.set(true);
  }

  closeApproveModal(): void {
    this.approveModalOpen.set(false);
    this.shopToApprove.set(null);
  }

  confirmApproveShop(): void {
    const shop = this.shopToApprove();
    if (!shop) return;
    this.closeApproveModal();
    this.approveShop(shop);
  }

  openEditStoreModal(shop: AdminShopDto): void {
    this.editingShop.set(shop);
    this.editName.set(shop.name || '');
    this.editDescription.set(shop.description || '');
    this.editPhone.set(shop.phone || '');
    this.editAddress.set(shop.address || '');
    this.editCity.set(shop.city || '');
    this.editCountry.set(shop.country || 'United States');
    this.editLogoUrl.set(shop.logoUrl || '');
    this.editBannerUrl.set(shop.bannerUrl || '');
    this.editStoreModalOpen.set(true);

    this.adminService.getShopById(shop.id).subscribe({
      next: (full) => {
        if (full) {
          if (full.name) this.editName.set(full.name);
          if (full.description) this.editDescription.set(full.description);
          if (full.phone) this.editPhone.set(full.phone);
          if (full.address) this.editAddress.set(full.address);
          if (full.city) this.editCity.set(full.city);
          if (full.country) this.editCountry.set(full.country);
          if (full.logoUrl) this.editLogoUrl.set(full.logoUrl);
          if (full.bannerUrl) this.editBannerUrl.set(full.bannerUrl);
        }
      }
    });
  }

  closeEditStoreModal(): void {
    this.editStoreModalOpen.set(false);
    this.editingShop.set(null);
  }

  onShopLogoSelected(event: Event): void {
    const shop = this.editingShop();
    if (!shop) return;
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.isUploadingLogo.set(true);
      this.adminService.uploadShopLogo(shop.id, file).subscribe({
        next: (res) => {
          this.isUploadingLogo.set(false);
          if (res && res.logoUrl) {
            this.editLogoUrl.set(res.logoUrl);
            this.toast.show('Store logo updated successfully!', 'success');
            this.loadData();
          }
        },
        error: (err) => {
          this.isUploadingLogo.set(false);
          this.toast.show(err?.error?.error || 'Failed to upload logo', 'error');
        }
      });
    }
  }

  onShopBannerSelected(event: Event): void {
    const shop = this.editingShop();
    if (!shop) return;
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.isUploadingBanner.set(true);
      this.adminService.uploadShopBanner(shop.id, file).subscribe({
        next: (res) => {
          this.isUploadingBanner.set(false);
          if (res && res.bannerUrl) {
            this.editBannerUrl.set(res.bannerUrl);
            this.toast.show('Store banner updated successfully!', 'success');
            this.loadData();
          }
        },
        error: (err) => {
          this.isUploadingBanner.set(false);
          this.toast.show(err?.error?.error || 'Failed to upload banner', 'error');
        }
      });
    }
  }

  saveShopProfile(): void {
    const shop = this.editingShop();
    if (!shop) return;
    const name = this.editName().trim();
    if (!name) {
      this.toast.show('Store name is required.', 'error');
      return;
    }

    this.isSavingShopDetails.set(true);
    const payload = {
      name,
      description: this.editDescription().trim() || undefined,
      phone: this.editPhone().trim() || undefined,
      address: this.editAddress().trim() || undefined,
      city: this.editCity().trim() || undefined,
      country: this.editCountry().trim() || 'United States'
    };

    this.adminService.updateShop(shop.id, payload).subscribe({
      next: () => {
        this.isSavingShopDetails.set(false);
        this.toast.show(`Store "${name}" updated successfully!`, 'success');
        this.closeEditStoreModal();
        this.loadData();
      },
      error: (err) => {
        this.isSavingShopDetails.set(false);
        this.toast.show(err?.error?.error || 'Failed to update store.', 'error');
      }
    });
  }

  approveShop(shop: AdminShopkeeperDto): void {
    this.actionInProgress.set(shop.id);
    this.adminService.approveShopkeeper(shop.id).subscribe({
      next: () => {
        this.toast.show(`Store "${shop.storeName}" has been approved!`, 'success');
        this.actionInProgress.set(null);
        this.loadData();
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to approve store.', 'error');
      }
    });
  }

  openRejectModal(shop: AdminShopkeeperDto): void {
    this.selectedShop.set(shop);
    this.rejectionReason.set('');
    this.rejectModalOpen.set(true);
  }

  closeRejectModal(): void {
    this.rejectModalOpen.set(false);
    this.selectedShop.set(null);
    this.rejectionReason.set('');
  }

  confirmReject(): void {
    const shop = this.selectedShop();
    const reason = this.rejectionReason().trim();

    if (!shop) return;
    if (!reason) {
      this.toast.show('Please provide a reason for rejecting the store application.', 'error');
      return;
    }

    this.actionInProgress.set(shop.id);
    this.closeRejectModal();

    this.adminService.rejectShopkeeper(shop.id, reason).subscribe({
      next: () => {
        this.toast.show(`Store "${shop.storeName}" was rejected.`, 'info');
        this.actionInProgress.set(null);
        this.loadData();
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to reject store.', 'error');
      }
    });
  }

  openStoreDetails(store: AdminShopDto): void {
    this.selectedStoreDetails.set(store);
    const matchedKeeper = this.allShopkeepers().find(k => 
      (k.shopId && k.shopId === store.id) || 
      (k.storeName && k.storeName.toLowerCase() === store.name.toLowerCase())
    );
    this.selectedApplicant.set(matchedKeeper || null);
    this.detailsModalOpen.set(true);
    this.detailsLoading.set(true);

    // Fetch fuller details by ID if available
    this.adminService.getShopById(store.id).subscribe({
      next: (full) => {
        if (full) {
          this.selectedStoreDetails.set({ ...store, ...full });
        }
        this.detailsLoading.set(false);
      },
      error: () => this.detailsLoading.set(false)
    });
  }

  openApplicantDetails(applicant: AdminShopkeeperDto): void {
    this.selectedApplicant.set(applicant);
    const matched = this.activeShops().find(s => 
      (applicant.shopId && s.id === applicant.shopId) || 
      (s.name.toLowerCase() === applicant.storeName.toLowerCase())
    );
    const shopDetail: AdminShopDto = matched || {
      id: applicant.shopId || applicant.id,
      name: applicant.storeName || applicant.name + "'s Store",
      slug: applicant.storeUrl || 'store',
      logoUrl: null,
      city: applicant.city,
      country: applicant.country,
      phone: applicant.phone,
      rating: applicant.rating || 0,
      totalProducts: applicant.totalProducts || 0,
      createdAt: applicant.createdAt
    };

    this.selectedStoreDetails.set(shopDetail);
    this.detailsModalOpen.set(true);
  }

  closeDetailsModal(): void {
    this.detailsModalOpen.set(false);
    this.selectedStoreDetails.set(null);
    this.selectedApplicant.set(null);
  }

  rateShop(store: AdminShopDto, rating: number): void {
    if (!store?.id) return;
    const key = `rate-${store.id}`;
    this.actionInProgress.set(key);
    this.adminService.setShopRating(store.id, rating).subscribe({
      next: (res) => {
        const next = Number(res?.rating ?? rating);
        this.selectedStoreDetails.update((s) => (s && s.id === store.id ? { ...s, rating: next } : s));
        this.activeShops.update((list) =>
          list.map((s) => (s.id === store.id ? { ...s, rating: next } : s))
        );
        this.allShopkeepers.update((list) =>
          list.map((sk) =>
            sk.shopId === store.id || sk.storeName === store.name
              ? { ...sk, rating: next }
              : sk
          )
        );
        this.actionInProgress.set(null);
        this.toast.show(`Shop rated ${next.toFixed(1)} / 5.0 — visible to all visitors`, 'success');
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to update shop rating', 'error');
      }
    });
  }

  viewShopProducts(shopName: string, shopId?: string | null): void {
    this.closeDetailsModal();
    if (shopId) {
      this.router.navigate(['/products'], { queryParams: { shopId, shopName } });
    } else {
      this.router.navigate(['/products'], { queryParams: { shopName } });
    }
  }

  openCustomerStorefront(slug: string): void {
    if (!slug) return;
    const cleanSlug = slug.replace(/^https?:\/\/[^/]+\//, '').replace(/^\/shops\//, '').replace(/^\//, '');
    window.open(`${environment.customerUrl}/shops/${cleanSlug}`, '_blank', 'noopener,noreferrer');
  }

  onCategoryFilterChange(val: string): void {
    this.selectedCategoryFilter.set(val);
    this.currentPage.set(1);
  }

  // --- Assign Tier Modal (disabled: sellers must apply; admin only approves/rejects) ---
  openAssignTierModal(_shop: AdminShopDto): void {
    this.toast.show(
      'Direct tier assign band hai. Seller khud apply karega (receipt ke sath), phir aap Approve/Reject kar sakte ho.',
      'warning'
    );
  }

  closeAssignTierModal(): void {
    this.assignTierModalOpen.set(false);
    this.shopToAssign.set(null);
  }

  confirmAssignTier(): void {
    this.toast.show(
      'Direct tier assign disabled. Use Tier Upgrade Requests → Approve / Reject only.',
      'warning'
    );
    this.closeAssignTierModal();
  }

  // --- Manage Tiers CRUD Modal ---
  openManageTiersModal(): void {
    if (!this.canManageTiers()) {
      this.toast.show('Only Management can manage tier packages.', 'error');
      return;
    }
    this.manageTiersModalOpen.set(true);
  }

  closeManageTiersModal(): void {
    this.manageTiersModalOpen.set(false);
  }

  openCreateTierModal(): void {
    if (!this.canManageTiers()) {
      this.toast.show('Only Management can add tiers.', 'error');
      return;
    }
    this.editingTier.set(null);
    this.tierFormName.set('');
    this.tierFormBadgeText.set('');
    this.tierFormBadgeColor.set('#F59E0B');
    this.tierFormIcon.set('👑');
    this.tierFormDesc.set('');
    this.tierFormOrder.set((this.shopCategories().length + 1) * 10);
    this.tierFormPriceUsd.set(0);
    this.tierFormMaxProducts.set(200);
    this.tierFormIsRecommended.set(false);
    this.editingTierModalOpen.set(true);
  }

  openEditTierModal(tier: ShopCategoryDto): void {
    if (!this.canManageTiers()) {
      this.toast.show('Only Management can edit tiers.', 'error');
      return;
    }
    this.editingTier.set(tier);
    this.tierFormName.set(tier.name);
    this.tierFormBadgeText.set(tier.badgeText || '');
    this.tierFormBadgeColor.set(tier.badgeColor || '#F59E0B');
    this.tierFormIcon.set(tier.iconUrl || '👑');
    this.tierFormDesc.set(tier.description || '');
    this.tierFormOrder.set(tier.displayOrder || 1);
    this.tierFormPriceUsd.set(tier.priceUsd ?? 0);
    this.tierFormMaxProducts.set(tier.maxProductListings ?? 200);
    this.tierFormIsRecommended.set(!!tier.isRecommended);
    this.editingTierModalOpen.set(true);
  }

  closeEditingTierModal(): void {
    this.editingTierModalOpen.set(false);
    this.editingTier.set(null);
  }

  saveTier(): void {
    if (!this.canManageTiers()) {
      this.toast.show('Only Management can save tiers.', 'error');
      return;
    }
    const name = this.tierFormName().trim();
    if (!name) {
      this.toast.show('Tier name is required.', 'error');
      return;
    }

    const payload = {
      name,
      badgeText: this.tierFormBadgeText().trim() || name,
      badgeColor: this.tierFormBadgeColor().trim() || '#F59E0B',
      iconUrl: this.tierFormIcon().trim() || '👑',
      description: this.tierFormDesc().trim() || undefined,
      displayOrder: this.tierFormOrder() || 1,
      priceUsd: Number(this.tierFormPriceUsd()) || 0,
      maxProductListings: Number(this.tierFormMaxProducts()) || 200,
      isRecommended: this.tierFormIsRecommended()
    };

    this.isSavingTier.set(true);
    const editing = this.editingTier();

    if (editing) {
      this.adminService.updateShopCategory(editing.id, { ...payload, isActive: editing.isActive }).subscribe({
        next: () => {
          this.isSavingTier.set(false);
          this.toast.show(`Tier "${name}" updated successfully.`, 'success');
          this.closeEditingTierModal();
          this.loadData();
        },
        error: (err) => {
          this.isSavingTier.set(false);
          this.toast.show(err?.error?.error || 'Failed to update tier.', 'error');
        }
      });
    } else {
      this.adminService.createShopCategory(payload).subscribe({
        next: () => {
          this.isSavingTier.set(false);
          this.toast.show(`Tier "${name}" created successfully.`, 'success');
          this.closeEditingTierModal();
          this.loadData();
        },
        error: (err) => {
          this.isSavingTier.set(false);
          this.toast.show(err?.error?.error || 'Failed to create tier.', 'error');
        }
      });
    }
  }

  openDeleteTierModal(tier: ShopCategoryDto): void {
    if (!this.canManageTiers()) {
      this.toast.show('Only Management can delete tiers.', 'error');
      return;
    }
    this.tierToDelete.set(tier);
    this.deleteTierModalOpen.set(true);
  }

  closeDeleteTierModal(): void {
    this.deleteTierModalOpen.set(false);
    this.tierToDelete.set(null);
  }

  confirmDeleteTier(): void {
    const tier = this.tierToDelete();
    if (!tier) return;
    this.closeDeleteTierModal();

    this.adminService.deleteShopCategory(tier.id).subscribe({
      next: () => {
        this.toast.show(`Tier "${tier.name}" deleted.`, 'success');
        this.loadData();
      },
      error: (err) => {
        this.toast.show(err?.error?.error || 'Failed to delete tier.', 'error');
      }
    });
  }

  deleteTier(tier: ShopCategoryDto): void {
    this.openDeleteTierModal(tier);
  }

  // --- Tier Upgrade Request Approval / Rejection ---
  approveTierUpgrade(req: TierUpgradeRequest): void {
    this.actionInProgress.set(req.id);

    this.adminService.approveTierUpgradeRequest(req.id).subscribe({
      next: (res: any) => {
        this.actionInProgress.set(null);
        const newTier = res?.currentTier || req.requestedTier || req.badgeText;
        // Optimistic local update — never wait on full loadData (that was wiping the table)
        this.tierRequests.update(list =>
          list.map(r =>
            r.id === req.id
              ? {
                  ...r,
                  status: 'Approved' as const,
                  currentTier: newTier || r.currentTier,
                  maxProductListings: res?.maxProductListings ?? r.maxProductListings
                }
              : r
          )
        );
        this.toast.show(res?.message || `Tier upgrade to ${req.requestedTier} approved for "${req.shopName}"!`, 'success');
        // Soft refresh tiers only (keep UI if refresh glitches)
        this.reloadTierRequests();
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to approve tier upgrade request.', 'error');
      }
    });
  }

  rejectTierUpgrade(req: TierUpgradeRequest): void {
    this.actionInProgress.set(req.id);
    this.adminService.rejectTierUpgradeRequest(req.id, 'Upgrade request rejected by admin.').subscribe({
      next: (res) => {
        this.actionInProgress.set(null);
        this.tierRequests.update(list =>
          list.map(r => (r.id === req.id ? { ...r, status: 'Rejected' as const } : r))
        );
        this.toast.show(res?.message || `Tier upgrade request for "${req.shopName}" has been rejected.`, 'info');
        this.reloadTierRequests();
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to reject tier upgrade request.', 'error');
      }
    });
  }

  setTierStatusFilter(status: 'ALL' | 'Pending' | 'Approved' | 'Rejected'): void {
    this.tierStatusFilter.set(status);
  }

  setTierPlanFilter(plan: string): void {
    this.tierPlanFilter.set(plan || 'ALL');
  }

  tierCapacityLabel(req: TierUpgradeRequest): string {
    if (req.maxProductListings && req.maxProductListings > 0) {
      return req.maxProductListings.toLocaleString();
    }
    const t = (req.requestedTier || '').toLowerCase();
    if (t.includes('diamond') || t.includes('plat')) return '5,000';
    if (t.includes('gold')) return '1,000';
    return '200';
  }

  private tierShopKey(r: TierUpgradeRequest): string {
    const id = String(r.shopId || '').trim();
    if (id && id !== '00000000-0000-0000-0000-000000000000') return `id:${id}`;
    return `name:${(r.shopName || '').trim().toLowerCase()}`;
  }

  tierHistoryCount(req: TierUpgradeRequest): number {
    const key = this.tierShopKey(req);
    return this.tierRequests().filter(r => this.tierShopKey(r) === key).length;
  }

  openTierHistory(req: TierUpgradeRequest): void {
    this.tierHistoryShop.set(req);
    this.tierHistoryModalOpen.set(true);
  }

  closeTierHistory(): void {
    this.tierHistoryModalOpen.set(false);
    this.tierHistoryShop.set(null);
  }

  /** Every shop starts on Bronze (Free) before any upgrade. */
  tierHistoryStartLabel(): string {
    return 'Bronze (Free)';
  }

  deleteTierUpgrade(req: TierUpgradeRequest): void {
    this.actionInProgress.set(req.id);
    this.adminService.deleteTierUpgradeRequest(req.id).subscribe({
      next: (res) => {
        this.actionInProgress.set(null);
        this.tierRequests.update(list => list.filter(r => r.id !== req.id));
        this.toast.show(res?.message || `Tier upgrade request for "${req.shopName}" removed.`, 'info');
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to remove tier upgrade request.', 'error');
      }
    });
  }
}
