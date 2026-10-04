import { 
  Component, 
  Output, 
  EventEmitter, 
  signal, 
  computed, 
  HostListener, 
  ElementRef, 
  inject, 
  input,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrandDto } from 'eseller-shared';

import { ImageUrlPipe } from '../../../../../shared/pipes/image-url.pipe';
import { ImgFallbackDirective } from '../../../../../shared/directives/img-fallback.directive';

export interface FlatCategoryOption {
  id: string;
  name: string;
  slug: string;
  level: number;
  imageUrl?: string | null;
}

const CATEGORY_KEYWORD_BRAND_MAP: Record<string, string[]> = {
  'tech': ['apple', 'dell', 'hp', 'samsung', 'sony', 'xiaomi'],
  'electronic': ['apple', 'dell', 'hp', 'samsung', 'sony', 'xiaomi'],
  'phone': ['apple', 'samsung', 'xiaomi', 'sony'],
  'cloth': ['zara', 'forever-21', 'nike', 'adidas'],
  'men': ['zara', 'forever-21', 'nike', 'adidas'],
  'women': ['zara', 'forever-21', 'gucci', 'prada'],
  'shoe': ['nike', 'adidas', 'puma', 'zara'],
  'bag': ['zara', 'gucci', 'prada', 'forever-21'],
  'watch': ['apple', 'samsung', 'rolex', 'casio', 'fossil'],
  'beauty': ['loreal', 'maybelline', 'sephora'],
  'toy': ['lego', 'sony', 'xiaomi', 'hasbro'],
  'book': ['penguin', 'oxford'],
  'home': ['ikea', 'xiaomi', 'samsung', 'philips']
};

@Component({
  selector: 'app-step-basic',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageUrlPipe, ImgFallbackDirective],
  templateUrl: './step-basic.component.html'
})
export class StepBasicComponent {
  private readonly elRef = inject(ElementRef);

  // Signal Inputs for reactive tracking
  isEditMode = input<boolean>(false);
  primaryImageUrl = input<string | null>(null);
  existingImagesCount = input<number>(0);

  name = input<string>('');
  description = input<string>('');
  basePrice = input<number | null>(null);
  categoryId = input<string>('');
  brandId = input<string>('');
  seoTitle = input<string>('');
  seoDescription = input<string>('');
  categories = input<FlatCategoryOption[]>([]);
  brands = input<BrandDto[]>([]);
  nameError = input<string | null>(null);
  priceError = input<string | null>(null);
  categoryError = input<string | null>(null);

  // Outputs
  @Output() jumpToMedia = new EventEmitter<void>();
  @Output() nameChange = new EventEmitter<string>();
  @Output() descriptionChange = new EventEmitter<string>();
  @Output() basePriceChange = new EventEmitter<number | null>();
  @Output() categoryIdChange = new EventEmitter<string>();
  @Output() brandIdChange = new EventEmitter<string>();
  @Output() seoTitleChange = new EventEmitter<string>();
  @Output() seoDescriptionChange = new EventEmitter<string>();

  @ViewChild('categorySearchInput') categorySearchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('brandSearchInput') brandSearchInput?: ElementRef<HTMLInputElement>;

  readonly isCategoryDropdownOpen = signal<boolean>(false);
  readonly categorySearchTerm = signal<string>('');

  readonly isBrandDropdownOpen = signal<boolean>(false);
  readonly brandSearchTerm = signal<string>('');

  // Selected Category Object
  readonly selectedCategory = computed(() => {
    const id = this.categoryId();
    if (!id) return null;
    return this.categories().find(c => c.id === id) || null;
  });

  // Filtered Categories
  readonly filteredCategories = computed(() => {
    const term = this.categorySearchTerm().trim().toLowerCase();
    const list = this.categories();
    if (!term) return list;
    return list.filter(c => c.name.toLowerCase().includes(term) || (c.slug && c.slug.toLowerCase().includes(term)));
  });

  // Suggested Brands based on selected category name/slug
  readonly suggestedBrandSlugs = computed<string[]>(() => {
    const cat = this.selectedCategory();
    if (!cat) return [];
    const text = `${cat.name} ${cat.slug || ''}`.toLowerCase();
    
    const matchedSlugs = new Set<string>();
    for (const [key, slugs] of Object.entries(CATEGORY_KEYWORD_BRAND_MAP)) {
      if (text.includes(key)) {
        slugs.forEach(s => matchedSlugs.add(s));
      }
    }
    return Array.from(matchedSlugs);
  });

  // Filtered Brands (searches all brands, prioritizing suggested if available)
  readonly filteredBrands = computed(() => {
    const term = this.brandSearchTerm().trim().toLowerCase();
    const all = this.brands();
    if (!term) return all;
    return all.filter(b => b.name.toLowerCase().includes(term) || (b.slug && b.slug.toLowerCase().includes(term)));
  });

  // Selected Brand Object
  readonly selectedBrand = computed(() => {
    const id = this.brandId();
    if (!id) return null;
    return this.brands().find(b => b.id === id) || null;
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elRef.nativeElement.contains(event.target as HTMLElement)) {
      this.isCategoryDropdownOpen.set(false);
      this.isBrandDropdownOpen.set(false);
    }
  }

  toggleCategoryDropdown(event: Event) {
    event.stopPropagation();
    const willOpen = !this.isCategoryDropdownOpen();
    this.isCategoryDropdownOpen.set(willOpen);
    if (willOpen) {
      this.isBrandDropdownOpen.set(false);
      this.categorySearchTerm.set('');
      setTimeout(() => this.categorySearchInput?.nativeElement?.focus(), 100);
    }
  }

  selectCategory(cat: FlatCategoryOption, event: Event) {
    event.stopPropagation();
    this.categoryIdChange.emit(cat.id);
    this.isCategoryDropdownOpen.set(false);
    this.categorySearchTerm.set('');
  }

  clearCategory(event: Event) {
    event.stopPropagation();
    this.categoryIdChange.emit('');
    this.categorySearchTerm.set('');
  }

  toggleBrandDropdown(event: Event) {
    event.stopPropagation();
    const willOpen = !this.isBrandDropdownOpen();
    this.isBrandDropdownOpen.set(willOpen);
    if (willOpen) {
      this.isCategoryDropdownOpen.set(false);
      this.brandSearchTerm.set('');
      setTimeout(() => this.brandSearchInput?.nativeElement?.focus(), 100);
    }
  }

  selectBrand(brand: BrandDto | null, event: Event) {
    event.stopPropagation();
    this.brandIdChange.emit(brand ? brand.id : '');
    this.isBrandDropdownOpen.set(false);
    this.brandSearchTerm.set('');
  }

  clearBrand(event: Event) {
    event.stopPropagation();
    this.brandIdChange.emit('');
    this.brandSearchTerm.set('');
  }
}
