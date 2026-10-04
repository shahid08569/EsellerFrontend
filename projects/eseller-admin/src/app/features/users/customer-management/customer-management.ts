import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminCustomerDto, UserLocationLogDto } from '../../../core/models/admin.models';

@Component({
  selector: 'app-customer-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-management.html'
})
export class CustomerManagement implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly searchTerm = signal<string>('');
  readonly statusFilter = signal<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  readonly actionInProgress = signal<string | null>(null);

  // Customers data
  readonly customers = signal<AdminCustomerDto[]>([]);

  // Pagination
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);

  // Modal State
  readonly detailsModalOpen = signal<boolean>(false);
  readonly selectedCustomer = signal<AdminCustomerDto | null>(null);
  readonly customerLoginLogs = signal<UserLocationLogDto[]>([]);
  readonly customerAddresses = signal<any[]>([]);
  readonly recentOrders = signal<any[]>([]);
  readonly isLoadingLogs = signal<boolean>(false);

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.isLoading.set(true);
    this.adminService.getCustomers(1, 200).subscribe({
      next: (res: any) => {
        const items = Array.isArray(res) ? res : (res?.items || []);
        this.customers.set(items);
        this.isLoading.set(false);
      },
      error: () => {
        this.customers.set([]);
        this.isLoading.set(false);
      }
    });
  }

  // Summary Metrics
  readonly totalCustomersCount = computed(() => this.customers().length);
  readonly pendingCustomersCount = computed(() =>
    this.customers().filter((c) => (c.status || 'Approved') === 'Pending').length
  );
  readonly approvedCustomersCount = computed(() =>
    this.customers().filter((c) => (c.status || 'Approved') === 'Approved').length
  );
  readonly activeCustomersCount = computed(() => this.customers().filter(c => c.isActive !== false).length);
  readonly suspendedCustomersCount = computed(() => this.customers().filter(c => c.isActive === false).length);
  readonly totalCustomerSpend = computed(() =>
    this.customers().reduce((sum, c) => sum + (c.totalSpent || 0), 0)
  );

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1);
  }

  onFilterStatus(status: 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'SUSPENDED'): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
  }

  readonly filteredCustomers = computed(() => {
    let list = this.customers();
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();

    if (status === 'PENDING') {
      list = list.filter((c) => (c.status || '') === 'Pending');
    } else if (status === 'APPROVED') {
      list = list.filter((c) => (c.status || 'Approved') === 'Approved');
    } else if (status === 'REJECTED') {
      list = list.filter((c) => (c.status || '') === 'Rejected');
    } else if (status === 'ACTIVE') {
      list = list.filter(c => c.isActive !== false);
    } else if (status === 'SUSPENDED') {
      list = list.filter(c => c.isActive === false);
    }

    if (term) {
      list = list.filter(c =>
        (c.name && c.name.toLowerCase().includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        (c.phone && c.phone.includes(term)) ||
        (c.lastLoginCity && c.lastLoginCity.toLowerCase().includes(term))
      );
    }

    return list;
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredCustomers().length / this.pageSize()))
  );

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

  // View Customer Details & Geolocation Activity Modal
  openDetailsModal(customer: AdminCustomerDto): void {
    this.selectedCustomer.set(customer);
    this.customerLoginLogs.set([]);
    this.customerAddresses.set([]);
    this.recentOrders.set([]);
    this.detailsModalOpen.set(true);
    this.isLoadingLogs.set(true);

    // Fetch full details and logs
    this.adminService.getCustomerDetails(customer.id).subscribe({
      next: (details) => {
        if (details) {
          this.customerLoginLogs.set(details.locationHistory || []);
          this.customerAddresses.set(details.addresses || []);
          this.recentOrders.set(details.recentOrders || []);
        }
        this.isLoadingLogs.set(false);
      },
      error: () => {
        // Fallback to getCustomerLogins
        this.adminService.getCustomerLogins(customer.id).subscribe({
          next: (logs) => {
            this.customerLoginLogs.set(logs || []);
            this.isLoadingLogs.set(false);
          },
          error: () => {
            this.customerLoginLogs.set([]);
            this.isLoadingLogs.set(false);
          }
        });
      }
    });
  }

  closeDetailsModal(): void {
    this.detailsModalOpen.set(false);
    this.selectedCustomer.set(null);
    this.customerLoginLogs.set([]);
    this.customerAddresses.set([]);
    this.recentOrders.set([]);
  }

  approveCustomer(customer: AdminCustomerDto): void {
    this.actionInProgress.set(customer.id);
    this.adminService.approveCustomer(customer.id).subscribe({
      next: () => {
        this.actionInProgress.set(null);
        this.toast.show(`Customer "${customer.name}" approved.`, 'success');
        this.loadCustomers();
      },
      error: (err: any) => {
        this.actionInProgress.set(null);
        this.toast.show(
          (typeof err?.error === 'string' ? err.error : '') || 'Failed to approve customer',
          'error'
        );
      }
    });
  }

  rejectCustomer(customer: AdminCustomerDto): void {
    const reason = window.prompt('Rejection reason (optional):') ?? undefined;
    this.actionInProgress.set(customer.id);
    this.adminService.rejectCustomer(customer.id, reason || undefined).subscribe({
      next: () => {
        this.actionInProgress.set(null);
        this.toast.show(`Customer "${customer.name}" rejected.`, 'success');
        this.loadCustomers();
      },
      error: (err: any) => {
        this.actionInProgress.set(null);
        this.toast.show(
          (typeof err?.error === 'string' ? err.error : '') || 'Failed to reject customer',
          'error'
        );
      }
    });
  }

  // Toggle Customer Active / Suspended
  toggleCustomerStatus(customer: AdminCustomerDto): void {
    const nextState = !customer.isActive;
    this.actionInProgress.set(customer.id);
    this.adminService.setCustomerStatus(customer.id, nextState).subscribe({
      next: () => {
        this.actionInProgress.set(null);
        this.toast.show(`Customer "${customer.name}" is now ${nextState ? 'Active' : 'Suspended'}.`, 'success');
        this.loadCustomers();
      },
      error: (err: any) => {
        this.actionInProgress.set(null);
        this.toast.show(
          (typeof err?.error === 'string' ? err.error : '') || 'Failed to update customer status',
          'error'
        );
      }
    });
  }

  getGoogleMapsUrl(lat?: number | null, lng?: number | null): string {
    if (lat == null || lng == null) return '#';
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
}
