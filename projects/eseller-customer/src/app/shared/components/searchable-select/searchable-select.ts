import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  input,
  output,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
  flag?: string;
  subLabel?: string;
}

@Component({
  selector: 'app-searchable-select',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative w-full" #containerRef>
      @if (label()) {
        <label class="block text-xs font-semibold text-text-secondary mb-1">
          {{ label() }}
          @if (required()) {
            <span class="text-red-500">*</span>
          }
        </label>
      }

      <button
        type="button"
        (click)="toggleDropdown()"
        class="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs text-left bg-white border rounded-xl transition-all duration-200 cursor-pointer"
        [class.border-red-400]="hasError()"
        [class.border-gray-300]="!hasError() && !isOpen()"
        [class.border-primary]="isOpen()"
        [class.ring-2]="isOpen()"
        [class.ring-primary/20]="isOpen()"
      >
        <span class="truncate flex items-center gap-2 min-w-0">
          @if (selectedOption()?.flag) {
            <span class="text-sm leading-none shrink-0">{{ selectedOption()!.flag }}</span>
          }
          <span class="truncate" [class.text-text-muted]="!selectedOption()" [class.text-text-primary]="selectedOption()" [class.font-medium]="selectedOption()">
            @if (selectedOption()) {
              {{ selectedOption()!.label }}
              @if (selectedOption()!.subLabel) {
                <span class="text-text-muted font-semibold">{{ selectedOption()!.subLabel }}</span>
              }
            } @else {
              {{ placeholder() }}
            }
          </span>
        </span>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0"
          [class.rotate-180]="isOpen()"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      @if (isOpen()) {
        <div
          class="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          style="max-height: 280px;"
        >
          <div class="p-2 border-b border-gray-100 bg-gray-50/70 sticky top-0 z-10">
            <div class="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
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
                class="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div class="max-h-[220px] overflow-y-auto divide-y divide-gray-50 p-1">
            @if (filteredOptions().length === 0) {
              <div class="px-3 py-4 text-center text-xs text-text-muted">
                No matching options found
              </div>
            } @else {
              @for (opt of filteredOptions(); track opt.value) {
                <button
                  type="button"
                  (click)="selectOption(opt)"
                  class="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-left transition-colors cursor-pointer hover:bg-primary-tint/60"
                  [class.bg-primary-tint]="opt.value === selectedValue()"
                  [class.text-primary]="opt.value === selectedValue()"
                  [class.font-bold]="opt.value === selectedValue()"
                  [class.text-text-primary]="opt.value !== selectedValue()"
                >
                  <span class="flex items-center gap-2 truncate">
                    @if (opt.flag) {
                      <span class="text-sm leading-none">{{ opt.flag }}</span>
                    }
                    <span class="truncate">{{ opt.label }}</span>
                  </span>

                  @if (opt.subLabel) {
                    <span class="text-[10px] text-text-muted flex-shrink-0 ml-2">
                      {{ opt.subLabel }}
                    </span>
                  }
                  @if (opt.value === selectedValue()) {
                    <span class="text-primary font-bold text-xs ml-2">&check;</span>
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
  readonly placeholder = input<string>('Select an option...');
  readonly searchPlaceholder = input<string>('Search...');
  readonly required = input<boolean>(false);
  readonly hasError = input<boolean>(false);
  readonly options = input<SelectOption[]>([]);
  readonly selectedValue = input<string | null>(null);

  readonly valueChange = output<string>();

  @ViewChild('containerRef') private containerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  readonly isOpen = signal<boolean>(false);
  readonly searchQuery = signal<string>('');

  readonly selectedOption = computed(() => {
    const val = this.selectedValue();
    if (!val) return null;
    return this.options().find((o) => o.value === val) ?? null;
  });

  readonly filteredOptions = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.options();
    if (!q) return all;
    return all.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.subLabel && o.subLabel.toLowerCase().includes(q))
    );
  });

  toggleDropdown(): void {
    if (this.isOpen()) {
      this.closeDropdown();
    } else {
      this.isOpen.set(true);
      this.searchQuery.set('');
      setTimeout(() => {
        this.searchInput?.nativeElement.focus();
      }, 50);
    }
  }

  closeDropdown(): void {
    this.isOpen.set(false);
    this.searchQuery.set('');
  }

  selectOption(opt: SelectOption): void {
    this.valueChange.emit(opt.value);
    this.closeDropdown();
  }

  selectFirstFiltered(event: Event): void {
    event.preventDefault();
    const list = this.filteredOptions();
    if (list.length > 0) {
      this.selectOption(list[0]);
    }
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
