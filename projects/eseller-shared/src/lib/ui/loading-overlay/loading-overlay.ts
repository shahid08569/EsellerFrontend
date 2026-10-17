import { Component, input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'es-loading-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading-overlay.html',
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
export class LoadingOverlay {
  readonly text = input<string>('Loading data…');
  readonly subtext = input<string>('Please wait a moment…');
  readonly fullscreen = input<boolean>(false);
}
