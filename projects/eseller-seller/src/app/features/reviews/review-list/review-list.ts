import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService, ReviewDto, ShopDto } from '../../../core/services/seller.service';
import { SkeletonLayout } from 'eseller-shared';

@Component({
  selector: 'app-review-list',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
  templateUrl: './review-list.html'
})
export class ReviewList implements OnInit {
  private readonly sellerSvc = inject(SellerService);

  readonly isLoading = signal<boolean>(true);
  readonly shop = signal<ShopDto | null>(null);
  readonly reviews = signal<ReviewDto[]>([]);
  readonly selectedRatingFilter = signal<number | null>(null);
  readonly searchTerm = signal<string>('');

  ngOnInit(): void {
    this.loadReviews();
  }

  loadReviews(): void {
    this.isLoading.set(true);
    this.sellerSvc.getMyShop().subscribe({
      next: (s) => {
        this.shop.set(s);
        if (s?.id) {
          // Fetch products first to query reviews
          this.sellerSvc.getMyProducts(1, 20, undefined, s.id).subscribe({
            next: (pRes: any) => {
              const products = pRes?.items || [];
              if (products.length === 0) {
                this.isLoading.set(false);
                return;
              }

              const allReviews: ReviewDto[] = [];
              let completed = 0;

              products.forEach((p: any) => {
                this.sellerSvc.getProductReviews(p.id).subscribe({
                  next: (rRes: any) => {
                    const list = Array.isArray(rRes) ? rRes : (rRes?.items || []);
                    list.forEach((r: any) => {
                      allReviews.push({
                        id: r.id,
                        productId: p.id,
                        productName: p.name,
                        customerName: r.customerName || 'Verified Buyer',
                        rating: r.rating || 5,
                        title: r.title,
                        comment: r.comment || '',
                        createdAt: r.createdAt || new Date().toISOString(),
                        isApproved: r.isApproved ?? true
                      });
                    });
                    completed++;
                    if (completed >= products.length) {
                      this.reviews.set(allReviews);
                      this.isLoading.set(false);
                    }
                  },
                  error: () => {
                    completed++;
                    if (completed >= products.length) {
                      this.reviews.set(allReviews);
                      this.isLoading.set(false);
                    }
                  }
                });
              });
            },
            error: () => this.isLoading.set(false)
          });
        } else {
          this.isLoading.set(false);
        }
      },
      error: () => this.isLoading.set(false)
    });
  }

  readonly filteredReviews = computed(() => {
    let list = this.reviews();
    const rating = this.selectedRatingFilter();
    const term = this.searchTerm().trim().toLowerCase();

    if (rating !== null) {
      list = list.filter(r => r.rating === rating);
    }

    if (term) {
      list = list.filter(r =>
        (r.productName && r.productName.toLowerCase().includes(term)) ||
        (r.comment && r.comment.toLowerCase().includes(term)) ||
        (r.customerName && r.customerName.toLowerCase().includes(term))
      );
    }

    return list;
  });

  readonly averageRating = computed(() => {
    const list = this.reviews();
    if (!list.length) return this.shop()?.rating ?? 5.0;
    const sum = list.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / list.length) * 10) / 10;
  });
}
