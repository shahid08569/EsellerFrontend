import { Component, input, signal, computed, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewDto } from 'eseller-shared';

@Component({
  selector: 'app-product-reviews',
  imports: [DatePipe, DecimalPipe, FormsModule],
  templateUrl: './product-reviews.html',
  styleUrl: './product-reviews.css'
})
export class ProductReviews {
  readonly reviews = input<ReviewDto[]>([]);
  readonly avgRating = input<number | null>(null);
  readonly totalCount = input<number>(0);
  readonly loading = input<boolean>(false);
  readonly canReview = input<boolean>(false);
  readonly submitting = input<boolean>(false);

  readonly selectedRatingFilter = signal<number | null>(null);
  readonly ratingFilterChange = output<number | null>();
  readonly submitReview = output<{ rating: number; title: string; comment: string }>();

  readonly draftRating = signal(5);
  readonly draftTitle = signal('');
  readonly draftComment = signal('');

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

  setDraftRating(stars: number): void {
    this.draftRating.set(stars);
  }

  onSubmit(): void {
    const rating = this.draftRating();
    if (rating < 1 || rating > 5) return;
    this.submitReview.emit({
      rating,
      title: this.draftTitle().trim(),
      comment: this.draftComment().trim()
    });
  }

  resetForm(): void {
    this.draftRating.set(5);
    this.draftTitle.set('');
    this.draftComment.set('');
  }
}
