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

export interface DialCodeOption {
  code: string;
  flag: string;
}

@Component({
  selector: 'app-dial-code-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative shrink-0" #root>
      <button
        type="button"
        (click)="toggle()"
        class="h-full min-h-[40px] flex items-center gap-1 pl-2.5 pr-1.5 border-r border-gray-200 bg-gray-50/80 hover:bg-gray-100 transition-colors cursor-pointer"
        [class.bg-primary/5]="open()"
      >
        @if (selected(); as sel) {
          <span class="text-sm leading-none">{{ sel.flag }}</span>
          <span class="text-xs font-bold text-gray-800 tabular-nums">{{ sel.code }}</span>
        } @else {
          <span class="text-xs font-semibold text-gray-400">Code</span>
        }
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-gray-400 ml-0.5 transition-transform"
             [class.rotate-180]="open()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      @if (open()) {
        <div class="absolute left-0 top-[calc(100%+4px)] z-50 w-[148px] rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div class="p-1.5 border-b border-gray-100">
            <input
              #searchRef
              type="text"
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
              placeholder="Search…"
              (keydown.escape)="close()"
              class="w-full h-8 px-2.5 text-xs rounded-lg border border-gray-200 bg-gray-50 outline-none focus:border-primary focus:bg-white"
            />
          </div>
          <ul class="max-h-[176px] overflow-y-auto py-1">
            @for (opt of filtered(); track opt.code) {
              <li>
                <button
                  type="button"
                  (click)="pick(opt.code)"
                  class="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-orange-50 cursor-pointer transition-colors"
                  [class.bg-orange-50]="opt.code === value()"
                  [class.text-primary]="opt.code === value()"
                >
                  <span class="text-sm leading-none w-5 text-center">{{ opt.flag }}</span>
                  <span class="text-xs font-bold tabular-nums">{{ opt.code }}</span>
                  @if (opt.code === value()) {
                    <span class="ml-auto text-primary text-[10px] font-black">✓</span>
                  }
                </button>
              </li>
            } @empty {
              <li class="px-3 py-4 text-center text-[11px] text-gray-400">No match</li>
            }
          </ul>
        </div>
      }
    </div>
  `
})
export class DialCodeSelect {
  readonly options = input<DialCodeOption[]>([]);
  readonly value = input<string>('');
  readonly valueChange = output<string>();

  @ViewChild('root') private root?: ElementRef<HTMLElement>;
  @ViewChild('searchRef') private searchRef?: ElementRef<HTMLInputElement>;

  readonly open = signal(false);
  readonly query = signal('');

  readonly selected = computed(() => {
    const v = this.value();
    if (!v) return null;
    return this.options().find((o) => o.code === v) ?? { code: v, flag: '🌍' };
  });

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.options();
    if (!q) return all;
    return all.filter((o) => o.code.toLowerCase().includes(q));
  });

  toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.open.set(true);
    this.query.set('');
    setTimeout(() => this.searchRef?.nativeElement.focus(), 40);
  }

  close(): void {
    this.open.set(false);
    this.query.set('');
  }

  pick(code: string): void {
    this.valueChange.emit(code);
    this.close();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.open() || !this.root) return;
    if (!this.root.nativeElement.contains(ev.target as Node)) {
      this.close();
    }
  }
}
