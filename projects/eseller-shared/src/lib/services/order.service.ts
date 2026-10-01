import { Injectable, inject } from '@angular/core';
import { Observable, of, catchError, map } from 'rxjs';
import { ApiService } from './api.service';
import {
  OrderRequestListDto,
  OrderRequestDto,
  OrderTrackingDto,
  OrderStatusHistoryDto,
  CreateOrderRequest,
  BuyNowRequest,
  PagedOrdersResult
} from '../models/orders/order.models';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly api = inject(ApiService);

  /**
   * Get current authenticated user's orders (paginated)
   */
  getMyOrders(
    pageNumber: number = 1,
    pageSize: number = 20
  ): Observable<PagedOrdersResult<OrderRequestListDto>> {
    return this.api
      .get<PagedOrdersResult<OrderRequestListDto>>(`orders?pageNumber=${pageNumber}&pageSize=${pageSize}`)
      .pipe(
        catchError(() => {
          // Fallback to local storage if API is unauthenticated or offline
          return of(this.getLocalOrdersAsPaged(pageNumber, pageSize));
        })
      );
  }

  /**
   * Get order details by ID
   */
  getOrderById(id: string): Observable<OrderRequestDto | null> {
    return this.api.get<OrderRequestDto>(`orders/${id}`).pipe(
      catchError(() => {
        // Fallback to local storage lookup
        const local = this.getLocalOrderById(id);
        return of(local);
      })
    );
  }

  /**
   * Get order visual tracking timeline
   */
  getOrderTracking(id: string): Observable<OrderTrackingDto | null> {
    return this.api.get<OrderTrackingDto>(`orders/${id}/tracking`).pipe(
      catchError(() => {
        const local = this.getLocalOrderTracking(id);
        return of(local);
      })
    );
  }

  /**
   * Get order status history
   */
  getOrderStatusHistory(id: string): Observable<OrderStatusHistoryDto[]> {
    return this.api.get<OrderStatusHistoryDto[]>(`orders/${id}/status-history`).pipe(
      catchError(() => of([]))
    );
  }

  /**
   * Create an order from cart
   */
  createOrder(request: CreateOrderRequest): Observable<{ orderId: string; message: string }> {
    return this.api.post<{ orderId: string; message: string }>('orders', request);
  }

  /**
   * Instant single item Buy Now
   */
  buyNow(request: BuyNowRequest): Observable<{ orderId: string; message: string }> {
    return this.api.post<{ orderId: string; message: string }>('orders/buy-now', request);
  }

  /**
   * Sync item to backend cart
   */
  syncCartItem(productVariantId: string, quantity: number): Observable<{ cartItemId: string; message: string }> {
    return this.api.post<{ cartItemId: string; message: string }>('cart/items', {
      productVariantId,
      quantity
    });
  }

  /**
   * Clear backend cart
   */
  clearBackendCart(): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>('cart');
  }

  // ─────────────────────────────────────────────────────────────
  // LOCAL STORAGE FALLBACK HELPERS
  // ─────────────────────────────────────────────────────────────

  private getLocalOrdersAsPaged(
    pageNumber: number,
    pageSize: number
  ): PagedOrdersResult<OrderRequestListDto> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        items: [],
        pageNumber,
        pageSize,
        totalCount: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false
      };
    }

    try {
      const historyStr = window.localStorage.getItem('eseller_orders_history');
      const latestStr = window.localStorage.getItem('eseller_latest_order');
      let orders: any[] = [];

      if (historyStr) {
        orders = JSON.parse(historyStr);
      } else if (latestStr) {
        orders = [JSON.parse(latestStr)];
      }

      const listDtos: OrderRequestListDto[] = orders.map((o) => ({
        id: o.orderRef || o.id || 'ORD-UNKNOWN',
        status: o.status || 'PENDING_SELLER_CONFIRMATION',
        totalAmount: o.totalAmount || 0,
        totalItems: Array.isArray(o.items) ? o.items.length : 1,
        totalShops: 1,
        createdAt: o.createdAt || new Date().toISOString()
      }));

      const start = (pageNumber - 1) * pageSize;
      const paged = listDtos.slice(start, start + pageSize);
      const totalCount = listDtos.length;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        items: paged,
        pageNumber,
        pageSize,
        totalCount,
        totalPages,
        hasPreviousPage: pageNumber > 1,
        hasNextPage: pageNumber < totalPages
      };
    } catch {
      return {
        items: [],
        pageNumber,
        pageSize,
        totalCount: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false
      };
    }
  }

  private getLocalOrderById(id: string): OrderRequestDto | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const historyStr = window.localStorage.getItem('eseller_orders_history');
      const latestStr = window.localStorage.getItem('eseller_latest_order');
      let orders: any[] = [];
      if (historyStr) orders = JSON.parse(historyStr);
      else if (latestStr) orders = [JSON.parse(latestStr)];

      const found = orders.find(
        (o) => (o.orderRef && o.orderRef.toLowerCase() === id.toLowerCase()) || o.id === id
      );
      if (!found) return null;

      return {
        id: found.orderRef || found.id,
        status: found.status || 'PENDING_SELLER_CONFIRMATION',
        totalAmount: found.totalAmount || 0,
        totalItems: Array.isArray(found.items) ? found.items.length : 0,
        items: (found.items || []).map((it: any) => ({
          id: it.id || '',
          productId: it.productId || '',
          productVariantId: it.variantId || '',
          shopId: it.shopId || '',
          shopName: it.shopName || found.shopName || 'Eseller Store',
          shopSlug: '',
          productNameSnapshot: it.name || '',
          sku: it.sku || 'SKU-STD',
          quantity: it.quantity || 1,
          unitPriceSnapshot: it.price || 0,
          totalPriceSnapshot: (it.price || 0) * (it.quantity || 1),
          priceAtOrder: it.price || 0
        })),
        createdAt: found.createdAt || new Date().toISOString(),
        updatedAt: found.createdAt || new Date().toISOString(),
        customerName: found.customer?.fullName,
        customerPhone: found.customer?.phone,
        shippingAddress: found.customer?.address,
        city: found.customer?.city,
        state: found.customer?.state,
        country: found.customer?.country,
        orderNotes: found.customer?.notes
      };
    } catch {
      return null;
    }
  }

  private getLocalOrderTracking(id: string): OrderTrackingDto | null {
    const order = this.getLocalOrderById(id);
    if (!order) return null;

    const timeline: OrderStatusHistoryDto[] = [
      {
        id: 't-1',
        orderRequestId: order.id,
        oldStatus: 'NONE',
        newStatus: 'Order Placed',
        changedByType: 'Customer',
        changedAt: order.createdAt
      }
    ];

    const s = order.status.toUpperCase();
    if (s.includes('CONFIRM') || s.includes('PROCESS') || s.includes('SHIP') || s.includes('DELIVER')) {
      timeline.push({
        id: 't-2',
        orderRequestId: order.id,
        oldStatus: 'Order Placed',
        newStatus: 'Confirmed by Seller',
        changedByType: 'Seller',
        changedAt: new Date(new Date(order.createdAt).getTime() + 1000 * 60 * 30).toISOString()
      });
    }

    if (s.includes('SHIP') || s.includes('DISPATCH') || s.includes('DELIVER')) {
      timeline.push({
        id: 't-3',
        orderRequestId: order.id,
        oldStatus: 'Confirmed by Seller',
        newStatus: 'Dispatched & On the Way',
        changedByType: 'Logistics',
        changedAt: new Date(new Date(order.createdAt).getTime() + 1000 * 60 * 180).toISOString()
      });
    }

    if (s.includes('DELIVER') || s.includes('COMPLETE')) {
      timeline.push({
        id: 't-4',
        orderRequestId: order.id,
        oldStatus: 'Dispatched',
        newStatus: 'Delivered Successfully',
        changedByType: 'Courier',
        changedAt: new Date(new Date(order.createdAt).getTime() + 1000 * 60 * 600).toISOString()
      });
    }

    return {
      orderRequestId: order.id,
      currentStatus: order.status,
      createdAt: order.createdAt,
      timeline
    };
  }
}
