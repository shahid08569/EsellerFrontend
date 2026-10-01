import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoryTreeDto, BrandDto } from 'eseller-shared';

export interface PriceRange {
  minPrice: number | null;
  maxPrice: number | null;
}

@Component({
  selector: 'app-product-filter-sidebar',
  imports: [FormsModule],
  templateUrl: './product-filter-sidebar.html',
  styleUrl: './product-filter-sidebar.css'
})
export class ProductFilterSidebar {
  // Inputs
  readonly categories = input<CategoryTreeDto[]>([]);
  readonly brands = input<BrandDto[]>([]);
  readonly selectedCategoryId = input<string | null>(null);
  readonly selectedBrandId = input<string | null>(null);
  readonly minPrice = input<number | null>(null);
  readonly maxPrice = input<number | null>(null);
  readonly minRating = input<number | null>(null);
  readonly isFeatured = input<boolean | null>(null);
  readonly isMobileDrawer = input<boolean>(false);

  // Local price input state for form editing before apply
  readonly localMinPrice = signal<number | null>(null);
  readonly localMaxPrice = signal<number | null>(null);

  // Outputs
  readonly categoryChange = output<string | null>();
  readonly brandChange = output<string | null>();
  readonly priceChange = output<PriceRange>();
  readonly ratingChange = output<number | null>();
  readonly featuredChange = output<boolean | null>();
  readonly clearAll = output<void>();
  readonly closeDrawer = output<void>();

  // Price presets
  readonly pricePresets = [
    { label: 'Under Rs. 2,000', min: null, max: 2000 },
    { label: 'Rs. 2,000 – Rs. 5,000', min: 2000, max: 5000 },
    { label: 'Rs. 5,000 – Rs. 10,000', min: 5000, max: 10000 },
    { label: 'Rs. 10,000+', min: 10000, max: null }
  ];

  // Rating stars list
  readonly ratings = [4, 3, 2, 1];

  ngOnInit(): void {
    this.localMinPrice.set(this.minPrice());
    this.localMaxPrice.set(this.maxPrice());
  }

  onCategorySelect(id: string | null): void {
    if (this.selectedCategoryId() === id) {
      this.categoryChange.emit(null);
    } else {
      this.categoryChange.emit(id);
    }
  }

  onBrandSelect(id: string | null): void {
    if (this.selectedBrandId() === id) {
      this.brandChange.emit(null);
    } else {
      this.brandChange.emit(id);
    }
  }

  onPricePresetSelect(preset: { min: number | null; max: number | null }): void {
    this.localMinPrice.set(preset.min);
    this.localMaxPrice.set(preset.max);
    this.priceChange.emit({ minPrice: preset.min, maxPrice: preset.max });
  }

  onApplyCustomPrice(): void {
    const min = this.localMinPrice();
    const max = this.localMaxPrice();
    this.priceChange.emit({
      minPrice: min != null && !isNaN(min) && min >= 0 ? min : null,
      maxPrice: max != null && !isNaN(max) && max >= 0 ? max : null
    });
  }

  onRatingSelect(rating: number): void {
    if (this.minRating() === rating) {
      this.ratingChange.emit(null);
    } else {
      this.ratingChange.emit(rating);
    }
  }

  onToggleFeatured(): void {
    const next = this.isFeatured() ? null : true;
    this.featuredChange.emit(next);
  }

  hasActiveFilters(): boolean {
    return (
      this.selectedCategoryId() != null ||
      this.selectedBrandId() != null ||
      this.minPrice() != null ||
      this.maxPrice() != null ||
      this.minRating() != null ||
      this.isFeatured() === true
    );
  }

  isPresetActive(min: number | null, max: number | null): boolean {
    return this.minPrice() === min && this.maxPrice() === max;
  }
}
