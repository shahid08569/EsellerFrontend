import { Component, input, computed } from '@angular/core';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'primary'
  | 'neutral';

export type BadgeSize = 'sm' | 'md';

@Component({
  selector: 'es-badge',
  imports: [],
  templateUrl: './badge.html'
})
export class Badge {
  readonly variant = input<BadgeVariant>('neutral');
  readonly size = input<BadgeSize>('md');
  readonly withDot = input<boolean>(false);

  readonly classes = computed(() => {
    const base =
      'inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap';

    const sizeClasses: Record<BadgeSize, string> = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-xs'
    };

    const variantClasses: Record<BadgeVariant, string> = {
      success: 'bg-success-bg text-success',
      warning: 'bg-warning-bg text-warning',
      danger: 'bg-danger-bg text-danger',
      info: 'bg-info-bg text-info',
      primary: 'bg-primary-tint text-primary',
      neutral: 'bg-gray-100 text-gray-700'
    };

    return [base, sizeClasses[this.size()], variantClasses[this.variant()]]
      .filter(Boolean)
      .join(' ');
  });

  readonly dotClasses = computed(
    () => 'inline-block w-1.5 h-1.5 rounded-full bg-current'
  );
}