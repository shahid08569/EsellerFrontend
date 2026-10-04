import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ToastService } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';

@Component({
  selector: 'app-reports-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports-view.html'
})
export class ReportsView implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly selectedPeriod = signal<string>('30d');
  readonly salesSummary = signal<any>({
    grossSales: 0,
    deliveredRevenue: 0,
    ordersCount: 0,
    averageOrderValue: 0
  });

  readonly topProducts = signal<any[]>([]);
  readonly topSellers = signal<any[]>([]);

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.isLoading.set(true);
    const period = this.selectedPeriod();
    const days = period === '7d' ? 7 : period === '90d' ? 90 : period === 'year' ? 365 : 30;
    const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const toDate = new Date().toISOString().split('T')[0];

    forkJoin({
      sales: this.adminService.getSalesReport(fromDate, toDate),
      topProducts: this.adminService.getTopProducts(fromDate, toDate, 10),
      topSellers: this.adminService.getTopSellers(fromDate, toDate, 10)
    }).subscribe({
      next: (res) => {
        if (res.sales) {
          this.salesSummary.set({
            grossSales: res.sales.totalRevenue || 0,
            deliveredRevenue: res.sales.deliveredRevenue || 0,
            ordersCount: res.sales.totalOrders || 0,
            averageOrderValue: res.sales.averageOrderValue || 0
          });
        }
        const products = Array.isArray(res.topProducts) ? res.topProducts : (res.topProducts as any)?.items || [];
        const sellers = Array.isArray(res.topSellers) ? res.topSellers : (res.topSellers as any)?.items || [];
        this.topProducts.set(products);
        this.topSellers.set(sellers);
        this.isLoading.set(false);
      },
      error: () => {
        this.salesSummary.set({
          grossSales: 0,
          deliveredRevenue: 0,
          ordersCount: 0,
          averageOrderValue: 0
        });
        this.topProducts.set([]);
        this.topSellers.set([]);
        this.isLoading.set(false);
      }
    });
  }

  exportCsv(): void {
    const csvContent = "data:text/csv;charset=utf-8," +
      "Metric,Value\n" +
      `Gross Platform Sales,$ ${this.salesSummary().grossSales}\n` +
      `Delivered Revenue,$ ${this.salesSummary().deliveredRevenue}\n` +
      `Total Orders,${this.salesSummary().ordersCount}\n` +
      `Average Order Value,$ ${this.salesSummary().averageOrderValue}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `platform_sales_report_${this.selectedPeriod()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toast.show('Report exported to CSV', 'success');
  }
}
