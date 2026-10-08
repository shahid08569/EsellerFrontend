import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ModalType = 'danger' | 'warning' | 'info' | 'success';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen) {
      <div
        class="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
        (click)="onBackdropClick($event)">

        <div
          class="bg-white rounded-2xl shadow-xl max-w-[360px] w-full relative overflow-hidden"
          [class.ring-1]="true"
          [class.ring-black/5]="true"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="'confirm-modal-title'">

          <button
            type="button"
            (click)="onCancel()"
            class="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div class="px-6 pt-7 pb-6">
            <div class="flex flex-col items-center text-center">
              <div
                class="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                [ngClass]="{
                  'bg-slate-100 text-slate-700': iconType === 'logout',
                  'bg-rose-50 text-rose-600': iconType !== 'logout' && type === 'danger',
                  'bg-amber-50 text-amber-600': type === 'warning',
                  'bg-sky-50 text-sky-600': type === 'info',
                  'bg-emerald-50 text-emerald-600': type === 'success'
                }">
                @if (iconType === 'logout') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                } @else if (type === 'danger') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                } @else if (type === 'warning') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                } @else if (type === 'success') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                } @else {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                }
              </div>

              <h3 id="confirm-modal-title" class="text-[17px] font-semibold text-slate-900 tracking-tight">
                {{ title }}
              </h3>
              <p class="mt-1.5 text-[13px] text-slate-500 leading-relaxed max-w-[280px]">
                {{ message }}
              </p>

              @if (itemHighlight) {
                <div class="mt-3 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 truncate">
                  {{ itemHighlight }}
                </div>
              }
            </div>

            @if (singleButton) {
              <button
                type="button"
                (click)="onConfirm()"
                [disabled]="isProcessing"
                class="mt-6 w-full py-2.5 px-4 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                [ngClass]="{
                  'bg-emerald-600 hover:bg-emerald-700': type === 'success',
                  'bg-slate-900 hover:bg-slate-800': type !== 'success'
                }">
                {{ confirmText }}
              </button>
            } @else if (iconType === 'logout') {
              <div class="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  (click)="onConfirm()"
                  [disabled]="isProcessing"
                  class="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                  @if (isProcessing) {
                    <svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  } @else {
                    {{ confirmText }}
                  }
                </button>
                <button
                  type="button"
                  (click)="onCancel()"
                  [disabled]="isProcessing"
                  class="w-full py-2.5 px-4 bg-transparent hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
                  {{ cancelText }}
                </button>
              </div>
            } @else {
              <div class="mt-6 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  (click)="onCancel()"
                  [disabled]="isProcessing"
                  class="w-full py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer">
                  {{ cancelText }}
                </button>

                <button
                  type="button"
                  (click)="onConfirm()"
                  [disabled]="isProcessing"
                  class="w-full py-2.5 px-3 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  [ngClass]="{
                    'bg-rose-600 hover:bg-rose-700': type === 'danger',
                    'bg-amber-600 hover:bg-amber-700': type === 'warning',
                    'bg-sky-600 hover:bg-sky-700': type === 'info',
                    'bg-emerald-600 hover:bg-emerald-700': type === 'success'
                  }">
                  @if (isProcessing) {
                    <svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  } @else {
                    {{ confirmText }}
                  }
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmModal {
  @Input() isOpen = false;
  @Input() title = 'Are you sure?';
  @Input() message = 'This action cannot be undone. Please confirm to proceed.';
  @Input() itemHighlight?: string;
  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Cancel';
  @Input() type: ModalType = 'danger';
  @Input() iconType: 'default' | 'logout' | 'delete' | 'warning' | 'info' | 'success' = 'default';
  @Input() isProcessing = false;
  @Input() singleButton = false;

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.isOpen && !this.isProcessing) {
      this.onCancel();
    }
  }

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.isProcessing) {
      this.onCancel();
    }
  }
}
