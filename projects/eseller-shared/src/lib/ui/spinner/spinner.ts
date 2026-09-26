import { Component, input, computed } from '@angular/core';

export type SpinnerSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'es-spinner',
  imports: [],
  templateUrl: './spinner.html'
})
export class Spinner {
  readonly size = input<SpinnerSize>('md');

  readonly sizeClasses = computed(() => {
    const map: Record<SpinnerSize, string> = {
      sm: 'w-4 h-4 border-2',
      md: 'w-6 h-6 border-2',
      lg: 'w-10 h-10 border-[3px]'
    };
    return map[this.size()];
  });
}