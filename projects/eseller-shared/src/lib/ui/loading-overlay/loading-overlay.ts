import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'es-loading-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading-overlay.html'
})
export class LoadingOverlay {
  readonly text = input<string>('Loading data…');
  readonly subtext = input<string>('Please wait a moment…');
  readonly fullscreen = input<boolean>(false);
}
