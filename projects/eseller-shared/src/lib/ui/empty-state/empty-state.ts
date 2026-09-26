import { Component, input } from '@angular/core';

export type EmptyStateIcon = 'box' | 'search' | 'cart' | 'error' | 'info';

@Component({
  selector: 'es-empty-state',
  imports: [],
  templateUrl: './empty-state.html'
})
export class EmptyState {
  readonly title = input<string>('Nothing here');
  readonly description = input<string>('');
  readonly icon = input<EmptyStateIcon>('box');
}