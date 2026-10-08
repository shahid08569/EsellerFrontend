import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SellerService } from '../../../core/services/seller.service';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { TablePagination } from '../../../shared/components/table-pagination/table-pagination';
import { ImageUrlPipe } from '../../../shared/pipes/image-url.pipe';

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

type OrderTab = 'all' | 'pending' | 'confirmed' | 'processing' | 'ontheway' | 'delivered' | 'cancelled';

const MERCHANT_COMMISSION_RATE = 0.20;

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, TablePagination, ImageUrlPipe, SkeletonLayout],
  templateUrl: './order-list.html'
})
export class OrderList implements OnInit {
  private readonly sellerSvc = inject(SellerService);
  private readonly toast = inject(ToastService);

  readonly loading = signal<boolean>(true);
  readonly orders = signal<Order[]>([]);
  readonly activeTab = signal<OrderTab>('all');
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 25, 50];
  readonly detailOrder = signal<Order | null>(null);

  private statusKey(status: string): string {
    return (status || '').toLowerCase().replace(/[\s_-]/g, '');
  }

  private matchesTab(order: Order, tab: OrderTab): boolean {
    const s = this.statusKey(order.status);
    switch (tab) {
      case 'pending':
        return s === 'pending' || s === '1';
      case 'confirmed':
        return s === 'confirmed' || s === '2';
      case 'processing':
        return s === 'processing' || s === '3';
      case 'ontheway':
        return s === 'ontheway' || s === 'packed' || s === 'shipped' || s === 'outfordelivery' || s === '4' || s === '5' || s === '6';
      case 'delivered':
        return s === 'delivered' || s === '7';
      case 'cancelled':
        return ['cancelled', 'returned', 'returnrequested', 'refundpending', 'refunded', '8', '9', '10', '11', '12'].includes(s);
      default:
        return true;
    }
  }

  readonly tabCounts = computed(() => {
    const list = this.orders();
    const n = (tab: OrderTab) => list.filter(o => this.matchesTab(o, tab)).length;
    return {
      all: list.length,
      pending: n('pending'),
      confirmed: n('confirmed'),
      processing: n('processing'),
      ontheway: n('ontheway'),
      delivered: n('delivered'),
      cancelled: n('cancelled')
    };
  });

  readonly filteredOrders = computed(() => {
    const tab = this.activeTab();
    let list = this.orders().filter(o => this.matchesTab(o, tab));
    list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  });

  readonly totalCount = computed(() => this.filteredOrders().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  readonly paginatedOrders = computed(() => {
    const list = this.filteredOrders();
    const page = Math.min(this.currentPage(), this.totalPages());
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  tabBadgeClass(tab: OrderTab): string {
    return this.activeTab() === tab ? 'es-tab-badge-on-active' : 'es-tab-badge';
  }

  onFilterTabChange(tab: OrderTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);
    this.sellerSvc.getSellerOrders(1, 200).subscribe({
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
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
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

  formatStatus(status: string): string {
    const s = this.statusKey(status);
    if (s === 'packed') return 'Packed';
    if (s === 'ontheway' || s === 'shipped') return 'On the Way';
    if (s === 'outfordelivery') return 'Out for Delivery';
    if (s === 'returnrequested') return 'Return Requested';
    if (s === 'refundpending') return 'Refund Pending';
    if (!status) return '—';
    return status.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  deliveryLabel(status: string): string {
    const s = this.statusKey(status);
    if (s === 'delivered') return 'Delivered';
    if (s === 'shipped' || s === 'outfordelivery' || s === 'ontheway' || s === 'packed') return 'In transit';
    if (s === 'cancelled' || s === 'refunded') return 'Cancelled';
    return 'Pending';
  }

  isPaid(order: Order): boolean {
    return (order.paymentStatus || '').toLowerCase() === 'paid'
      || (order.paymentStatus || '').toLowerCase() === 'completed';
  }

  payoutHint(order: Order): string {
    const s = this.statusKey(order.status);
    if (s === 'delivered') {
      return 'Order delivered. Your 20% share moves from Pending to Available; Management can still adjust amounts.';
    }
    if (!this.isPaid(order)) {
      return 'Your 20% merchant share stays Pending until Management marks payment Paid and delivers the order.';
    }
    return 'Payment marked Paid. 20% stays Pending until delivery; Management can adjust earnings anytime.';
  }
}
