import { Component, input, output, computed } from '@angular/core';
import { SearchableSelect, SearchableSelectOption } from 'eseller-shared';

export interface ActiveFilterChip {
  id: string;
  type: 'category' | 'brand' | 'price' | 'rating' | 'featured' | 'search';
  label: string;
}

@Component({
  selector: 'app-product-sort-bar',
  standalone: true,
  imports: [SearchableSelect],
  templateUrl: './product-sort-bar.html',
  styleUrl: './product-sort-bar.css'
})
export class ProductSortBar {
  readonly sortOptions: SearchableSelectOption[] = [
    { value: 'newest', label: 'Newest Arrivals' },
    { value: 'popular', label: 'Most Popular' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'rating', label: 'Customer Rating' }
  ];
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
