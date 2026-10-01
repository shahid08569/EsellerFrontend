import { Component, input, signal, computed, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ReviewDto } from 'eseller-shared';

@Component({
  selector: 'app-product-reviews',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './product-reviews.html',
  styleUrl: './product-reviews.css'
})
export class ProductReviews {
  // Inputs
  readonly reviews = input<ReviewDto[]>([]);
  readonly avgRating = input<number | null>(null);
  readonly totalCount = input<number>(0);
  readonly loading = input<boolean>(false);

  // Filter by rating
  readonly selectedRatingFilter = signal<number | null>(null);
  readonly ratingFilterChange = output<number | null>();

  // Computed rating breakdown
  readonly ratingBreakdown = computed(() => {
    const list = this.reviews();
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of list) {
      if (counts[r.rating] !== undefined) {
        counts[r.rating]++;
      }
    }
    const total = list.length || 1;
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: counts[stars] || 0,
      percentage: Math.round(((counts[stars] || 0) / total) * 100)
    }));
  });

  onSelectFilter(rating: number | null): void {
    this.selectedRatingFilter.set(rating);
    this.ratingFilterChange.emit(rating);
  }
}
