import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SellerService } from '../../../core/services/seller.service';
import { ToastService } from 'eseller-shared';
import { TablePagination } from '../../../shared/components/table-pagination/table-pagination';

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  imageUrl?: string;
}

interface Order {
  id: string;
  orderRequestId?: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  city?: string | null;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  merchantProfit?: number;
  totalAmount: number;
  totalItems: number;
  createdAt: string;
  items: OrderItem[];
}

const MERCHANT_COMMISSION_RATE = 0.20;

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, TablePagination],
  templateUrl: './order-list.html'
})
export class OrderList implements OnInit {
  private readonly sellerSvc = inject(SellerService);
  private readonly toast = inject(ToastService);

  readonly loading = signal<boolean>(true);
  readonly orders = signal<Order[]>([]);
  readonly currentPage = signal<number>(1);
  readonly totalCount = signal<number>(0);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 25, 50];
  readonly detailOrder = signal<Order | null>(null);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);
    this.sellerSvc.getSellerOrders(this.currentPage(), this.pageSize()).subscribe({
      next: (res: any) => {
        const raw: any[] = Array.isArray(res) ? res : (res?.items ?? []);
        const items: Order[] = raw.map((o) => {
          const total = Number(o.totalAmount) || 0;
          return {
            id: o.id,
            orderRequestId: o.orderRequestId || o.orderRequestID,
            orderNumber: o.orderNumber,
            customerName: o.customerName,
            customerPhone: o.customerPhone,
            shippingAddress: o.shippingAddress,
            city: o.city,
            status: o.status,
            paymentStatus: o.paymentStatus || 'Pending',
            paymentMethod: o.paymentMethod || 'Cash on delivery',
            merchantProfit: Number(o.merchantProfit) || Math.round(total * MERCHANT_COMMISSION_RATE * 100) / 100,
            totalAmount: total,
            totalItems: Number(o.totalItems) || 0,
            createdAt: o.createdAt,
            items: (o.items || []).map((it: any) => ({
              productName: it.productName || it.productNameSnapshot || 'Item',
              quantity: Number(it.quantity) || 1,
              unitPrice: Number(it.unitPrice ?? it.unitPriceSnapshot) || 0,
              totalPrice: Number(it.totalPrice ?? it.totalPriceSnapshot) || 0,
              imageUrl: it.imageUrl
            }))
          };
        });
        this.orders.set(items);
        this.totalCount.set(Array.isArray(res) ? items.length : (res?.totalCount ?? items.length));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.show(
          (typeof err?.error === 'string' ? err.error : '') || 'Failed to load orders',
          'error'
        );
      }
    });
  }

  getCommission(amount: number): number {
    return Math.round((Number(amount) || 0) * MERCHANT_COMMISSION_RATE * 100) / 100;
  }

  openDetail(order: Order): void {
    this.detailOrder.set(order);
  }

  closeDetail(): void {
    this.detailOrder.set(null);
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.currentPage()) {
      this.currentPage.set(page);
      this.loadOrders();
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadOrders();
  }

  truncateId(id: string): string {
    return id ? id.substring(0, 8).toUpperCase() : '';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  deliveryLabel(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'delivered') return 'Delivered';
    if (s === 'shipped' || s === 'outfordelivery') return 'In transit';
    if (s === 'cancelled' || s === 'refunded') return 'Cancelled';
    return 'Pending';
  }

  isPaid(order: Order): boolean {
    return (order.paymentStatus || '').toLowerCase() === 'paid'
      || (order.paymentStatus || '').toLowerCase() === 'completed';
  }

  payoutHint(order: Order): string {
    const s = (order.status || '').toLowerCase();
    if (s === 'delivered') {
      return 'Order delivered. Your 20% profit credits to wallet when Super Admin confirms delivery.';
    }
    if (!this.isPaid(order)) {
      return 'Payment is pending Super Admin approval. You can view status only.';
    }
    return 'Payment marked Paid by Super Admin. Fulfilment status is also managed by Super Admin.';
  }
}
