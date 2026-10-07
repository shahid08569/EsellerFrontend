import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService, OrderDto } from '../../../core/services/seller.service';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { TablePagination } from '../../../shared/components/table-pagination/table-pagination';

interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  orders: OrderDto[];
}

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TablePagination, SkeletonLayout],
  templateUrl: './customer-list.html'
})
export class CustomerList implements OnInit {
  private readonly sellerSvc = inject(SellerService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly customers = signal<CustomerProfile[]>([]);
  readonly searchTerm = signal<string>('');
  readonly selectedCustomer = signal<CustomerProfile | null>(null);

  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 25, 50];

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.isLoading.set(true);
    this.sellerSvc.getSellerOrders(1, 100).subscribe({
      next: (res: any) => {
        const orders: OrderDto[] = Array.isArray(res) ? res : (res?.items ?? []);
        const custMap = new Map<string, CustomerProfile>();

        orders.forEach((o, index) => {
          const key = o.customerEmail || o.customerPhone || o.customerName || `cust-${index}`;
          const amount = Number(o.totalAmount) || 0;

          if (!custMap.has(key)) {
            custMap.set(key, {
              id: key,
              name: o.customerName || 'Verified Buyer',
              email: o.customerEmail || 'No email provided',
              phone: o.customerPhone || 'N/A',
              city: o.city || 'Pakistan',
              totalOrders: 1,
              totalSpent: amount,
              lastOrderDate: o.createdAt,
              orders: [o]
            });
          } else {
            const c = custMap.get(key)!;
            c.totalOrders += 1;
            c.totalSpent += amount;
            c.orders.push(o);
            if (new Date(o.createdAt) > new Date(c.lastOrderDate)) {
              c.lastOrderDate = o.createdAt;
            }
          }
        });

        this.customers.set(Array.from(custMap.values()));
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.show('Failed to load customers', 'error');
      }
    });
  }

  readonly filteredCustomers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.customers();
    if (!term) return list;
    return list.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      c.city.toLowerCase().includes(term)
    );
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredCustomers().length / this.pageSize())));

  readonly pagedCustomers = computed(() => {
    const list = this.filteredCustomers();
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

  viewCustomer(c: CustomerProfile): void {
    this.selectedCustomer.set(c);
  }

  closeModal(): void {
    this.selectedCustomer.set(null);
  }
}
