import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import {
  AuthStore,
  CartService,
  OrderService,
  ToastService,
  OrderRequestListDto,
  OrderRequestDto,
  OrderTrackingDto,
  SkeletonLayout
} from 'eseller-shared';

@Component({
  selector: 'app-orders',
  imports: [CommonModule, FormsModule, RouterLink, SkeletonLayout],
  templateUrl: './orders.html',
  styleUrl: './orders.css'
})
export class Orders implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly authStore = inject(AuthStore);
  private readonly cartService = inject(CartService);
  private readonly orderService = inject(OrderService);
  private readonly toastService = inject(ToastService);

  readonly allOrders = signal<OrderRequestListDto[]>([]);
  readonly loading = signal<boolean>(true);
  readonly activeTab = signal<'ALL' | 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED'>('ALL');
  readonly searchQuery = signal<string>('');

  setActiveTab(tab: string): void {
    this.activeTab.set(tab as any);
  }

  // Modals state
  readonly trackingModalOpen = signal<boolean>(false);
  readonly trackingLoading = signal<boolean>(false);
  readonly selectedTrackingOrder = signal<OrderTrackingDto | null>(null);

  readonly detailsModalOpen = signal<boolean>(false);
  readonly detailsLoading = signal<boolean>(false);
  readonly selectedOrderDetails = signal<OrderRequestDto | null>(null);

  readonly filteredOrders = computed(() => {
    let list = this.allOrders();
    const tab = this.activeTab();
    const query = this.searchQuery().trim().toLowerCase();

    if (tab === 'PENDING') {
      list = list.filter((o) => o.status.toUpperCase().includes('PENDING'));
    } else if (tab === 'CONFIRMED') {
      list = list.filter((o) => o.status.toUpperCase().includes('CONFIRM') || o.status.toUpperCase().includes('PROCESS'));
    } else if (tab === 'SHIPPED') {
      list = list.filter((o) => o.status.toUpperCase().includes('SHIP') || o.status.toUpperCase().includes('DISPATCH'));
    } else if (tab === 'DELIVERED') {
      list = list.filter((o) => o.status.toUpperCase().includes('DELIVER') || o.status.toUpperCase().includes('COMPLETE'));
    }

    if (query) {
      list = list.filter((o) => o.id.toLowerCase().includes(query));
    }

    return list;
  });

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    this.route.queryParams.subscribe((params) => {
      if (params['filter']) {
        const f = params['filter'].toUpperCase();
        if (['ALL', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'].includes(f)) {
          this.activeTab.set(f as any);
        }
      }
      if (params['track']) {
        this.openTrackOrder(params['track']);
      }
    });

    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);
    this.orderService.getMyOrders().subscribe({
      next: (res) => {
        this.allOrders.set(res.items || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  openTrackOrder(orderId: string): void {
    this.trackingModalOpen.set(true);
    this.trackingLoading.set(true);
    this.orderService.getOrderTracking(orderId).subscribe({
      next: (tracking) => {
        this.selectedTrackingOrder.set(tracking);
        this.trackingLoading.set(false);
      },
      error: () => {
        this.trackingLoading.set(false);
      }
    });
  }

  closeTrackingModal(): void {
    this.trackingModalOpen.set(false);
    this.selectedTrackingOrder.set(null);
  }

  openOrderDetails(orderId: string): void {
    this.detailsModalOpen.set(true);
    this.detailsLoading.set(true);
    this.orderService.getOrderById(orderId).subscribe({
      next: (order) => {
        this.selectedOrderDetails.set(order);
        this.detailsLoading.set(false);
      },
      error: () => {
        this.detailsLoading.set(false);
      }
    });
  }

  closeOrderDetailsModal(): void {
    this.detailsModalOpen.set(false);
    this.selectedOrderDetails.set(null);
  }

  chatWithSeller(_orderId?: string): void {
    this.router.navigate(['/chat'], { queryParams: { support: '1' } });
  }

  reorder(order: OrderRequestDto): void {
    if (!order.items || order.items.length === 0) return;
    for (const item of order.items) {
      this.cartService.addItem({
        productId: item.productId,
        productSlug: '',
        name: item.productNameSnapshot,
        imageUrl: null,
        shopId: item.shopId,
        shopName: item.shopName,
        price: item.priceAtOrder || item.unitPriceSnapshot,
        quantity: item.quantity,
        variantId: item.productVariantId,
        variantName: item.variantAttributesSnapshot || null,
        sku: item.sku
      });
    }
    this.toastService.show(`Added ${order.items.length} item(s) from order #${order.id} to cart!`, 'success');
    this.router.navigate(['/cart']);
  }

  getStatusBadgeClass(status: string): string {
    const s = status.toUpperCase();
    if (s.includes('PENDING')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (s.includes('CONFIRM') || s.includes('PROCESS')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (s.includes('SHIP') || s.includes('DISPATCH')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (s.includes('DELIVER') || s.includes('COMPLETE')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    return 'bg-gray-50 text-gray-700 border-gray-200';
  }

  getStatusDisplay(status: string): string {
    const s = status.toUpperCase();
    if (s.includes('PENDING')) return 'Pending Seller Confirmation';
    if (s.includes('CONFIRM')) return 'Confirmed by Seller';
    if (s.includes('PROCESS')) return 'Processing / Packed';
    if (s.includes('SHIP') || s.includes('DISPATCH')) return 'Dispatched & On the Way';
    if (s.includes('DELIVER')) return 'Delivered';
    return status;
  }

  getStepStatus(stepIndex: number, currentStatus: string): 'completed' | 'active' | 'pending' {
    const s = currentStatus.toUpperCase();
    let currentStep = 1;
    if (s.includes('DELIVER') || s.includes('COMPLETE')) currentStep = 4;
    else if (s.includes('SHIP') || s.includes('DISPATCH')) currentStep = 3;
    else if (s.includes('CONFIRM') || s.includes('PROCESS')) currentStep = 2;
    else currentStep = 1;

    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'active';
    return 'pending';
  }
}
