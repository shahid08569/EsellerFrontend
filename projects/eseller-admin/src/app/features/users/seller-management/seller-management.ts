import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastService, SkeletonLayout, SearchableSelect, SearchableSelectOption } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminShopkeeperDto, UserLocationLogDto, AdminPartnerDto } from '../../../core/models/admin.models';

@Component({
  selector: 'app-seller-management',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout, SearchableSelect],
  templateUrl: './seller-management.html'
})
export class SellerManagement implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly searchTerm = signal<string>('');
  readonly currentTab = signal<'all' | 'partner-referrals' | 'seller-referrals'>('all');
  readonly statusFilter = signal<'ALL' | 'Approved' | 'Pending' | 'Rejected'>('ALL');
  readonly sortOrder = signal<'newest' | 'oldest'>('newest');
  readonly merchantTypeFilter = signal<'all' | 'direct' | 'partner' | 'seller'>('all');
  readonly actionInProgress = signal<string | null>(null);

  // Sellers data
  readonly sellers = signal<AdminShopkeeperDto[]>([]);

  // Partners data & filter
  readonly partners = signal<AdminPartnerDto[]>([]);
  readonly selectedPartnerFilter = signal<string>('ALL');

  // Pagination
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);

  // Modal State
  readonly detailsModalOpen = signal<boolean>(false);
  readonly selectedSeller = signal<AdminShopkeeperDto | null>(null);
  readonly sellerLoginLogs = signal<UserLocationLogDto[]>([]);
  readonly isLoadingLogs = signal<boolean>(false);

  // Reject Modal
  readonly rejectModalOpen = signal<boolean>(false);
  readonly rejectReason = signal<string>('');
  readonly sellerToReject = signal<AdminShopkeeperDto | null>(null);

  // Delete Seller Modal
  readonly deleteSellerModalOpen = signal<boolean>(false);
  readonly deleteSellerReason = signal<string>('');
  readonly sellerToDelete = signal<AdminShopkeeperDto | null>(null);

  readonly partnerOptions = computed<SearchableSelectOption[]>(() => {
    const opts: SearchableSelectOption[] = [
      { value: 'ALL', label: 'All Partners' }
    ];
    for (const p of this.partners()) {
      opts.push({
        value: p.id,
        label: p.name || p.email,
        sublabel: p.referralCode ? `Code: ${p.referralCode}` : undefined
      });
    }
    return opts;
  });

  ngOnInit(): void {
    this.loadPartners();
    this.route.queryParams.subscribe(params => {
      const tabParam = params['tab'];
      if (tabParam === 'partner-referrals' || tabParam === 'partner-approved') {
        this.currentTab.set('partner-referrals');
      } else if (tabParam === 'seller-referrals') {
        this.currentTab.set('seller-referrals');
      } else {
        this.currentTab.set('all');
      }
      if (params['partnerId']) {
        this.selectedPartnerFilter.set(params['partnerId']);
      }
      this.currentPage.set(1);
    });
    this.loadSellers();
  }

  loadPartners(): void {
    this.adminService.getPartners().subscribe({
      next: (list) => {
        this.partners.set(list || []);
      },
      error: () => {
        this.partners.set([]);
      }
    });
  }

  loadSellers(): void {
    this.isLoading.set(true);
    this.adminService.getShopkeepers().subscribe({
      next: (list: any) => {
        const items = Array.isArray(list) ? list : (list?.items || []);
        this.sellers.set(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.sellers.set([]);
        this.isLoading.set(false);
      }
    });
  }

  // Precise classification: Partner Referral vs Seller Referral vs Direct Platform
  isPartnerReferral = (s: AdminShopkeeperDto) => {
    if (s.partnerId || s.partnerName) return true;
    if (s.referredByCode) {
      const isPartner = this.partners().some(p => p.referralCode && p.referralCode.toLowerCase() === s.referredByCode!.toLowerCase());
      if (isPartner) return true;
    }
    return false;
  };

  isSellerReferral = (s: AdminShopkeeperDto) => {
    if (s.partnerId || s.partnerName) return false;
    if (!s.referredByCode) return false;
    const isPartner = this.partners().some(p => p.referralCode && p.referralCode.toLowerCase() === s.referredByCode!.toLowerCase());
    return !isPartner;
  };

  isDirectSeller = (s: AdminShopkeeperDto) => !this.isPartnerReferral(s) && !this.isSellerReferral(s);

  // Backward compatibility helpers
  isNormalSeller = (s: AdminShopkeeperDto) => this.isDirectSeller(s);
  isReferralSeller = (s: AdminShopkeeperDto) => this.isPartnerReferral(s) || this.isSellerReferral(s);

  readonly directSellers = computed(() => this.sellers().filter(s => this.isDirectSeller(s)));
  readonly partnerReferralSellers = computed(() => this.sellers().filter(s => this.isPartnerReferral(s)));
  readonly sellerReferralSellers = computed(() => this.sellers().filter(s => this.isSellerReferral(s)));
  readonly normalSellers = computed(() => this.directSellers());
  readonly referralSellers = computed(() => this.partnerReferralSellers());

  // Metrics
  readonly totalSellersCount = computed(() => this.sellers().length);
  readonly directCount = computed(() => this.directSellers().length);
  readonly partnerCount = computed(() => this.partnerReferralSellers().length);
  readonly sellerRefCount = computed(() => this.sellerReferralSellers().length);
  readonly approvedCount = computed(() => this.sellers().filter(s => s.status === 'Approved').length);
  readonly partnerApprovedCount = computed(() => this.partnerReferralSellers().length);
  readonly pendingCount = computed(() => this.sellers().filter(s => s.status === 'Pending').length);
  readonly totalRevenue = computed(() => 
    this.sellers().reduce((sum, s) => sum + (s.totalRevenue || 0), 0)
  );

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1);
    this.isLoading.set(true);
    setTimeout(() => this.isLoading.set(false), 180);
  }

  onFilterStatus(status: 'ALL' | 'Approved' | 'Pending' | 'Rejected'): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.isLoading.set(true);
    setTimeout(() => this.isLoading.set(false), 180);
  }

  onSortChange(order: 'newest' | 'oldest'): void {
    this.sortOrder.set(order);
    this.currentPage.set(1);
    this.isLoading.set(true);
    setTimeout(() => this.isLoading.set(false), 180);
  }

  onTypeFilterChange(type: 'all' | 'direct' | 'partner' | 'seller'): void {
    this.merchantTypeFilter.set(type);
    this.currentPage.set(1);
    this.isLoading.set(true);
    setTimeout(() => this.isLoading.set(false), 180);
  }

  onPartnerFilterChange(partnerId: string): void {
    this.selectedPartnerFilter.set(partnerId);
    this.currentPage.set(1);
    this.isLoading.set(true);
    setTimeout(() => this.isLoading.set(false), 180);
  }

  readonly filteredSellers = computed(() => {
    const tab = this.currentTab();
    const term = this.searchTerm().trim().toLowerCase();
    const sort = this.sortOrder();
    const status = this.statusFilter();
    const type = this.merchantTypeFilter();
    const selectedPartnerId = this.selectedPartnerFilter();

    let list: AdminShopkeeperDto[] = [];

    if (tab === 'partner-referrals') {
      list = this.partnerReferralSellers();
      if (selectedPartnerId !== 'ALL') {
        const partnerObj = this.partners().find(p => p.id === selectedPartnerId);
        list = list.filter(s => 
          s.partnerId === selectedPartnerId ||
          (partnerObj?.referralCode && s.referredByCode === partnerObj.referralCode)
        );
      }
    } else if (tab === 'seller-referrals') {
      list = this.sellerReferralSellers();
    } else {
      // 'all' merchants view
      if (type === 'direct') {
        list = this.directSellers();
      } else if (type === 'partner') {
        list = this.partnerReferralSellers();
      } else if (type === 'seller') {
        list = this.sellerReferralSellers();
      } else {
        list = this.sellers();
      }
    }

    // Status filter
    if (status !== 'ALL') {
      list = list.filter(s => s.status === status);
    }

    // Search query
    if (term) {
      list = list.filter(s =>
        (s.name && s.name.toLowerCase().includes(term)) ||
        (s.email && s.email.toLowerCase().includes(term)) ||
        (s.storeName && s.storeName.toLowerCase().includes(term)) ||
        (s.city && s.city.toLowerCase().includes(term)) ||
        (s.phone && s.phone.includes(term)) ||
        (s.partnerName && s.partnerName.toLowerCase().includes(term)) ||
        (s.referredByName && s.referredByName.toLowerCase().includes(term)) ||
        (s.referredByCode && s.referredByCode.toLowerCase().includes(term))
      );
    }

    // Sorting by newest / oldest
    list = [...list].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sort === 'newest' ? timeB - timeA : timeA - timeB;
    });

    return list;
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredSellers().length / this.pageSize()))
  );

  readonly pagedSellers = computed(() => {
    const list = this.filteredSellers();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  // View Details & Login Activity Modal
  openDetailsModal(seller: AdminShopkeeperDto): void {
    this.selectedSeller.set(seller);
    this.sellerLoginLogs.set([]);
    this.detailsModalOpen.set(true);
    this.isLoadingLogs.set(true);

    this.adminService.getShopkeeperLogins(seller.id).subscribe({
      next: (logs) => {
        this.sellerLoginLogs.set(logs || []);
        this.isLoadingLogs.set(false);
      },
      error: () => {
        this.sellerLoginLogs.set([]);
        this.isLoadingLogs.set(false);
      }
    });
  }

  closeDetailsModal(): void {
    this.detailsModalOpen.set(false);
    this.selectedSeller.set(null);
    this.sellerLoginLogs.set([]);
  }

  // Approve
  approveSeller(seller: AdminShopkeeperDto): void {
    this.actionInProgress.set(seller.id);
    this.adminService.approveShopkeeper(seller.id).subscribe({
      next: () => {
        this.actionInProgress.set(null);
        this.toast.show(`Store "${seller.storeName || seller.name}" approved successfully!`, 'success');
        this.loadSellers();
        if (this.selectedSeller()?.id === seller.id) {
          this.closeDetailsModal();
        }
      },
      error: (err: any) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to approve seller', 'error');
      }
    });
  }

  // Open Reject Modal
  openRejectModal(seller: AdminShopkeeperDto): void {
    this.sellerToReject.set(seller);
    this.rejectReason.set('');
    this.rejectModalOpen.set(true);
  }

  closeRejectModal(): void {
    this.rejectModalOpen.set(false);
    this.sellerToReject.set(null);
    this.rejectReason.set('');
  }

  confirmReject(): void {
    const seller = this.sellerToReject();
    const reason = this.rejectReason().trim();
    if (!seller || !reason) {
      this.toast.show('Please provide a reason for rejection.', 'warning');
      return;
    }

    this.actionInProgress.set(seller.id);
    this.adminService.rejectShopkeeper(seller.id, reason).subscribe({
      next: () => {
        this.actionInProgress.set(null);
        this.toast.show(`Store "${seller.storeName}" rejected.`, 'info');
        this.closeRejectModal();
        this.loadSellers();
        if (this.selectedSeller()?.id === seller.id) {
          this.closeDetailsModal();
        }
      },
      error: (err: any) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to reject seller', 'error');
      }
    });
  }

  // Toggle Account Active / Suspended
  toggleAccountStatus(seller: AdminShopkeeperDto): void {
    const nextState = !seller.isActive;
    this.actionInProgress.set(seller.id);
    this.adminService.setShopkeeperStatus(seller.id, nextState).subscribe({
      next: () => {
        this.actionInProgress.set(null);
        this.toast.show(`Account for "${seller.name}" is now ${nextState ? 'Active' : 'Suspended'}.`, 'success');
        this.loadSellers();
      },
      error: (err: any) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to update account status', 'error');
      }
    });
  }

  openChatWithSeller(seller: AdminShopkeeperDto): void {
    const targetId = seller.shopId || seller.id;
    this.router.navigate(['/chat'], { queryParams: { targetId: targetId, name: seller.storeName || seller.name } });
  }

  openDeleteModal(seller: AdminShopkeeperDto): void {
    this.sellerToDelete.set(seller);
    this.deleteSellerReason.set('');
    this.deleteSellerModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteSellerModalOpen.set(false);
    this.sellerToDelete.set(null);
    this.deleteSellerReason.set('');
  }

  confirmDeleteSeller(): void {
    const seller = this.sellerToDelete();
    const reason = this.deleteSellerReason().trim();
    if (!seller) return;
    if (!reason) {
      this.toast.show('Please provide a reason for deleting this seller account.', 'error');
      return;
    }

    this.actionInProgress.set(seller.id);
    this.closeDeleteModal();

    this.adminService.deleteShopkeeper(seller.id, reason).subscribe({
      next: () => {
        this.actionInProgress.set(null);
        this.toast.show(`Seller "${seller.name}" has been permanently removed.`, 'success');
        this.loadSellers();
        if (this.selectedSeller()?.id === seller.id) {
          this.closeDetailsModal();
        }
      },
      error: (err: any) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to delete seller', 'error');
      }
    });
  }

  getGoogleMapsUrl(lat?: number | null, lng?: number | null): string {
    if (lat == null || lng == null) return '#';
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
}
