import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore, ToastService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminPermissionService } from '../../../core/services/admin-permission.service';
import { PartnerReferralsDto, PartnerReferredShopDto } from '../../../core/models/admin.models';

@Component({
  selector: 'app-partner-referrals',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SkeletonLayout],
  templateUrl: './partner-referrals.html'
})
export class PartnerReferrals implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);
  readonly authStore = inject(AuthStore);
  readonly permissions = inject(AdminPermissionService);
  private readonly router = inject(Router);

  readonly isLoading = signal<boolean>(true);
  readonly data = signal<PartnerReferralsDto | null>(null);

  // Search & Filters
  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<'all' | 'Approved' | 'Pending' | 'Suspended'>('all');

  // Copy state signals
  readonly isCopiedCode = signal<boolean>(false);
  readonly isCopiedLink = signal<boolean>(false);
  readonly showQrModal = signal<boolean>(false);

  readonly isPartner = computed(() => this.authStore.currentAccount()?.roleType === 'Partner');
  readonly isSuperAdmin = computed(() => this.authStore.currentAccount()?.roleType === 'SuperAdmin');

  // Permissions
  readonly canManageShops = computed(() => this.permissions.has('shops:manage') || this.isSuperAdmin());
  readonly canPlaceOrders = computed(() => this.permissions.has('orders:place') || this.isSuperAdmin());

  readonly filteredShops = computed(() => {
    const list = this.data()?.shops || [];
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();

    return list.filter((shop: PartnerReferredShopDto) => {
      const matchQuery =
        !query ||
        shop.name.toLowerCase().includes(query) ||
        shop.ownerName.toLowerCase().includes(query) ||
        shop.ownerEmail.toLowerCase().includes(query) ||
        (shop.phone && shop.phone.toLowerCase().includes(query));

      const matchStatus =
        status === 'all' ||
        (status === 'Approved' && shop.status === 'Approved' && shop.isActive) ||
        (status === 'Pending' && shop.status === 'Pending') ||
        (status === 'Suspended' && (!shop.isActive || shop.status === 'Rejected'));

      return matchQuery && matchStatus;
    });
  });

  ngOnInit(): void {
    this.loadReferrals();
  }

  loadReferrals(): void {
    this.isLoading.set(true);
    this.adminService.getMyReferrals().subscribe({
      next: (res) => {
        this.data.set(res);
        this.isLoading.set(false);
      },
      error: () => {
        this.toast.show('Failed to load partner referral information.', 'error');
        this.isLoading.set(false);
      }
    });
  }

  copyReferralCode(): void {
    const code = this.data()?.referralCode;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      this.isCopiedCode.set(true);
      this.toast.show(`Partner Referral Code "${code}" copied to clipboard!`, 'success');
      setTimeout(() => this.isCopiedCode.set(false), 2500);
    }).catch(() => {
      this.toast.show('Failed to copy code. Please copy manually.', 'error');
    });
  }

  copyReferralLink(): void {
    const link = this.data()?.referralLink;
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      this.isCopiedLink.set(true);
      this.toast.show('Merchant Registration Link copied to clipboard!', 'success');
      setTimeout(() => this.isCopiedLink.set(false), 2500);
    }).catch(() => {
      this.toast.show('Failed to copy link. Please copy manually.', 'error');
    });
  }

  openShopChat(shop: PartnerReferredShopDto): void {
    this.router.navigate(['/chat'], { queryParams: { targetId: shop.id } });
  }

  openPlaceOrder(shop: PartnerReferredShopDto): void {
    this.router.navigate(['/orders'], { queryParams: { action: 'place', shopId: shop.id } });
  }

  toggleQrModal(): void {
    this.showQrModal.update((v) => !v);
  }

  getQrCodeUrl(): string {
    const link = this.data()?.referralLink || '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(link)}`;
  }
}
