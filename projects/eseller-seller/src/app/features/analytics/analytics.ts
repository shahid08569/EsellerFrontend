import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SellerService, ShopDto, OrderDto } from '../../core/services/seller.service';
import { SkeletonLayout } from 'eseller-shared';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, SkeletonLayout],
  templateUrl: './analytics.html'
})
export class Analytics implements OnInit {
  private readonly sellerSvc = inject(SellerService);

  readonly isLoading = signal<boolean>(true);
  readonly shop = signal<ShopDto | null>(null);
  readonly totalOrders = signal<number>(0);
  readonly totalRevenue = signal<number>(0);
  readonly averageOrderValue = signal<number>(0);
  readonly topProducts = signal<{ name: string; sales: number; count: number }[]>([]);
  readonly cityDemographics = signal<{ city: string; count: number; percent: number }[]>([]);

  ngOnInit(): void {
    this.sellerSvc.getMyShop().subscribe({
      next: (s) => {
        this.shop.set(s);
        this.loadOrders();
      },
      error: () => this.isLoading.set(false)
    });
  }

  private loadOrders(): void {
    this.sellerSvc.getSellerOrders(1, 100).subscribe({
      next: (res: any) => {
        const orders: OrderDto[] = Array.isArray(res) ? res : (res?.items ?? []);
        this.totalOrders.set(orders.length);

        const totalRev = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
        this.totalRevenue.set(totalRev);
        this.averageOrderValue.set(orders.length ? Math.round(totalRev / orders.length) : 0);

        // Compute top products from order items
        const productMap = new Map<string, { sales: number; count: number }>();
        const cityMap = new Map<string, number>();

        orders.forEach(o => {
          const city = (o.city || 'Other').trim();
          cityMap.set(city, (cityMap.get(city) || 0) + 1);

          (o.items || []).forEach(it => {
            const existing = productMap.get(it.productName) || { sales: 0, count: 0 };
            existing.count += (it.quantity || 1);
            existing.sales += (it.quantity || 1) * (it.unitPrice || 0);
            productMap.set(it.productName, existing);
          });
        });

        // Top 5 products
        const topList = Array.from(productMap.entries()).map(([name, stat]) => ({
          name,
          sales: stat.sales,
          count: stat.count
        })).sort((a, b) => b.sales - a.sales).slice(0, 5);
        this.topProducts.set(topList);

        // City demographics
        const totalCityCount = orders.length || 1;
        const cityList = Array.from(cityMap.entries()).map(([city, count]) => ({
          city,
          count,
          percent: Math.round((count / totalCityCount) * 100)
        })).sort((a, b) => b.count - a.count).slice(0, 5);
        this.cityDemographics.set(cityList);

        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }
}
