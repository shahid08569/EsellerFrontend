import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService } from '../../../core/services/seller.service';

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
}

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  totalItems: number;
  createdAt: string;
  items: OrderItem[];
  _updating?: boolean;
}

const STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

@Component({
  selector: 'app-order-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './order-list.html'
})
export class OrderList implements OnInit {
  private readonly sellerSvc = inject(SellerService);

  readonly loading = signal<boolean>(true);
  readonly orders = signal<Order[]>([]);
  readonly currentPage = signal<number>(1);
  readonly totalCount = signal<number>(0);
  readonly pageSize = 15;

  readonly statuses = STATUSES;

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);
    this.sellerSvc.getSellerOrders(this.currentPage(), this.pageSize).subscribe({
      next: (res: any) => {
        const items: Order[] = Array.isArray(res) ? res : (res?.items ?? []);
        this.orders.set(items);
        this.totalCount.set(Array.isArray(res) ? items.length : (res?.totalCount ?? items.length));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  changeStatus(order: Order, newStatus: string): void {
    if (order.status === newStatus) return;
    order._updating = true;
    this.sellerSvc.updateOrderStatus(order.id, newStatus).subscribe({
      next: () => {
        order.status = newStatus;
        order._updating = false;
        // refresh signals
        this.orders.set([...this.orders()]);
      },
      error: () => {
        order._updating = false;
        this.orders.set([...this.orders()]);
      }
    });
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadOrders();
    }
  }

  nextPage(): void {
    if (this.currentPage() * this.pageSize < this.totalCount()) {
      this.currentPage.update(p => p + 1);
      this.loadOrders();
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalCount() / this.pageSize);
  }

  truncateId(id: string): string {
    return id ? '#' + id.substring(0, 8).toUpperCase() : '';
  }

  statusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      pending:    'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
      processing: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
      shipped:    'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
      delivered:  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
      cancelled:  'bg-red-50 text-red-700 ring-1 ring-red-200'
    };
    return map[status?.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-PK', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }
}
