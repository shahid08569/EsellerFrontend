import { Component, computed, input } from '@angular/core';

export type SkeletonShape = 'rect' | 'circle' | 'pill' | 'text';

@Component({
  selector: 'es-skeleton',
  standalone: true,
  host: {
    '[class]': 'hostClass()',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    'aria-hidden': 'true'
  },
  template: `
    <span
      class="es-skel block w-full h-full"
      [class.es-skel--circle]="shape() === 'circle'"
      [class.es-skel--pill]="shape() === 'pill' || shape() === 'text'"
      [style.border-radius]="radius() || null"
    ></span>
  `
})
export class Skeleton {
  readonly width = input<string>('100%');
  readonly height = input<string>('0.75rem');
  readonly shape = input<SkeletonShape>('rect');
  /** Optional override, e.g. "12px" or "1rem" */
  readonly radius = input<string>('');

  readonly hostClass = computed(() =>
    this.shape() === 'circle' || this.height() === '100%'
      ? 'inline-block align-middle'
      : 'inline-block align-middle max-w-full'
  );
}
