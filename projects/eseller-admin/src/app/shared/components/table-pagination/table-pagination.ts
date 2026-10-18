import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchableSelect, SearchableSelectOption } from 'eseller-shared';

/**
 * Reusable admin table pager — shows "X–Y of Z" summary, a page-size selector,
 * and Previous/Next controls. Pure presentational: the parent owns page/pageSize
 * state and reacts to (pageChange)/(pageSizeChange).
 */
@Component({
  selector: 'app-table-pagination',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelect],
  templateUrl: './table-pagination.html'
})
export class TablePagination {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageSizeOptions = input<number[]>([10, 25, 50]);
  readonly label = input<string>('items');

  readonly mappedPageSizeOptions = computed<SearchableSelectOption[]>(() =>
    this.pageSizeOptions().map(s => ({ value: String(s), label: String(s) }))
  );

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly startItem = computed(() => {
    if (this.total() === 0) return 0;
    return (this.page() - 1) * this.pageSize() + 1;
  });

  readonly endItem = computed(() => Math.min(this.page() * this.pageSize(), this.total()));

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.page()) {
      this.pageChange.emit(page);
    }
  }

  onPageSizeChange(size: number): void {
    if (size !== this.pageSize()) {
      this.pageSizeChange.emit(size);
    }
  }
}
