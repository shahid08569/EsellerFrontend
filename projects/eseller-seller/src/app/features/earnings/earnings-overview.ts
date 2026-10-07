import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SellerService, ShopDto, OrderDto } from '../../core/services/seller.service';
import { forkJoin, of, catchError } from 'rxjs';
import { SkeletonLayout } from 'eseller-shared';

interface TransactionRecord {
  id: string;
  orderId: string;
  date: string;
  grossAmount: number;
  sellerCommission: number;
  status: string;
}

@Component({
  selector: 'app-earnings-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, SkeletonLayout],
  templateUrl: './earnings-overview.html'
})
export class EarningsOverview implements OnInit {
  private readonly sellerSvc = inject(SellerService);

  readonly isLoading = signal<boolean>(true);
  readonly shop = signal<ShopDto | null>(null);
  readonly transactions = signal<TransactionRecord[]>([]);
  readonly commissionRate = signal<number>(20);
  readonly walletAvailable = signal<number>(0);
  readonly walletPending = signal<number>(0);
  readonly walletLoaded = signal<boolean>(false);

  ngOnInit(): void {
    this.loadEarnings();
  }

  loadEarnings(): void {
    this.isLoading.set(true);
    this.sellerSvc.getMyShop().subscribe({
      next: (s) => {
        this.shop.set(s);

        forkJoin({
          wallet: this.sellerSvc.getWalletSummary().pipe(
            catchError(() => of(null))
          ),
          orders: this.sellerSvc.getSellerOrders(1, 100).pipe(
            catchError(() => of({ items: [] }))
          )
        }).subscribe({
          next: ({ wallet, orders }) => {
            if (wallet) {
              this.walletAvailable.set(Number(wallet.availableToWithdraw) || 0);
              this.walletPending.set(Number(wallet.pendingEarnings) || 0);
              if (wallet.merchantSharePercent != null) {
                this.commissionRate.set(Number(wallet.merchantSharePercent) || 20);
              }
              this.walletLoaded.set(true);
            } else {
              this.walletAvailable.set(0);
              this.walletPending.set(0);
              this.walletLoaded.set(false);
            }

            const list: OrderDto[] = Array.isArray(orders) ? orders : ((orders as any)?.items ?? []);
            const rate = this.commissionRate() / 100;

            const txList: TransactionRecord[] = list.map(o => {
              const gross = Number(o.totalAmount) || 0;
              const apiProfit = Number(o.merchantProfit);
              const sellerCommission = Number.isFinite(apiProfit) && apiProfit > 0
                ? apiProfit
                : Math.round(gross * rate * 100) / 100;
              const st = String(o.status || '').toLowerCase();
              return {
                id: o.id,
                orderId: o.id.slice(0, 8),
                date: o.createdAt,
                grossAmount: gross,
                sellerCommission,
                status: st === 'delivered' ? 'Available' : st === 'cancelled' || st === 'refunded' ? 'Closed' : 'Pending'
              };
            });

            this.transactions.set(txList);
            this.isLoading.set(false);
          },
          error: () => this.isLoading.set(false)
        });
      },
      error: () => this.isLoading.set(false)
    });
  }

  readonly totalGrossSales = computed(() =>
    this.transactions()
      .filter(t => t.status !== 'Closed')
      .reduce((sum, t) => sum + t.grossAmount, 0)
  );

  readonly totalSellerEarnings = computed(() =>
    this.transactions()
      .filter(t => t.status !== 'Closed')
      .reduce((sum, t) => sum + t.sellerCommission, 0)
  );

  readonly pendingEarnings = computed(() => {
    if (this.walletLoaded()) {
      return this.walletPending();
    }
    return this.transactions()
      .filter(t => t.status === 'Pending')
      .reduce((sum, t) => sum + t.sellerCommission, 0);
  });

  readonly settledEarnings = computed(() => {
    if (this.walletLoaded()) {
      return this.walletAvailable();
    }
    return this.transactions()
      .filter(t => t.status === 'Available')
      .reduce((sum, t) => sum + t.sellerCommission, 0);
  });

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }
}
