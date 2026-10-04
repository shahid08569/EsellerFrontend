import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService, DiscountDto, ShopDto } from '../../../core/services/seller.service';
import { ToastService } from 'eseller-shared';
import { TablePagination } from '../../../shared/components/table-pagination/table-pagination';

@Component({
  selector: 'app-discount-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TablePagination],
  templateUrl: './discount-list.html'
})
export class DiscountList implements OnInit {
  private readonly sellerSvc = inject(SellerService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly shop = signal<ShopDto | null>(null);
  readonly discounts = signal<DiscountDto[]>([]);
  readonly products = signal<any[]>([]);
  readonly searchTerm = signal<string>('');

  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 25, 50];

  // Create Discount Modal
  readonly createModalOpen = signal<boolean>(false);
  readonly scopeType = signal<number>(1); // 1 = Product, 2 = Category, 3 = Shop
  readonly selectedProductId = signal<string>('');
  readonly discountType = signal<number>(1); // 1 = Percentage, 2 = Fixed
  readonly discountValue = signal<number>(10);
  readonly startDate = signal<string>(new Date().toISOString().slice(0, 10));
  readonly endDate = signal<string>(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  readonly isSubmitting = signal<boolean>(false);

  ngOnInit(): void {
    this.loadDiscounts();
  }

  loadDiscounts(): void {
    this.isLoading.set(true);
    this.sellerSvc.getMyShop().subscribe({
      next: (s) => {
        this.shop.set(s);
        if (s?.id) {
          // Fetch products for dropdown
          this.sellerSvc.getMyProducts(1, 100, undefined, s.id).subscribe({
            next: (pRes) => {
              this.products.set(pRes?.items || []);
            },
            error: () => {}
          });

          // Fetch discounts
          this.sellerSvc.getDiscounts().subscribe({
            next: (dRes) => {
              const items = Array.isArray(dRes) ? dRes : (dRes?.items || []);
              this.discounts.set(items);
              this.isLoading.set(false);
            },
            error: () => {
              this.isLoading.set(false);
              this.toast.show('Failed to load discounts', 'error');
            }
          });
        } else {
          this.isLoading.set(false);
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.show('Failed to load merchant profile', 'error');
      }
    });
  }

  readonly filteredDiscounts = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.discounts();
    if (!term) return list;
    return list.filter(d => (d.productName && d.productName.toLowerCase().includes(term)) || (d.name && d.name.toLowerCase().includes(term)));
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredDiscounts().length / this.pageSize())));

  readonly pagedDiscounts = computed(() => {
    const list = this.filteredDiscounts();
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
    this.createModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.createModalOpen.set(false);
  }

  createDiscount(): void {
    const val = Number(this.discountValue());
    if (isNaN(val) || val <= 0) {
      this.toast.show('Please enter a valid discount value', 'error');
      return;
    }

    if (this.discountType() === 1 && (val < 1 || val > 100)) {
      this.toast.show('Percentage discount must be between 1% and 100%', 'error');
      return;
    }

    this.isSubmitting.set(true);
    const payload = {
      productId: this.selectedProductId() || null,
      scopeType: Number(this.scopeType()),
      scopeId: this.shop()?.id || null,
      type: Number(this.discountType()),
      value: val,
      startDate: new Date(this.startDate()).toISOString(),
      endDate: new Date(this.endDate()).toISOString()
    };

    this.sellerSvc.createDiscount(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.toast.show('Discount promotion created successfully.', 'success');
        this.closeCreateModal();
        this.loadDiscounts();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.toast.show(err?.error?.error || 'Failed to create discount promotion.', 'error');
      }
    });
  }

  deleteDiscount(d: DiscountDto): void {
    if (!confirm(`Are you sure you want to remove this discount?`)) return;

    this.sellerSvc.deleteDiscount(d.id).subscribe({
      next: () => {
        this.discounts.update(list => list.filter(item => item.id !== d.id));
        this.toast.show('Discount removed successfully.', 'success');
      },
      error: (err) => {
        this.toast.show(err?.error?.error || 'Failed to delete discount.', 'error');
      }
    });
  }
}
