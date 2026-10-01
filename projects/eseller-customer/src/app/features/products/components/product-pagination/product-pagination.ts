import { Component, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-product-pagination',
  imports: [],
  templateUrl: './product-pagination.html',
  styleUrl: './product-pagination.css'
})
export class ProductPagination {
  // Inputs
  readonly pageNumber = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly totalCount = input<number>(0);

  // Outputs
  readonly pageChange = output<number>();

  // Computed page buttons
  readonly visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.pageNumber();

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];

    // Always include page 1
    pages.push(1);

    if (current > 3) {
      pages.push('...');
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push('...');
    }

    // Always include last page
    pages.push(total);

    return pages;
  });

  onPageClick(page: number | string): void {
    if (typeof page === 'number' && page !== this.pageNumber()) {
      this.pageChange.emit(page);
    }
  }

  onPrev(): void {
    if (this.pageNumber() > 1) {
      this.pageChange.emit(this.pageNumber() - 1);
    }
  }

  onNext(): void {
    if (this.pageNumber() < this.totalPages()) {
      this.pageChange.emit(this.pageNumber() + 1);
    }
  }
}
