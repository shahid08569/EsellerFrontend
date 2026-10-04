import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  input,
  output,
  signal,
  computed,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface AdminSelectOption {
  value: string;
  label: string;
  subLabel?: string;
}

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative w-full" #containerRef>
      @if (label()) {
        <label class="block text-xs font-bold text-gray-700 mb-1">
          {{ label() }}
          @if (required()) {
            <span class="text-orange-600">*</span>
          }
          @if (hint()) {
            <span class="ml-1 text-[10px] font-medium text-slate-400 normal-case">{{ hint() }}</span>
          }
        </label>
      }

      <button
        type="button"
        (click)="toggleDropdown()"
        [disabled]="disabled()"
        class="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs text-left bg-gray-50 border border-gray-200 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        [class.border-orange-500]="isOpen()"
        [class.ring-2]="isOpen()"
        [class.ring-orange-500/20]="isOpen()"
        [class.border-amber-500]="hasError() && !isOpen()"
      >
        <span class="truncate" [class.text-gray-400]="!selectedOption()" [class.text-gray-900]="selectedOption()" [class.font-medium]="!!selectedOption()">
          {{ selectedOption()?.label || placeholder() }}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400 shrink-0 transition-transform" [class.rotate-180]="isOpen()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      @if (isOpen()) {
        <div class="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
          <div class="p-2 border-b border-gray-100 bg-gray-50/80 sticky top-0">
            <div class="relative">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                #searchInput
                type="text"
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
                [placeholder]="searchPlaceholder()"
                (keydown.escape)="closeDropdown()"
                (keydown.enter)="selectFirstFiltered($event)"
                class="w-full text-xs pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
              />
            </div>
          </div>

          <div class="max-h-[220px] overflow-y-auto p-1">
            @if (filteredOptions().length === 0) {
              <div class="px-3 py-4 text-center text-xs text-gray-400 font-medium">No matches found</div>
            } @else {
              @for (opt of filteredOptions(); track opt.value) {
                <button
                  type="button"
                  (click)="selectOption(opt)"
                  class="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg text-left transition-colors cursor-pointer hover:bg-orange-50"
                  [class.bg-orange-50]="opt.value === selectedValue()"
                  [class.text-orange-700]="opt.value === selectedValue()"
                  [class.font-bold]="opt.value === selectedValue()"
                  [class.text-gray-800]="opt.value !== selectedValue()"
                >
                  <span class="truncate">{{ opt.label }}</span>
                  @if (opt.subLabel) {
                    <span class="text-[10px] text-gray-400 shrink-0">{{ opt.subLabel }}</span>
                  }
                </button>
              }
            }
          </div>
        </div>
      }
    </div>
  `
})
export class SearchableSelect {
  readonly label = input<string>('');
  readonly hint = input<string>('');
  readonly placeholder = input<string>('Select…');
  readonly searchPlaceholder = input<string>('Type to search…');
  readonly required = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly hasError = input<boolean>(false);
  readonly options = input<AdminSelectOption[]>([]);
  readonly selectedValue = input<string>('');

  readonly valueChange = output<string>();

  @ViewChild('containerRef') private containerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  readonly isOpen = signal(false);
  readonly searchQuery = signal('');

  readonly selectedOption = computed(() => {
    const val = this.selectedValue();
    return this.options().find((o) => o.value === val) ?? null;
  });

  readonly filteredOptions = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.options();
    if (!q) return all;
    return all.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.subLabel?.toLowerCase().includes(q) ?? false) ||
        o.value.toLowerCase().includes(q)
    );
  });

  constructor() {
    effect(() => {
      if (this.disabled() && this.isOpen()) {
        this.closeDropdown();
      }
    });
  }

  toggleDropdown(): void {
    if (this.disabled()) return;
    if (this.isOpen()) {
      this.closeDropdown();
      return;
    }
    this.isOpen.set(true);
    this.searchQuery.set('');
    setTimeout(() => this.searchInput?.nativeElement.focus(), 40);
  }

  closeDropdown(): void {
    this.isOpen.set(false);
    this.searchQuery.set('');
  }

  selectOption(opt: AdminSelectOption): void {
    this.valueChange.emit(opt.value);
    this.closeDropdown();
  }

  selectFirstFiltered(event: Event): void {
    event.preventDefault();
    const list = this.filteredOptions();
    if (list.length > 0) this.selectOption(list[0]);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (
      this.isOpen() &&
      this.containerRef &&
      !this.containerRef.nativeElement.contains(event.target as Node)
    ) {
      this.closeDropdown();
    }
  }
}
