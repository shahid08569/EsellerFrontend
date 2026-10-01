import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgxLoadingBar } from '@ngx-loading-bar/core';
import { ToastService } from 'eseller-shared';
import { ScrollRestorationService } from './core/services/scroll-restoration.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgxLoadingBar],
  templateUrl: './app.html'
})
export class App {
  // Initialize intelligent scroll restoration on app bootstrap
  private readonly scrollRestoration = inject(ScrollRestorationService);
  readonly toastService = inject(ToastService);
}