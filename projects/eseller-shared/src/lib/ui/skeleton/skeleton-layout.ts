import { Component, computed, input } from '@angular/core';
import { Skeleton } from './skeleton';

export type SkeletonVariant =
  | 'product-grid'
  | 'product-card'
  | 'table'
  | 'stats'
  | 'list'
  | 'detail'
  | 'chat'
  | 'page';

@Component({
  selector: 'es-skeleton-layout',
  standalone: true,
  imports: [Skeleton],
  templateUrl: './skeleton-layout.html'
})
export class SkeletonLayout {
  /** Layout preset */
  readonly variant = input<SkeletonVariant>('table');
  /** How many repeating items (cards / rows) */
  readonly count = input<number>(6);
  /** Table column count */
  readonly columns = input<number>(5);
  /** Product grid column classes override */
  readonly gridClass = input<string>(
    'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4'
  );

  readonly items = computed(() => Array.from({ length: Math.max(1, this.count()) }, (_, i) => i + 1));
  readonly cols = computed(() => Array.from({ length: Math.max(2, this.columns()) }, (_, i) => i + 1));
}
