import { Component, computed, input, ViewEncapsulation } from '@angular/core';
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
  templateUrl: './skeleton-layout.html',
  encapsulation: ViewEncapsulation.None,
  styles: [`
    @keyframes es-orbit-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes es-orbit-spin-rev {
      0% { transform: rotate(360deg); }
      100% { transform: rotate(0deg); }
    }
    @keyframes es-pulse-core {
      0%, 100% {
        transform: scale(0.82);
        opacity: 0.75;
      }
      50% {
        transform: scale(1.2);
        opacity: 1;
      }
    }
    @keyframes es-dot-bounce {
      0%, 80%, 100% {
        transform: translateY(0);
        opacity: 0.35;
      }
      40% {
        transform: translateY(-3.5px);
        opacity: 1;
      }
    }
    .es-cool-orbit {
      animation: es-orbit-spin 1.1s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite !important;
    }
    .es-cool-orbit-rev {
      animation: es-orbit-spin-rev 1.5s linear infinite !important;
    }
    .es-cool-core {
      animation: es-pulse-core 1.4s ease-in-out infinite !important;
    }
    .es-dot-1 {
      display: inline-block;
      animation: es-dot-bounce 1.4s infinite 0s;
    }
    .es-dot-2 {
      display: inline-block;
      animation: es-dot-bounce 1.4s infinite 0.2s;
    }
    .es-dot-3 {
      display: inline-block;
      animation: es-dot-bounce 1.4s infinite 0.4s;
    }
  `]
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

  /** Whether to show the floating cool professional loader card over the skeleton */
  readonly showLoader = input<boolean>(true);
  /** Primary label on the cool loader */
  readonly label = input<string>('Loading data');
  /** Optional secondary sublabel */
  readonly sublabel = input<string>('Please wait a moment…');

  readonly items = computed(() => Array.from({ length: Math.max(1, this.count()) }, (_, i) => i + 1));
  readonly cols = computed(() => Array.from({ length: Math.max(2, this.columns()) }, (_, i) => i + 1));
}
