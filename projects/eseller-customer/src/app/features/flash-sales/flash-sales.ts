import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { HomeService, ProductListDto, ProductCard, EmptyState } from 'eseller-shared';

@Component({
  selector: 'app-flash-sales',
  imports: [CommonModule, RouterLink, ProductCard, EmptyState],
  templateUrl: './flash-sales.html',
  styleUrl: './flash-sales.css'
})
export class FlashSales implements OnInit, OnDestroy {
  private readonly homeService = inject(HomeService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  readonly products = signal<ProductListDto[]>([]);
  readonly loading = signal<boolean>(true);

  // Countdown timer signals
  readonly hours = signal<string>('00');
  readonly minutes = signal<string>('00');
  readonly seconds = signal<string>('00');

  private timerInterval: any = null;

  ngOnInit(): void {
    this.loadFlashSaleProducts();
    this.startCountdown();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  loadFlashSaleProducts(): void {
    this.loading.set(true);
    this.homeService.getFlashSaleProducts(50).subscribe({
      next: (prods) => {
        this.products.set(prods);
        this.loading.set(false);
      },
      error: () => {
        this.products.set([]);
        this.loading.set(false);
      }
    });
  }

  getCountdown(product: ProductListDto): Date | null {
    if (product.badges?.flashSaleEndDate) {
      return new Date(product.badges.flashSaleEndDate);
    }
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay;
  }

  private startCountdown(): void {
    // End time is midnight of today or dynamic
    const update = () => {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const diff = Math.max(0, endOfDay.getTime() - now.getTime());
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      this.hours.set(String(h).padStart(2, '0'));
      this.minutes.set(String(m).padStart(2, '0'));
      this.seconds.set(String(s).padStart(2, '0'));
    };

    update();
    if (typeof window !== 'undefined') {
      this.timerInterval = setInterval(update, 1000);
    }
  }

  goBack(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }
}
