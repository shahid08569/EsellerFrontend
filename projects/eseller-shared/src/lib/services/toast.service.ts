import { Injectable, signal } from '@angular/core';

export interface ToastItem {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'error' | 'warning';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly currentToast = signal<ToastItem | null>(null);
  private timer: any = null;

  show(message: string, type: 'success' | 'info' | 'error' | 'warning' = 'success', duration = 3000): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    const id = Math.random().toString(36).substring(2, 9);
    this.currentToast.set({ id, message, type });
    this.timer = setTimeout(() => {
      if (this.currentToast()?.id === id) {
        this.currentToast.set(null);
      }
    }, duration);
  }

  dismiss(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.currentToast.set(null);
  }
}
