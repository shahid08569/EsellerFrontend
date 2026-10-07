import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService, CouponDto, ShopDto } from '../../../core/services/seller.service';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { TablePagination } from '../../../shared/components/table-pagination/table-pagination';

@Component({
  selector: 'app-coupon-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TablePagination, SkeletonLayout],
  templateUrl: './coupon-list.html'
})
export class CouponList implements OnInit {
  private readonly sellerSvc = inject(SellerService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly shop = signal<ShopDto | null>(null);
  readonly coupons = signal<CouponDto[]>([]);
  readonly searchTerm = signal<string>('');

  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 25, 50];

  // Create Coupon Modal
  readonly createModalOpen = signal<boolean>(false);
  readonly code = signal<string>('');
  readonly type = signal<number>(1); // 1 = Percentage, 2 = Fixed
  readonly value = signal<number>(15);
  readonly minOrderAmount = signal<number>(1000);
  readonly expiryDate = signal<string>(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  readonly usageLimit = signal<number>(100);
  readonly isSubmitting = signal<boolean>(false);

  ngOnInit(): void {
    this.loadCoupons();
  }

  loadCoupons(): void {
    this.isLoading.set(true);
    this.sellerSvc.getMyShop().subscribe({
      next: (s) => {
        this.shop.set(s);
        this.sellerSvc.getCoupons().subscribe({
          next: (cRes) => {
            const list = Array.isArray(cRes) ? cRes : (cRes?.items || []);
            this.coupons.set(list);
            this.isLoading.set(false);
          },
          error: () => {
            this.isLoading.set(false);
            this.toast.show('Failed to load coupons', 'error');
          }
        });
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.show('Failed to load merchant profile', 'error');
      }
    });
  }

  readonly filteredCoupons = computed(() => {
    const term = this.searchTerm().trim().toUpperCase();
    const list = this.coupons();
    if (!term) return list;
    return list.filter(c => c.code.toUpperCase().includes(term));
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredCoupons().length / this.pageSize())));

  readonly pagedCoupons = computed(() => {
    const list = this.filteredCoupons();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  onFilterChange(): void {
    this.currentPage.set(1);
  }

  openCreateModal(): void {
    this.code.set('');
    this.value.set(15);
    this.createModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.createModalOpen.set(false);
  }

  createCoupon(): void {
    const code = this.code().trim().toUpperCase();
    if (!code) {
      this.toast.show('Please enter a coupon code', 'error');
      return;
    }

    const val = Number(this.value());
    if (isNaN(val) || val <= 0) {
      this.toast.show('Please enter a valid coupon value', 'error');
      return;
    }

    this.isSubmitting.set(true);
    const payload = {
      code,
      type: Number(this.type()),
      value: val,
      minOrderAmount: Number(this.minOrderAmount()) || null,
      maxDiscount: null,
      expiryDate: new Date(this.expiryDate()).toISOString(),
      usageLimit: Number(this.usageLimit()) || null,
      scopeType: 3, // Shop level
      shopIds: this.shop()?.id ? [this.shop()!.id] : []
    };

    this.sellerSvc.createCoupon(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.toast.show(`Coupon "${code}" created successfully.`, 'success');
        this.closeCreateModal();
        this.loadCoupons();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.toast.show(err?.error?.error || 'Failed to create coupon.', 'error');
      }
    });
  }

  deleteCoupon(c: CouponDto): void {
    if (!confirm(`Delete coupon "${c.code}"?`)) return;

    this.sellerSvc.deleteCoupon(c.id).subscribe({
      next: () => {
        this.coupons.update(list => list.filter(item => item.id !== c.id));
        this.toast.show(`Coupon "${c.code}" removed successfully.`, 'success');
      },
      error: (err) => {
        this.toast.show(err?.error?.error || 'Failed to delete coupon.', 'error');
      }
    });
  }
}
