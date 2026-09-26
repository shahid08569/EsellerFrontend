import { Component, input } from '@angular/core';

@Component({
  selector: 'es-skeleton',
  imports: [],
  templateUrl: './skeleton.html'
})
export class Skeleton {
  /** CSS classes to control width/height/shape */
  readonly className = input<string>('h-4 w-full');
}