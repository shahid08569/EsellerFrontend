import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from 'eseller-shared';

@Component({
  selector: 'app-main-layout',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.html'
})
export class MainLayout {
  readonly authStore = inject(AuthStore);
  readonly isSidebarOpen = signal<boolean>(true);

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  logout() {
    this.authStore.clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = 'http://localhost:4200';
    }
  }
}
