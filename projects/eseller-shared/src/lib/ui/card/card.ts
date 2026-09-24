import { Component, input, computed } from '@angular/core';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardShadow = 'none' | 'xs' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'es-card',
  imports: [],
  templateUrl: './card.html'
})
export class Card {
  readonly padding = input<CardPadding>('md');
  readonly shadow = input<CardShadow>('sm');
  readonly bordered = input<boolean>(true);
  readonly hoverable = input<boolean>(false);

  readonly classes = computed(() => {
    const base = 'bg-bg-card rounded-lg';

    const paddingClasses: Record<CardPadding, string> = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8'
    };

    const shadowClasses: Record<CardShadow, string> = {
      none: '',
      xs: 'shadow-xs',
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg'
    };

    const borderClass = this.bordered() ? 'border border-gray-100' : '';
    const hoverClass = this.hoverable()
      ? 'transition-shadow hover:shadow-md cursor-pointer'
      : '';

    return [
      base,
      paddingClasses[this.padding()],
      shadowClasses[this.shadow()],
      borderClass,
      hoverClass
    ]
      .filter(Boolean)
      .join(' ');
  });
}