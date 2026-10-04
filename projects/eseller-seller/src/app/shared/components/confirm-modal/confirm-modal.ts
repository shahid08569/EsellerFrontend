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
        class="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm transition-all duration-200"
        (click)="onBackdropClick($event)">
        
        <div 
          class="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-sm w-full p-6 relative overflow-hidden animate-in zoom-in-95 fade-in duration-200"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true">

          <div 
            class="absolute top-0 left-0 right-0 h-1"
            [ngClass]="{
              'bg-slate-800': iconType === 'logout',
              'bg-rose-500': iconType !== 'logout' && type === 'danger',
              'bg-amber-500': type === 'warning',
              'bg-indigo-500': type === 'info',
              'bg-emerald-500': type === 'success'
            }">
          </div>

          <button 
            type="button" 
            (click)="onCancel()"
            class="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div class="flex flex-col items-center text-center pt-1 mb-5">
            <div 
              class="w-14 h-14 rounded-xl flex items-center justify-center shadow-sm border"
              [ngClass]="{
                'bg-slate-900 text-white border-slate-800': iconType === 'logout',
                'bg-rose-50 text-rose-600 border-rose-100': iconType !== 'logout' && type === 'danger',
                'bg-amber-50 text-amber-600 border-amber-100': type === 'warning',
                'bg-indigo-50 text-indigo-600 border-indigo-100': type === 'info',
                'bg-emerald-50 text-emerald-600 border-emerald-100': type === 'success'
              }">
              @if (iconType === 'logout') {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              } @else if (type === 'danger') {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              } @else if (type === 'warning') {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              } @else if (type === 'success') {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              }
            </div>
          </div>

          <div class="text-center space-y-2 mb-6">
            <h3 class="text-lg font-black text-slate-900 tracking-tight">{{ title }}</h3>
            <p class="text-sm text-slate-500 leading-relaxed">{{ message }}</p>
            
            @if (itemHighlight) {
              <div class="mt-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 truncate">
                {{ itemHighlight }}
              </div>
            }
          </div>

          @if (singleButton) {
            <button 
              type="button" 
              (click)="onConfirm()"
              [disabled]="isProcessing"
              class="w-full py-3 px-5 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              [ngClass]="{
                'bg-emerald-600 hover:bg-emerald-700': type === 'success',
                'bg-slate-900 hover:bg-black': type !== 'success'
              }">
              {{ confirmText }}
            </button>
          } @else {
            <div class="grid grid-cols-2 gap-2.5">
              <button 
                type="button" 
                (click)="onCancel()"
                [disabled]="isProcessing"
                class="w-full py-3 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer">
                {{ cancelText }}
              </button>
              
              <button 
                type="button" 
                (click)="onConfirm()"
                [disabled]="isProcessing"
                class="w-full py-3 px-3 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                [ngClass]="{
                  'bg-slate-900 hover:bg-black': iconType === 'logout',
                  'bg-rose-600 hover:bg-rose-700': iconType !== 'logout' && type === 'danger',
                  'bg-amber-600 hover:bg-amber-700': type === 'warning',
                  'bg-indigo-600 hover:bg-indigo-700': type === 'info',
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
