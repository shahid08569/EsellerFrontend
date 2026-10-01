import { Component, input, output, computed } from '@angular/core';

export interface ActiveFilterChip {
  id: string;
  type: 'category' | 'brand' | 'price' | 'rating' | 'featured' | 'search';
  label: string;
}

@Component({
  selector: 'app-product-sort-bar',
  imports: [],
  templateUrl: './product-sort-bar.html',
  styleUrl: './product-sort-bar.css'
})
export class ProductSortBar {
  // Title & Info
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  readonly imageUrl = input<string | null>(null);

  // Pagination & Counts
  readonly totalCount = input<number>(0);
  readonly pageNumber = input<number>(1);
  readonly pageSize = input<number>(12);
  readonly sortBy = input<string>('newest');
  readonly viewMode = input<'grid' | 'list'>('grid');
  readonly activeFiltersCount = input<number>(0);
  readonly activeChips = input<ActiveFilterChip[]>([]);

  // Outputs
  readonly sortChange = output<string>();
  readonly viewModeChange = output<'grid' | 'list'>();
  readonly openMobileFilter = output<void>();
  readonly removeChip = output<ActiveFilterChip>();
  readonly clearAllChips = output<void>();

  // Computeds for count summary
  readonly startItem = computed(() => {
    if (this.totalCount() === 0) return 0;
    return (this.pageNumber() - 1) * this.pageSize() + 1;
  });

  readonly endItem = computed(() => {
    if (this.totalCount() === 0) return 0;
    const computedEnd = this.pageNumber() * this.pageSize();
    return Math.min(computedEnd, this.totalCount());
  });

  onSortSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.sortChange.emit(select.value);
  }
}
