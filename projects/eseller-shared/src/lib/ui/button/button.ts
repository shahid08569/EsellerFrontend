import { Component, input, computed } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'es-button',
  imports: [],
  templateUrl: './button.html'
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly disabled = input<boolean>(false);
  readonly fullWidth = input<boolean>(false);
  readonly type = input<ButtonType>('button');

  readonly classes = computed(() => {
    const base =
      'inline-flex items-center justify-center gap-2 ' +
      'font-semibold rounded-md transition-colors ' +
      'focus-visible:outline-none focus-visible:ring-2 ' +
      'disabled:cursor-not-allowed';

    const sizeClasses: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-base'
    };

    const variantClasses: Record<ButtonVariant, string> = {
      primary:
        'bg-primary text-white hover:bg-primary-hover active:bg-primary-active',
      secondary:
        'bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50',
      destructive: 'bg-danger text-white hover:bg-red-700'
    };

    const widthClass = this.fullWidth() ? 'w-full' : '';
    const disabledClass = this.disabled()
      ? 'bg-gray-200 text-gray-400 border-transparent hover:bg-gray-200 cursor-not-allowed'
      : '';

    return [
      base,
      sizeClasses[this.size()],
      disabledClass || variantClasses[this.variant()],
      widthClass
    ]
      .filter(Boolean)
      .join(' ');
  });
}