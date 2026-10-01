import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SellerService } from '../../core/services/seller.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html'
})
export class Dashboard implements OnInit {
  private readonly sellerSvc = inject(SellerService);

  readonly loading = signal<boolean>(true);
  readonly shop = signal<any>(null);
  readonly pendingOrders = signal<number>(0);

  ngOnInit(): void {
    this.sellerSvc.getMyShop().subscribe({
      next: (shop) => {
        this.shop.set(shop);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.sellerSvc.getSellerOrders(1, 100).subscribe({
      next: (res: any) => {
        const orders: any[] = Array.isArray(res) ? res : (res?.items ?? []);
        const count = orders.filter((o: any) =>
          o.status?.toLowerCase() === 'pending'
        ).length;
        this.pendingOrders.set(count);
      },
      error: () => {}
    });
  }
}
