import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  HostListener,
  ViewChild,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: string;
  flag?: string;
}

@Component({
  selector: 'es-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './searchable-select.html',
  styleUrls: ['./searchable-select.css']
})
export class SearchableSelect {
  @Input() options: SearchableSelectOption[] = [];
  @Input() value: any = '';
  @Input() placeholder: string = 'Select an option';
  @Input() searchPlaceholder: string = 'Search...';
  @Input() disabled: boolean = false;
  @Input() allowClear: boolean = false;
  @Input() customClass: string = '';
  @Input() menuClass: string = '';

  @Output() valueChange = new EventEmitter<any>();
  @Output() selectionChange = new EventEmitter<SearchableSelectOption | null>();

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  readonly isOpen = signal<boolean>(false);
  readonly searchTerm = signal<string>('');

  constructor(private readonly elementRef: ElementRef) {}

  isSelected(optValue: any): boolean {
    if (this.value === undefined || this.value === null || this.value === '') {
      return optValue === undefined || optValue === null || optValue === '';
    }
    return String(this.value).toLowerCase() === String(optValue).toLowerCase();
  }

  readonly selectedOption = computed(() => {
    const val = this.value;
    if (val === undefined || val === null) return null;
    return this.options.find(o => String(o.value).toLowerCase() === String(val).toLowerCase()) || null;
  });

  readonly filteredOptions = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.options;
    return this.options.filter(o =>
      (o.label && o.label.toLowerCase().includes(term)) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(term)) ||
      (o.value && o.value.toLowerCase().includes(term))
    );
  });

  toggle(): void {
    if (this.disabled) return;
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    if (this.disabled) return;
    this.isOpen.set(true);
    this.searchTerm.set('');
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 50);
  }

  close(): void {
    this.isOpen.set(false);
    this.searchTerm.set('');
  }

  select(option: SearchableSelectOption, event?: Event): void {
    event?.stopPropagation();
    this.value = option.value;
    this.valueChange.emit(option.value);
    this.selectionChange.emit(option);
    this.close();
  }

  clear(event?: Event): void {
    event?.stopPropagation();
    this.value = '';
    this.valueChange.emit('');
    this.selectionChange.emit(null);
    this.close();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.close();
    }
  }
}
