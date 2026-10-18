import { Component, EventEmitter, Input, OnInit, Output, inject, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService, CategoryTreeDto, BrandDto, HomeService, SearchableSelect, SearchableSelectOption } from 'eseller-shared';
import { SellerProductService, AddGroupToStoreResponse } from '../../../core/services/product.service';

@Component({
  selector: 'app-group-product-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelect],
  templateUrl: './group-product-import-modal.html'
})
export class GroupProductImportModal implements OnInit, OnChanges {
  private readonly sellerProductService = inject(SellerProductService);
  private readonly homeService = inject(HomeService);
  private readonly toast = inject(ToastService);

  @Input() isOpen = false;
  @Input() shopId = '';
  @Input() productLimit = 200;
  @Input() usedSlots = 0;

  @Output() closed = new EventEmitter<void>();
  @Output() imported = new EventEmitter<AddGroupToStoreResponse>();

  readonly categories = signal<CategoryTreeDto[]>([]);
  readonly brands = signal<BrandDto[]>([]);
  readonly brandOptions = computed<SearchableSelectOption[]>(() => [
    { value: '', label: 'Any Brand (All)' },
    ...this.brands().map(b => ({ value: b.id, label: b.name }))
  ]);
  readonly isLoadingMeta = signal<boolean>(false);

  // Form inputs
  readonly count = signal<number>(25);
  readonly selectedCategoryIds = signal<Set<string>>(new Set());
  readonly selectedBrandId = signal<string>('');
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);
  readonly customBatchName = signal<string>('');
  readonly categorySearch = signal<string>('');

  readonly isSubmitting = signal<boolean>(false);

  readonly availableSlots = computed(() => Math.max(0, this.productLimit - this.usedSlots));
  readonly maxAllowed = computed(() => Math.max(1, Math.min(200, this.availableSlots())));

  readonly filteredCategories = computed(() => {
    const list = this.categories();
    const query = this.categorySearch().trim().toLowerCase();
    if (!query) return list;
    return list.filter(c => c.name.toLowerCase().includes(query));
  });

  readonly isAllCategoriesSelected = computed(() => {
    const cats = this.categories();
    if (cats.length === 0) return false;
    const selected = this.selectedCategoryIds();
    return cats.every(c => selected.has(c.id));
  });

  ngOnInit(): void {
    this.loadMetadata();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      // Auto-adjust default count to available slots
      const max = this.maxAllowed();
      if (this.count() > max) {
        this.count.set(Math.min(25, max));
      }
    }
  }

  loadMetadata(): void {
    this.isLoadingMeta.set(true);
    this.homeService.getCategories(true).subscribe({
      next: (cats) => {
        this.categories.set(cats || []);
        this.isLoadingMeta.set(false);
      },
      error: () => this.isLoadingMeta.set(false)
    });

    this.homeService.getBrands().subscribe({
      next: (b) => this.brands.set(b || []),
      error: () => {}
    });
  }

  setQuickCount(amount: number): void {
    const max = this.maxAllowed();
    this.count.set(Math.min(amount, max));
  }

  setCountValue(val: number | string): void {
    const num = Number(val) || 1;
    const max = this.maxAllowed();
    const clamped = Math.max(1, Math.min(max, Math.min(200, num)));
    this.count.set(clamped);
  }

  toggleCategory(id: string): void {
    const set = new Set(this.selectedCategoryIds());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.selectedCategoryIds.set(set);
  }

  toggleSelectAllCategories(): void {
    if (this.isAllCategoriesSelected()) {
      this.selectedCategoryIds.set(new Set());
    } else {
      const allIds = new Set(this.categories().map(c => c.id));
      this.selectedCategoryIds.set(allIds);
    }
  }

  clearCategories(): void {
    this.selectedCategoryIds.set(new Set());
  }

  close(): void {
    if (this.isSubmitting()) return;
    this.closed.emit();
  }

  submitImport(): void {
    if (!this.shopId) {
      this.toast.show('Store profile not identified. Please refresh.', 'error');
      return;
    }

    const available = this.availableSlots();
    if (available <= 0) {
      this.toast.show('Store product limit reached. Upgrade your package to add more products.', 'warning');
      return;
    }

    const reqCount = Math.max(1, Math.min(200, Math.min(this.count(), available)));

    this.isSubmitting.set(true);
    const categoryIds = Array.from(this.selectedCategoryIds());

    this.sellerProductService.addGroupToStore({
      shopId: this.shopId,
      count: reqCount,
      categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
      brandId: this.selectedBrandId() || null,
      minPrice: this.minPrice() !== null && this.minPrice()! > 0 ? this.minPrice() : null,
      maxPrice: this.maxPrice() !== null && this.maxPrice()! > 0 ? this.maxPrice() : null,
      customBatchName: this.customBatchName().trim() || null
    }).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.toast.show(
          res.message || `Successfully added ${res.addedCount} products to your store under "${res.batchName}"!`,
          'success'
        );
        this.imported.emit(res);
        this.close();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const code = err?.errorCode || err?.error?.errorCode;
        if (code === 'NO_MATCHING_PRODUCTS') {
          this.toast.show('No warehouse products matched your category, brand, or price filters.', 'warning');
          return;
        }
        if (code === 'PACKAGE_LIMIT_EXCEEDED') {
          this.toast.show('Store capacity exceeded. Please adjust product count or upgrade package.', 'warning');
          return;
        }
        const msg = err?.error?.error || err?.error?.message || err?.message || 'Failed to import group products.';
        this.toast.show(msg, 'error');
      }
    });
  }
}
