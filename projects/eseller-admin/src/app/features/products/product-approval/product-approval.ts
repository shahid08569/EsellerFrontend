import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { switchMap, catchError, map } from 'rxjs/operators';
import { ToastService } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminProductDto, AdminShopDto, AdminCategoryDto, AdminBrandDto } from '../../../core/models/admin.models';
import { SearchableSelect, AdminSelectOption } from '../../../shared/components/searchable-select/searchable-select';
import { TablePagination } from '../../../shared/components/table-pagination/table-pagination';

export interface VariantFormItem {
  id?: string;
  sku: string;
  price: number;
  stockQty: number;
  size: string;
  color: string;
  material: string;
  imageUrl?: string | null;
  imageFile?: File | null;
  imagePreviewUrl?: string | null;
}

type ProductStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

@Component({
  selector: 'app-product-approval',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelect, TablePagination],
  templateUrl: './product-approval.html'
})
export class ProductApproval implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isLoading = signal<boolean>(true);
  readonly shopsList = signal<AdminShopDto[]>([]);
  readonly categoriesList = signal<AdminCategoryDto[]>([]);
  readonly brandsList = signal<AdminBrandDto[]>([]);
  readonly selectedShopId = signal<string>('');
  readonly selectedShopName = signal<string>('');
  readonly selectedCategoryId = signal<string>('');
  readonly selectedBrandId = signal<string>('');
  
  readonly statusFilter = signal<ProductStatusFilter>('all');
  readonly searchTerm = signal<string>('');
  
  readonly products = signal<AdminProductDto[]>([]);
  readonly pendingProducts = signal<AdminProductDto[]>([]);
  readonly totalCount = signal<number>(0);
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 25, 50];

  // Selection & Batch Delete
  readonly selectedProductIds = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedProductIds().size);

  // Delete Confirmation Modal
  readonly deleteModalOpen = signal<boolean>(false);
  readonly isBatchDelete = signal<boolean>(false);
  readonly productToDelete = signal<AdminProductDto | null>(null);
  readonly isDeleting = signal<boolean>(false);

  // Master Product Creation & Edit Form
  readonly createModalOpen = signal<boolean>(false);
  readonly editModalOpen = signal<boolean>(false);
  readonly editingProduct = signal<AdminProductDto | null>(null);
  readonly isCreatingProduct = signal<boolean>(false);
  readonly isSavingProduct = signal<boolean>(false);

  readonly newProductName = signal<string>('');
  readonly newProductDesc = signal<string>('');
  readonly newProductPrice = signal<number | null>(null);
  readonly newProductCategoryId = signal<string>('');
  readonly newProductBrandId = signal<string>('');
  readonly selectedImageFiles = signal<File[]>([]);
  readonly imagePreviewUrls = signal<string[]>([]);
  readonly isBulkImageMode = signal<boolean>(false);
  readonly enableVariants = signal<boolean>(false);
  readonly variantsList = signal<VariantFormItem[]>([]);
  /** Keeps the variant rows the admin had entered when "Enable variants" is unchecked, so re-enabling restores them. */
  private variantDraft: VariantFormItem[] = [];
  readonly lookupsLoading = signal<boolean>(false);

  // Cover-image picker (shown after bulk/single image upload for create & edit flows)
  readonly uploadedProductImages = signal<{ id: string; imageUrl: string; isCover: boolean }[]>([]);
  readonly isSettingCover = signal<string | null>(null);
  readonly createdProductId = signal<string | null>(null);

  // Bulk approve
  readonly batchApproveModalOpen = signal<boolean>(false);
  readonly isBatchApproving = signal<boolean>(false);

  readonly categoryOptions = computed<AdminSelectOption[]>(() =>
    this.categoriesList().map(c => ({
      value: String(c.id),
      label: c.name,
      subLabel: c.productCount != null ? `${c.productCount} products` : undefined
    }))
  );

  readonly brandOptions = computed<AdminSelectOption[]>(() => [
    { value: '', label: 'No specific brand' },
    ...this.brandsList().map(b => ({
      value: String(b.id),
      label: b.name,
      subLabel: b.slug || undefined
    }))
  ]);

  readonly filterCategoryOptions = computed<AdminSelectOption[]>(() => [
    { value: '', label: 'All categories' },
    ...this.categoryOptions()
  ]);

  readonly filterBrandOptions = computed<AdminSelectOption[]>(() => [
    { value: '', label: 'All brands' },
    ...this.brandsList().map(b => ({
      value: String(b.id),
      label: b.name
    }))
  ]);

  readonly filterShopOptions = computed<AdminSelectOption[]>(() => [
    { value: '', label: 'All shops' },
    ...this.shopsList()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(s => ({
        value: String(s.id || s.name),
        label: s.name,
        subLabel: s.city || s.slug || undefined
      }))
  ]);

  // Edit Fields
  readonly editProductName = signal<string>('');
  readonly editProductDesc = signal<string>('');
  readonly editProductPrice = signal<number | null>(null);
  readonly editProductCategoryId = signal<string>('');
  readonly editProductBrandId = signal<string>('');
  readonly editVariantsList = signal<VariantFormItem[]>([]);

  readonly totalPages = computed(() => 
    Math.max(1, Math.ceil(this.totalCount() / this.pageSize()))
  );

  readonly pagedProducts = computed(() => {
    const list = this.products();
    if (list.length > this.pageSize()) {
      const start = (this.currentPage() - 1) * this.pageSize();
      return list.slice(start, start + this.pageSize());
    }
    return list;
  });

  readonly startItemIndex = computed(() => {
    if (this.totalCount() === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  readonly endItemIndex = computed(() => {
    return Math.min(this.currentPage() * this.pageSize(), this.totalCount());
  });

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = Math.min(this.currentPage(), total);
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  readonly isAllCurrentPageSelected = computed(() => {
    const list = this.pagedProducts();
    if (list.length === 0) return false;
    const selected = this.selectedProductIds();
    return list.every(p => selected.has(p.id));
  });

  toggleSelectAll(): void {
    const set = new Set(this.selectedProductIds());
    const list = this.pagedProducts();
    if (this.isAllCurrentPageSelected()) {
      list.forEach(p => set.delete(p.id));
    } else {
      list.forEach(p => set.add(p.id));
    }
    this.selectedProductIds.set(set);
  }

  toggleSelectProduct(id: string): void {
    const set = new Set(this.selectedProductIds());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.selectedProductIds.set(set);
  }

  isProductSelected(id: string): boolean {
    return this.selectedProductIds().has(id);
  }

  clearSelection(): void {
    this.selectedProductIds.set(new Set());
  }

  openDeleteModal(product: AdminProductDto): void {
    this.productToDelete.set(product);
    this.isBatchDelete.set(false);
    this.deleteModalOpen.set(true);
  }

  openBatchDeleteModal(): void {
    if (this.selectedProductIds().size === 0) return;
    this.productToDelete.set(null);
    this.isBatchDelete.set(true);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    if (this.isDeleting()) return;
    this.deleteModalOpen.set(false);
    this.productToDelete.set(null);
    this.isBatchDelete.set(false);
  }

  getSelectedProductNames(): string[] {
    const selectedIds = this.selectedProductIds();
    return this.products()
      .filter(p => selectedIds.has(p.id))
      .map(p => p.name);
  }

  confirmDelete(): void {
    if (this.isDeleting()) return;

    // Master Warehouse catalog (status=all) cannot be deleted
    if (this.statusFilter() === 'all') {
      this.toast.show('Platform Master Warehouse products cannot be deleted. Edit them instead.', 'warning');
      this.closeDeleteModal();
      return;
    }

    if (this.isBatchDelete()) {
      const ids = Array.from(this.selectedProductIds());
      if (ids.length === 0) {
        this.closeDeleteModal();
        return;
      }

      this.isDeleting.set(true);
      const requests = ids.map(id => this.adminService.deleteProduct(id));

      forkJoin(requests).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.deleteModalOpen.set(false);
          this.toast.show(`Successfully deleted ${ids.length} products.`, 'success');
          this.clearSelection();
          this.fetchProducts();
        },
        error: (err) => {
          this.isDeleting.set(false);
          this.deleteModalOpen.set(false);
          this.toast.show(err?.error?.error || 'Failed to delete some products. Refreshed list.', 'warning');
          this.clearSelection();
          this.fetchProducts();
        }
      });
    } else {
      const product = this.productToDelete();
      if (!product) {
        this.closeDeleteModal();
        return;
      }

      this.isDeleting.set(true);
      this.adminService.deleteProduct(product.id).subscribe({
        next: () => {
          this.isDeleting.set(false);
          this.deleteModalOpen.set(false);
          this.productToDelete.set(null);
          
          // Remove from selected set if present
          const set = new Set(this.selectedProductIds());
          set.delete(product.id);
          this.selectedProductIds.set(set);

          this.toast.show(`Product "${product.name}" deleted successfully.`, 'info');
          this.fetchProducts();
        },
        error: (err) => {
          this.isDeleting.set(false);
          this.toast.show(err?.error?.error || 'Failed to delete product.', 'error');
        }
      });
    }
  }

  readonly actionInProgress = signal<string | null>(null);

  // Product Details Modal
  readonly detailsModalOpen = signal<boolean>(false);
  readonly selectedProductDetails = signal<AdminProductDto | null>(null);

  // Rejection modal
  readonly rejectModalOpen = signal<boolean>(false);
  readonly selectedProduct = signal<AdminProductDto | null>(null);
  readonly rejectionReason = signal<string>('');

  // Approval modal
  readonly approveModalOpen = signal<boolean>(false);
  readonly productToApprove = signal<AdminProductDto | null>(null);

  openProductDetails(product: AdminProductDto): void {
    this.selectedProductDetails.set(product);
    this.detailsModalOpen.set(true);
  }

  closeProductDetails(): void {
    this.detailsModalOpen.set(false);
    this.selectedProductDetails.set(null);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.fetchProducts();
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.fetchProducts();
  }

  formatImageUrl(url?: string | null): string {
    return this.adminService.formatImageUrl(url);
  }

  onImgError(event: Event, name?: string): void {
    const img = event.target as HTMLImageElement;
    img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Product')}&background=EA580C&color=fff&bold=true`;
  }

  ngOnInit(): void {
    // Master Warehouse is the only create destination — ignore shop assign query params.
    this.selectedShopId.set('');
    this.selectedShopName.set('');

    this.route.queryParams.subscribe(params => {
      const status = params['status'];
      if (status && ['all', 'pending', 'approved', 'rejected'].includes(status)) {
        this.statusFilter.set(status as ProductStatusFilter);
      } else {
        this.statusFilter.set('all');
      }
      this.currentPage.set(1);
      this.selectedProductIds.set(new Set());
      this.loadInitialData();
    });
  }

  loadInitialData(): void {
    // 1. Load ALL shops (from shopkeepers + public shops) so pending and active shops appear in filter
    this.adminService.getShopkeepers().subscribe({
      next: (keepers) => {
        const combined: AdminShopDto[] = [];
        (keepers || []).forEach(k => {
          if (k.storeName && !combined.some(s => s.name.toLowerCase() === k.storeName.toLowerCase())) {
            combined.push({
              id: k.shopId || k.id,
              name: k.storeName,
              slug: k.storeUrl || '',
              logoUrl: null,
              city: k.city,
              country: k.country,
              rating: k.rating || 0,
              totalProducts: k.totalProducts || 0,
              createdAt: k.createdAt
            });
          }
        });

        // Also merge public active shops
        this.adminService.getShops(1, 100).subscribe({
          next: (res) => {
            (res?.items || []).forEach(shop => {
              const existing = combined.find(s => s.name.toLowerCase() === shop.name.toLowerCase());
              if (!existing) {
                combined.push(shop);
              } else {
                existing.totalProducts = shop.totalProducts;
              }
            });
            this.shopsList.set(combined);

            if (this.selectedShopId() && !this.selectedShopName()) {
              const m = combined.find(s => s.id === this.selectedShopId());
              if (m) this.selectedShopName.set(m.name);
            }
          },
          error: () => {
            this.shopsList.set(combined);
          }
        });
      },
      error: () => {}
    });

    // 2. Load pending products counter
    this.adminService.getPendingProducts(1, 100).subscribe({
      next: (res) => {
        this.pendingProducts.set(res?.items || []);
      },
      error: () => {}
    });

    // 3. Load categories & brands for master product creation form
    this.loadCatalogLookups();

    this.fetchProducts();
  }

  private loadCatalogLookups(): void {
    this.lookupsLoading.set(true);

    forkJoin({
      cats: this.adminService.getCategories().pipe(catchError(() => of([] as AdminCategoryDto[]))),
      brands: this.adminService.getBrands().pipe(catchError(() => of([] as AdminBrandDto[])))
    }).subscribe({
      next: ({ cats, brands }) => {
        const normalizedCats = (cats || [])
          .map(c => ({ ...c, id: String(c.id ?? '') }))
          .filter(c => !!c.id && c.id !== 'undefined');
        const normalizedBrands = (brands || [])
          .map(b => ({ ...b, id: String(b.id ?? '') }))
          .filter(b => !!b.id && b.id !== 'undefined');

        this.categoriesList.set(normalizedCats);
        this.brandsList.set(normalizedBrands);

        const currentCat = this.newProductCategoryId();
        if (!currentCat || !normalizedCats.some(c => c.id === currentCat)) {
          this.newProductCategoryId.set(normalizedCats.length ? normalizedCats[0].id : '');
        }

        const currentBrand = this.newProductBrandId();
        if (currentBrand && !normalizedBrands.some(b => b.id === currentBrand)) {
          this.newProductBrandId.set('');
        }

        this.lookupsLoading.set(false);

        if (normalizedCats.length === 0) {
          this.toast.show('Categories API returned empty. Open Categories page or restart API, then try again.', 'error');
        }
      },
      error: () => {
        this.lookupsLoading.set(false);
        this.toast.show('Failed to load categories/brands from API.', 'error');
      }
    });
  }

  setCreateCategoryId(value: string | number | null | undefined): void {
    this.newProductCategoryId.set(value == null ? '' : `${value}`);
  }

  setCreateBrandId(value: string | number | null | undefined): void {
    this.newProductBrandId.set(value == null ? '' : `${value}`);
  }

  openCreateModal(): void {
    this.newProductName.set('');
    this.newProductDesc.set('');
    this.newProductPrice.set(null);
    this.newProductCategoryId.set(this.categoriesList().length > 0 ? `${this.categoriesList()[0].id}` : '');
    this.newProductBrandId.set('');
    this.selectedImageFiles.set([]);
    this.imagePreviewUrls.set([]);
    this.isBulkImageMode.set(false);
    this.enableVariants.set(true);
    this.variantsList.set([]);
    this.variantDraft = [];
    this.uploadedProductImages.set([]);
    this.createdProductId.set(null);
    this.createModalOpen.set(true);
    this.loadCatalogLookups();
  }

  closeCreateModal(): void {
    this.createModalOpen.set(false);
    this.selectedImageFiles.set([]);
    this.imagePreviewUrls.set([]);
    this.variantsList.set([]);
    this.variantDraft = [];
    this.enableVariants.set(false);
    this.uploadedProductImages.set([]);
    this.createdProductId.set(null);
  }

  setImageMode(bulk: boolean): void {
    if (this.isBulkImageMode() === bulk) return;
    this.isBulkImageMode.set(bulk);
    this.selectedImageFiles.set([]);
    this.imagePreviewUrls.set([]);
  }

  onSingleImageSelected(event: Event): void {
    this.isBulkImageMode.set(false);
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.selectedImageFiles.set([file]);
    this.imagePreviewUrls.set([]);
    const reader = new FileReader();
    reader.onload = (e) => this.imagePreviewUrls.set([e.target?.result as string]);
    reader.readAsDataURL(file);
    input.value = '';
  }

  onBulkImagesSelected(event: Event): void {
    this.isBulkImageMode.set(true);
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const files = Array.from(input.files);
    this.selectedImageFiles.set([...this.selectedImageFiles(), ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreviewUrls.set([...this.imagePreviewUrls(), e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  /** @deprecated use onSingleImageSelected / onBulkImagesSelected */
  onImagesSelected(event: Event): void {
    if (this.isBulkImageMode()) {
      this.onBulkImagesSelected(event);
    } else {
      this.onSingleImageSelected(event);
    }
  }

  /** Loads the current image set for a product so the admin can review / change the cover image. */
  loadProductImages(productId: string): void {
    this.adminService.getProductImages(productId).subscribe({
      next: (images) => this.uploadedProductImages.set(images || []),
      error: () => this.uploadedProductImages.set([])
    });
  }

  /** Sets the cover image for the product currently open in the create or edit modal. */
  setCoverImage(imageId: string): void {
    const productId = this.createdProductId() || this.editingProduct()?.id;
    if (!productId || this.isSettingCover()) return;

    this.isSettingCover.set(imageId);
    this.adminService.setProductCoverImage(productId, imageId).subscribe({
      next: () => {
        this.isSettingCover.set(null);
        this.uploadedProductImages.set(
          this.uploadedProductImages().map(img => ({ ...img, isCover: img.id === imageId }))
        );
        this.toast.show('Cover image updated successfully.', 'success');
        this.fetchProducts();
      },
      error: (err) => {
        this.isSettingCover.set(null);
        this.toast.show(err?.error?.error || 'Failed to set cover image.', 'error');
      }
    });
  }

  /** Finishes the "pick a cover image" step shown after creating a product with multiple images. */
  finishCreateWithCover(): void {
    this.closeCreateModal();
    this.fetchProducts();
  }

  /** Uploads additional images directly to an existing product while editing, then refreshes the cover picker. */
  onEditImagesSelected(event: Event): void {
    const product = this.editingProduct();
    const input = event.target as HTMLInputElement;
    if (!product || !input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    input.value = '';

    const upload$ = files.length === 1
      ? this.adminService.uploadProductImage(product.id, files[0])
      : this.adminService.uploadMultipleProductImages(product.id, files);

    upload$.subscribe({
      next: () => {
        this.toast.show(`${files.length} image(s) uploaded successfully.`, 'success');
        this.loadProductImages(product.id);
      },
      error: (err) => {
        this.toast.show(err?.error?.error || 'Failed to upload image(s).', 'error');
      }
    });
  }

  removeSelectedImage(index: number): void {
    const currentFiles = [...this.selectedImageFiles()];
    const currentUrls = [...this.imagePreviewUrls()];
    currentFiles.splice(index, 1);
    currentUrls.splice(index, 1);
    this.selectedImageFiles.set(currentFiles);
    this.imagePreviewUrls.set(currentUrls);
  }

  toggleVariants(enabled: boolean): void {
    this.enableVariants.set(enabled);
    if (!enabled) {
      // Preserve the in-progress variant rows so re-enabling restores them instead of losing data.
      this.variantDraft = this.variantsList();
      this.variantsList.set([]);
    } else if (this.variantDraft.length > 0) {
      this.variantsList.set(this.variantDraft);
      this.variantDraft = [];
    } else if (this.variantsList().length === 0) {
      this.addVariant();
    }
  }

  updateVariantField(index: number, field: keyof VariantFormItem, value: string | number): void {
    const list = [...this.variantsList()];
    if (!list[index]) return;
    list[index] = { ...list[index], [field]: value };
    this.variantsList.set(list);
  }

  onVariantImageSelected(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const list = [...this.variantsList()];
        if (list[index]) {
          list[index] = {
            ...list[index],
            imageFile: file,
            imagePreviewUrl: e.target?.result as string
          };
          this.variantsList.set(list);
        }
      };
      reader.readAsDataURL(file);
    }
    input.value = '';
  }

  onEditVariantImageSelected(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const list = [...this.editVariantsList()];
        if (list[index]) {
          list[index] = {
            ...list[index],
            imageFile: file,
            imagePreviewUrl: e.target?.result as string
          };
          this.editVariantsList.set(list);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  addVariant(): void {
    this.enableVariants.set(true);
    this.variantsList.set([
      ...this.variantsList(),
      {
        sku: '',
        price: this.newProductPrice() || 0,
        stockQty: 0,
        size: '',
        color: '',
        material: ''
      }
    ]);
  }

  removeVariant(index: number): void {
    const list = [...this.variantsList()];
    list.splice(index, 1);
    this.variantsList.set(list);
    if (list.length === 0) {
      this.enableVariants.set(false);
    }
  }

  submitCreateProduct(): void {
    if (this.isCreatingProduct()) {
      return;
    }

    const name = this.newProductName().trim();
    const price = this.newProductPrice();
    const categoryId = String(this.newProductCategoryId() || '').trim();
    const brandId = String(this.newProductBrandId() || '').trim();

    if (!name) {
      this.toast.show('Product name is required.', 'error');
      return;
    }
    if (!price || price <= 0) {
      this.toast.show('Please enter a valid base price.', 'error');
      return;
    }
    if (!categoryId) {
      this.toast.show('Please select a category.', 'error');
      return;
    }
    if (this.categoriesList().length === 0) {
      this.toast.show('No categories available. Add categories first, then create the product.', 'error');
      return;
    }

    this.isCreatingProduct.set(true);

    this.adminService.createProduct({
      name,
      description: this.newProductDesc().trim() || undefined,
      basePrice: price,
      categoryId,
      brandId: brandId || null
    }).subscribe({
      next: (res) => {
        const productId = res?.productId ? String(res.productId) : '';
        if (!productId) {
          this.isCreatingProduct.set(false);
          this.toast.show('Product created but no product ID returned.', 'warning');
          this.fetchProducts();
          return;
        }

        const files = this.selectedImageFiles();
        const variants = this.enableVariants()
          ? this.variantsList().filter(v =>
              !!(v.sku?.trim() || v.size?.trim() || v.color?.trim() || v.material?.trim() || Number(v.stockQty) > 0 || Number(v.price) > 0)
            )
          : [];

        const uploadImages$ = files.length > 0
          ? (!this.isBulkImageMode() || files.length === 1
              ? this.adminService.uploadProductImage(productId, files[0]).pipe(catchError(() => of(null)))
              : this.adminService.uploadMultipleProductImages(productId, files).pipe(catchError(() => of(null))))
          : of(null);

        const createVariants$ = variants.length > 0
          ? forkJoin(variants.map((v, idx) => {
              const attrs: { attributeName: string; attributeValue: string }[] = [];
              if (v.size?.trim()) attrs.push({ attributeName: 'Size', attributeValue: v.size.trim() });
              if (v.color?.trim()) attrs.push({ attributeName: 'Color', attributeValue: v.color.trim() });
              if (v.material?.trim()) attrs.push({ attributeName: 'Material', attributeValue: v.material.trim() });

              const sku = v.sku?.trim() || `SKU-${Date.now().toString().slice(-6)}-${idx + 1}`;

              return this.adminService.createProductVariant(productId, {
                sku,
                price: Number(v.price) > 0 ? Number(v.price) : price,
                stockQty: Number(v.stockQty) || 0,
                attributes: attrs
              }).pipe(
                switchMap(varRes => {
                  if (v.imageFile && varRes?.variantId) {
                    return this.adminService.uploadVariantImage(productId, varRes.variantId, v.imageFile).pipe(
                      catchError(() => of(null))
                    );
                  }
                  return of(varRes);
                }),
                catchError(() => of(null))
              );
            }))
          : of([]);

        forkJoin([uploadImages$, createVariants$]).subscribe({
          next: () => {
            this.isCreatingProduct.set(false);
            const parts = [`Master product "${name}" published`];
            if (files.length) parts.push(`${files.length} image(s)`);
            if (variants.length) parts.push(`${variants.length} variant(s)`);
            this.toast.show(parts.join(' · ') + '.', 'success');

            // If multiple images were uploaded, let the admin pick a cover image before closing.
            if (files.length > 1) {
              this.createdProductId.set(productId);
              this.adminService.getProductImages(productId).subscribe({
                next: (images) => this.uploadedProductImages.set(images || []),
                error: () => this.uploadedProductImages.set([])
              });
            } else {
              this.closeCreateModal();
            }
            this.fetchProducts();
          },
          error: () => {
            this.isCreatingProduct.set(false);
            this.closeCreateModal();
            this.toast.show('Product created, but some images or variants failed to save.', 'warning');
            this.fetchProducts();
          }
        });
      },
      error: (err) => {
        this.isCreatingProduct.set(false);
        this.toast.show(err?.error?.error || 'Failed to create product.', 'error');
      }
    });
  }

  openEditModal(product: AdminProductDto): void {
    this.editingProduct.set(product);
    this.editProductName.set(product.name || '');
    this.editProductDesc.set(product.description || '');
    this.editProductPrice.set(product.basePrice || 0);
    this.editProductCategoryId.set(product.categoryId || (this.categoriesList().length > 0 ? this.categoriesList()[0].id : ''));
    this.editProductBrandId.set(product.brandId || '');
    this.editVariantsList.set([]);
    this.editModalOpen.set(true);
    this.uploadedProductImages.set([]);
    this.loadProductImages(product.id);

    // Catalog list DTO has no description — load full product for edit form
    this.adminService.getProductById(product.id).subscribe({
      next: (full) => {
        if (!full) return;
        this.editingProduct.set({ ...product, ...full, id: product.id });
        this.editProductName.set(full.name || product.name || '');
        this.editProductDesc.set(full.description || '');
        this.editProductPrice.set(full.basePrice ?? product.basePrice ?? 0);
        if (full.categoryId) this.editProductCategoryId.set(full.categoryId);
        if (full.brandId) this.editProductBrandId.set(full.brandId);
      },
      error: () => {
        // Keep list values if detail fetch fails
      }
    });

    // Fetch live variants for this product
    this.adminService.getProductVariants(product.id).subscribe({
      next: (vars) => {
        if (vars && vars.length > 0) {
          this.editVariantsList.set(vars.map((v: any) => ({
            id: v.id,
            sku: v.sku || '',
            price: v.price || product.basePrice,
            stockQty: v.stockQty || 0,
            size: v.attributes?.find((a: any) => a.attributeName?.toLowerCase() === 'size')?.attributeValue || '',
            color: v.attributes?.find((a: any) => a.attributeName?.toLowerCase() === 'color')?.attributeValue || '',
            material: v.attributes?.find((a: any) => a.attributeName?.toLowerCase() === 'material')?.attributeValue || '',
            imageUrl: v.imageUrl || null
          })));
        }
      }
    });
  }

  closeEditModal(): void {
    this.editModalOpen.set(false);
    this.editingProduct.set(null);
    this.editVariantsList.set([]);
    this.uploadedProductImages.set([]);
  }

  addEditVariant(): void {
    this.editVariantsList.set([
      ...this.editVariantsList(),
      {
        sku: '',
        price: this.editProductPrice() || 0,
        stockQty: 0,
        size: '',
        color: '',
        material: ''
      }
    ]);
  }

  removeEditVariant(index: number): void {
    const list = [...this.editVariantsList()];
    const item = list[index];
    if (item && item.id && this.editingProduct()) {
      this.adminService.deleteProductVariant(this.editingProduct()!.id, item.id).subscribe({
        next: () => {
          list.splice(index, 1);
          this.editVariantsList.set(list);
          this.toast.show('Variant removed.', 'info');
        }
      });
    } else {
      list.splice(index, 1);
      this.editVariantsList.set(list);
    }
  }

  submitEditProduct(): void {
    const product = this.editingProduct();
    if (!product) return;

    const name = this.editProductName().trim();
    const price = this.editProductPrice();
    const categoryId = this.editProductCategoryId();

    if (!name) {
      this.toast.show('Product name is required.', 'error');
      return;
    }
    if (!price || price <= 0) {
      this.toast.show('Please enter a valid price.', 'error');
      return;
    }

    this.isSavingProduct.set(true);

    this.adminService.updateProduct(product.id, {
      name,
      description: this.editProductDesc().trim() || undefined,
      basePrice: price,
      categoryId: categoryId || product.categoryId || '',
      brandId: this.editProductBrandId() || undefined
    }).subscribe({
      next: () => {
        // 1. Upload images for existing variants that have a newly selected file
        const existingVariantsWithImages = this.editVariantsList().filter(v => v.id && v.imageFile);
        const imageUploadCalls = existingVariantsWithImages.map(v => 
          this.adminService.uploadVariantImage(product.id, v.id!, v.imageFile!).pipe(catchError(() => of(null)))
        );

        // 2. Create new variants and upload their images if any
        const newVariants = this.editVariantsList().filter(v => !v.id);
        const newVariantCalls = newVariants.map(v => {
          const attrs: { attributeName: string; attributeValue: string }[] = [];
          if (v.size) attrs.push({ attributeName: 'Size', attributeValue: v.size });
          if (v.color) attrs.push({ attributeName: 'Color', attributeValue: v.color });
          if (v.material) attrs.push({ attributeName: 'Material', attributeValue: v.material });

          return this.adminService.createProductVariant(product.id, {
            sku: v.sku,
            price: v.price || price,
            stockQty: v.stockQty || 0,
            attributes: attrs
          }).pipe(
            switchMap(varRes => {
              if (v.imageFile && varRes?.variantId) {
                return this.adminService.uploadVariantImage(product.id, varRes.variantId, v.imageFile).pipe(catchError(() => of(null)));
              }
              return of(varRes);
            }),
            catchError(() => of(null))
          );
        });

        const allCalls = [...imageUploadCalls, ...newVariantCalls];
        if (allCalls.length > 0) {
          forkJoin(allCalls).subscribe({
            next: () => {
              this.isSavingProduct.set(false);
              this.closeEditModal();
              this.toast.show(`Product "${name}" and variants updated successfully!`, 'success');
              this.fetchProducts();
            },
            error: () => {
              this.isSavingProduct.set(false);
              this.closeEditModal();
              this.toast.show(`Product updated, but some variant images failed.`, 'warning');
              this.fetchProducts();
            }
          });
        } else {
          this.isSavingProduct.set(false);
          this.closeEditModal();
          this.toast.show(`Product "${name}" updated successfully!`, 'success');
          this.fetchProducts();
        }
      },
      error: (err) => {
        this.isSavingProduct.set(false);
        this.toast.show(err?.error?.error || 'Failed to update product.', 'error');
      }
    });
  }

  deleteProduct(product: AdminProductDto): void {
    this.openDeleteModal(product);
  }

  fetchProducts(): void {
    this.isLoading.set(true);

    const applyFilters = <T extends AdminProductDto>(list: T[]): T[] => {
      let result = list;

      // Shop filter — pending & approved merchant listing tables
      if (
        (this.statusFilter() === 'pending' || this.statusFilter() === 'approved' || this.statusFilter() === 'rejected') &&
        (this.selectedShopName() || this.selectedShopId())
      ) {
        const targetName = this.selectedShopName().trim().toLowerCase();
        const targetId = this.selectedShopId().trim().toLowerCase();
        result = result.filter(p => {
          const shopName = (p.shopName || '').toLowerCase();
          const shopId = (p.shopId || '').toLowerCase();
          return (
            (!!targetId && !!shopId && shopId === targetId) ||
            (!!targetName && shopName === targetName) ||
            (!!targetName && shopName.includes(targetName))
          );
        });
      }

      // Filter by Category
      if (this.selectedCategoryId()) {
        const catId = this.selectedCategoryId().trim().toLowerCase();
        const catObj = this.categoriesList().find(c => c.id.toLowerCase() === catId);
        const catName = catObj?.name.toLowerCase() || '';
        result = result.filter(p => 
          (p.categoryId && p.categoryId.toLowerCase() === catId) ||
          (p.categoryName && (p.categoryName.toLowerCase() === catName || p.categoryName.toLowerCase() === catId))
        );
      }

      // Filter by Brand
      if (this.selectedBrandId()) {
        const brandId = this.selectedBrandId().trim().toLowerCase();
        const brandObj = this.brandsList().find(b => b.id.toLowerCase() === brandId);
        const brandName = brandObj?.name.toLowerCase() || '';
        result = result.filter(p => 
          (p.brandId && p.brandId.toLowerCase() === brandId) ||
          (p.brandName && (p.brandName.toLowerCase() === brandName || p.brandName.toLowerCase() === brandId))
        );
      }

      // Filter by Search Term
      if (this.searchTerm().trim()) {
        const term = this.searchTerm().trim().toLowerCase();
        result = result.filter(p => 
          p.name.toLowerCase().includes(term) || 
          p.categoryName?.toLowerCase().includes(term) ||
          p.brandName?.toLowerCase().includes(term) ||
          p.shopName?.toLowerCase().includes(term)
        );
      }

      return result;
    };

    if (this.statusFilter() === 'pending') {
      // Merchant listing requests only
      this.adminService.getPendingProducts(1, 200).subscribe({
        next: (res) => {
          let items = res?.items || [];
          items = applyFilters(items);
          this.products.set(items);
          this.totalCount.set(items.length);
          this.pendingProducts.set(items);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.toast.show(err?.error?.error || 'Failed to fetch pending products.', 'error');
        }
      });
    } else if (this.statusFilter() === 'all') {
      // Super Admin master warehouse products ONLY — never mix merchant requests
      this.adminService.getProducts(undefined, undefined, 1, 500).subscribe({
        next: (catalogRes) => {
          const items = applyFilters(catalogRes?.items || []);
          this.products.set(items);
          this.totalCount.set(items.length);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.toast.show(err?.error?.error || 'Failed to load master catalog products.', 'error');
        }
      });
    } else if (this.statusFilter() === 'rejected') {
      this.adminService.getRejectedProducts(1, 500).subscribe({
        next: (res) => {
          const items = applyFilters((res?.items || []).map(p => ({ ...p, status: 'Rejected' })));
          this.products.set(items);
          this.totalCount.set(items.length);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.toast.show(err?.error?.error || 'Failed to fetch rejected products.', 'error');
        }
      });
    } else if (this.statusFilter() === 'approved') {
      // Approved merchant store listings only
      this.adminService.getApprovedSellerProducts(1, 500).subscribe({
        next: (res) => {
          const items = applyFilters((res?.items || []).map(p => ({ ...p, isApproved: true })));
          this.products.set(items);
          this.totalCount.set(items.length);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.toast.show(err?.error?.error || 'Failed to fetch approved products.', 'error');
        }
      });
    } else {
      this.adminService.getProducts(undefined, undefined, 1, 500).subscribe({
        next: (res) => {
          let items = res?.items || [];
          items = applyFilters(items);
          this.products.set(items);
          this.totalCount.set(items.length);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.toast.show(err?.error?.error || 'Failed to fetch products.', 'error');
        }
      });
    }
  }


  onCategoryFilterChange(categoryId: string): void {
    this.selectedCategoryId.set(categoryId);
    this.currentPage.set(1);
    this.fetchProducts();
  }

  onBrandFilterChange(brandId: string): void {
    this.selectedBrandId.set(brandId);
    this.currentPage.set(1);
    this.fetchProducts();
  }

  onShopFilterChange(shopIdentifier: string): void {
    if (!shopIdentifier) {
      this.clearShopFilter();
      return;
    }
    const val = shopIdentifier.trim().toLowerCase();
    const shop = this.shopsList().find(s => s.id.toLowerCase() === val || s.name.toLowerCase() === val);
    if (shop) {
      this.selectedShopName.set(shop.name);
      this.selectedShopId.set(shop.id);
    } else {
      this.selectedShopName.set(shopIdentifier);
      this.selectedShopId.set('');
    }
    this.currentPage.set(1);
    this.fetchProducts();
  }

  clearShopFilter(): void {
    this.selectedShopId.set('');
    this.selectedShopName.set('');
    this.currentPage.set(1);
    this.fetchProducts();
  }

  onStatusTabChange(tab: ProductStatusFilter): void {
    this.statusFilter.set(tab);
    this.currentPage.set(1);
    this.selectedProductIds.set(new Set());
    if (tab === 'all') {
      this.selectedShopId.set('');
      this.selectedShopName.set('');
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: tab },
      queryParamsHandling: 'merge'
    });
  }

  pageTitle(): string {
    switch (this.statusFilter()) {
      case 'pending': return 'Pending Products';
      case 'approved': return 'Approved Products';
      case 'rejected': return 'Rejected Products';
      default: return 'All Products';
    }
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.fetchProducts();
  }

  openBatchApproveModal(): void {
    if (this.selectedProductIds().size === 0) return;
    this.batchApproveModalOpen.set(true);
  }

  closeBatchApproveModal(): void {
    if (this.isBatchApproving()) return;
    this.batchApproveModalOpen.set(false);
  }

  confirmBatchApprove(): void {
    if (this.isBatchApproving()) return;
    const ids = Array.from(this.selectedProductIds());
    if (ids.length === 0) {
      this.closeBatchApproveModal();
      return;
    }

    this.isBatchApproving.set(true);
    this.adminService.approveProductsBulk(ids).subscribe({
      next: () => {
        this.isBatchApproving.set(false);
        this.batchApproveModalOpen.set(false);
        this.toast.show(`Successfully approved ${ids.length} products.`, 'success');
        this.clearSelection();
        this.loadInitialData();
      },
      error: (err) => {
        this.isBatchApproving.set(false);
        this.batchApproveModalOpen.set(false);
        this.toast.show(err?.error?.error || 'Failed to approve some products. Refreshed list.', 'warning');
        this.clearSelection();
        this.loadInitialData();
      }
    });
  }

  openApproveModal(product: AdminProductDto): void {
    this.productToApprove.set(product);
    this.approveModalOpen.set(true);
  }

  closeApproveModal(): void {
    this.approveModalOpen.set(false);
    this.productToApprove.set(null);
  }

  confirmApproveProduct(): void {
    const product = this.productToApprove();
    if (!product) return;
    this.closeApproveModal();
    this.approveProduct(product);
  }

  approveProduct(product: AdminProductDto): void {
    this.actionInProgress.set(product.id);
    this.adminService.approveProduct(product.id).subscribe({
      next: () => {
        this.toast.show(
          product.sourceProductId
            ? `"${product.name}" approved — now live on the seller’s shop.`
            : `Product "${product.name}" approved successfully!`,
          'success'
        );
        this.actionInProgress.set(null);
        this.loadInitialData();
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to approve product.', 'error');
      }
    });
  }

  toggleStorefrontLive(product: AdminProductDto): void {
    const next = !product.isStorefrontLive;
    this.actionInProgress.set(product.id);
    this.adminService.setStorefrontLive(product.id, next).subscribe({
      next: (res) => {
        this.toast.show(
          res?.message ||
            (next
              ? `"${product.name}" is now live on the website.`
              : `"${product.name}" removed from website (Warehouse only).`),
          'success'
        );
        this.actionInProgress.set(null);
        this.loadInitialData();
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to update website visibility.', 'error');
      }
    });
  }

  openRejectModal(product: AdminProductDto): void {
    this.selectedProduct.set(product);
    this.rejectionReason.set('');
    this.rejectModalOpen.set(true);
  }

  closeRejectModal(): void {
    this.rejectModalOpen.set(false);
    this.selectedProduct.set(null);
    this.rejectionReason.set('');
  }

  confirmReject(): void {
    const product = this.selectedProduct();
    const reason = this.rejectionReason().trim();

    if (!product) return;
    if (!reason) {
      this.toast.show('Please provide a reason for rejecting the product.', 'error');
      return;
    }

    this.actionInProgress.set(product.id);
    this.closeRejectModal();

    this.adminService.rejectProduct(product.id, reason).subscribe({
      next: () => {
        this.toast.show(`Product "${product.name}" rejected.`, 'info');
        this.actionInProgress.set(null);
        this.loadInitialData();
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to reject product.', 'error');
      }
    });
  }
}
