import { Component, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { 
  SellerProductService, 
  CreateProductDto, 
  UpdateProductDto, 
  ProductImageDto,
  CreateVariantRequest
} from '../../../core/services/product.service';
import { SellerService } from '../../../core/services/seller.service';
import { ToastService, HomeService, CategoryTreeDto, BrandDto } from 'eseller-shared';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';
import { StepBasicComponent, FlatCategoryOption } from './steps/step-basic/step-basic.component';
import { StepMediaComponent, QueuedImage } from './steps/step-media/step-media.component';
import { StepVariantsComponent, FormVariant } from './steps/step-variants/step-variants.component';
import { forkJoin, of, catchError, Observable, switchMap, map } from 'rxjs';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterLink, 
    ConfirmModal,
    StepBasicComponent,
    StepMediaComponent,
    StepVariantsComponent
  ],
  templateUrl: './product-form.html'
})
export class ProductForm implements OnInit {
  private readonly productService = inject(SellerProductService);
  private readonly sellerService = inject(SellerService);
  private readonly homeService = inject(HomeService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Stepper State
  readonly currentStep = signal<number>(1);
  readonly steps = [
    { number: 1, label: 'Basic Info', icon: '📋' },
    { number: 2, label: 'Media & Photos', icon: '📸' },
    { number: 3, label: 'Variants & Stock', icon: '🏷️' },
    { number: 4, label: 'Review & Publish', icon: '🔍' }
  ];

  readonly isSubmitting = signal<boolean>(false);
  readonly submittingStep = signal<string>('Saving Product...');
  readonly isLoadingProduct = signal<boolean>(false);
  readonly isLoadingShop = signal<boolean>(true);
  readonly isEditMode = signal<boolean>(false);
  readonly productId = signal<string | null>(null);
  readonly currentShopId = signal<string | null>(null);

  // Success Modal State
  readonly savedProduct = signal<{ id?: string; name: string; isEdit: boolean } | null>(null);

  // Reference Data
  readonly categories = signal<FlatCategoryOption[]>([]);
  readonly brands = signal<BrandDto[]>([]);

  // Step 1: Basic Info
  name = signal<string>('');
  description = signal<string>('');
  basePrice = signal<number | null>(null);
  categoryId = signal<string>('');
  brandId = signal<string>('');
  seoTitle = signal<string>('');
  seoDescription = signal<string>('');

  nameError = signal<string | null>(null);
  priceError = signal<string | null>(null);
  categoryError = signal<string | null>(null);

  // Step 2: Media
  readonly primaryImageUrl = signal<string | null>(null);
  readonly queuedImages = signal<QueuedImage[]>([]);
  readonly existingImages = signal<ProductImageDto[]>([]);
  readonly isLoadingImages = signal<boolean>(false);
  readonly isUploadingNewImage = signal<boolean>(false);
  readonly imageToDelete = signal<ProductImageDto | null>(null);
  readonly isDeletingImage = signal<boolean>(false);

  // Step 3: Variants
  readonly hasVariants = signal<boolean>(false);
  readonly variants = signal<FormVariant[]>([]);

  // Computed helper for Review step
  readonly selectedCategoryName = computed(() => {
    const id = this.categoryId();
    if (!id) return '';
    return this.categories().find(c => c.id === id)?.name || '';
  });

  readonly selectedBrandName = computed(() => {
    const id = this.brandId();
    if (!id) return '';
    return this.brands().find(b => b.id === id)?.name || '';
  });

  ngOnInit() {
    this.loadShop();
    this.loadCategoriesAndBrands();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.productId.set(id);
      this.loadProduct(id);
      this.loadProductImages(id);
      this.loadProductVariants(id);
    } else {
      const prefillCatId = this.route.snapshot.queryParamMap.get('categoryId');
      if (prefillCatId) {
        this.categoryId.set(prefillCatId);
      }
    }
  }

  private loadShop() {
    this.isLoadingShop.set(true);
    this.sellerService.getMyShop().subscribe({
      next: (shop) => {
        if (shop?.id) {
          this.currentShopId.set(shop.id);
        }
        this.isLoadingShop.set(false);
      },
      error: () => {
        this.isLoadingShop.set(false);
        this.toast.show('Could not identify current shopkeeper profile', 'error');
      }
    });
  }

  private loadCategoriesAndBrands() {
    this.homeService.getCategories(true).subscribe({
      next: (tree) => {
        this.categories.set(this.flattenCategories(tree));
      },
      error: () => {
        this.toast.show('Failed to load categories', 'error');
      }
    });

    this.homeService.getBrands().subscribe({
      next: (b) => this.brands.set(b || []),
      error: () => {}
    });
  }

  private flattenCategories(tree: CategoryTreeDto[], level = 0, prefix = ''): FlatCategoryOption[] {
    const list: FlatCategoryOption[] = [];
    if (!tree) return list;
    for (const node of tree) {
      const displayName = prefix ? `${prefix} › ${node.name}` : node.name;
      list.push({ id: node.id, name: displayName, slug: node.slug, level, imageUrl: node.imageUrl });
      if (node.children && node.children.length > 0) {
        list.push(...this.flattenCategories(node.children, level + 1, displayName));
      }
    }
    return list;
  }

  private loadProduct(id: string) {
    this.isLoadingProduct.set(true);
    this.productService.getProductById(id).subscribe({
      next: (product) => {
        this.name.set(product.name || '');
        this.basePrice.set(product.basePrice);
        this.categoryId.set(product.categoryId || '');
        this.brandId.set(product.brandId || '');
        this.description.set(product.description || '');
        this.seoTitle.set(product.seoTitle || '');
        this.seoDescription.set(product.seoDescription || '');
        this.isLoadingProduct.set(false);
      },
      error: () => {
        // Fallback: If GetProductById fails (e.g. pending product on older backend build), load from seller products
        this.sellerService.getMyShop().subscribe({
          next: (shop) => {
            if (shop?.id) {
              this.productService.getSellerProducts(shop.id, 1, 100).subscribe({
                next: (res) => {
                  const found = res.items.find(p => p.id === id);
                  if (found) {
                    this.name.set(found.name || '');
                    this.basePrice.set(found.basePrice);
                    if (found.primaryImageUrl) {
                      this.primaryImageUrl.set(found.primaryImageUrl);
                      if (this.existingImages().length === 0) {
                        this.existingImages.set([{
                          id: 'cover-' + id,
                          productId: id,
                          imageUrl: found.primaryImageUrl,
                          sortOrder: 0
                        }]);
                      }
                    }
                    if (found.categoryName && !this.categoryId()) {
                      const matchedCat = this.categories().find(c => 
                        c.name.toLowerCase().includes((found.categoryName || '').toLowerCase())
                      );
                      if (matchedCat) {
                        this.categoryId.set(matchedCat.id);
                      }
                    }
                    this.isLoadingProduct.set(false);
                    return;
                  }
                  this.isLoadingProduct.set(false);
                  this.toast.show('Failed to load product details', 'error');
                },
                error: () => {
                  this.isLoadingProduct.set(false);
                  this.toast.show('Failed to load product details', 'error');
                }
              });
            } else {
              this.isLoadingProduct.set(false);
              this.toast.show('Failed to load product details', 'error');
            }
          },
          error: () => {
            this.isLoadingProduct.set(false);
            this.toast.show('Failed to load product details', 'error');
          }
        });
      }
    });
  }

  loadProductImages(productId: string) {
    this.isLoadingImages.set(true);
    this.productService.getProductImages(productId).subscribe({
      next: (imgs) => {
        if (imgs && imgs.length > 0) {
          this.existingImages.set(imgs);
          this.primaryImageUrl.set(imgs[0].imageUrl);
        } else if (this.primaryImageUrl()) {
          this.existingImages.set([{
            id: 'cover-' + productId,
            productId,
            imageUrl: this.primaryImageUrl()!,
            sortOrder: 0
          }]);
        } else {
          this.existingImages.set([]);
        }
        this.isLoadingImages.set(false);
      },
      error: () => {
        if (this.primaryImageUrl()) {
          this.existingImages.set([{
            id: 'cover-' + productId,
            productId,
            imageUrl: this.primaryImageUrl()!,
            sortOrder: 0
          }]);
        }
        this.isLoadingImages.set(false);
      }
    });
  }

  loadProductVariants(productId: string) {
    this.productService.getProductVariants(productId).subscribe({
      next: (res) => {
        if (res && res.length > 0) {
          this.hasVariants.set(true);
          const formVars: FormVariant[] = res.map(v => ({
            id: v.id,
            sku: v.sku,
            price: v.price,
            stockQty: v.stockQty,
            lowStockThreshold: v.lowStockThreshold,
            attributes: (v.attributes || []).map(a => ({ name: a.attributeName, value: a.attributeValue })),
            imageUrl: v.imageUrl ?? null
          }));
          this.variants.set(formVars);
        }
      },
      error: () => {}
    });
  }

  // Stepper Navigation
  canProceedFromStep1(): boolean {
    let isValid = true;
    this.nameError.set(null);
    this.priceError.set(null);
    this.categoryError.set(null);

    if (!this.name().trim()) {
      this.nameError.set('Product title is required.');
      isValid = false;
    }
    if (this.basePrice() == null || this.basePrice()! <= 0) {
      this.priceError.set('A valid base price greater than 0 is required.');
      isValid = false;
    }
    if (!this.categoryId()) {
      this.categoryError.set('Please select a category for this product.');
      isValid = false;
    }

    if (!isValid) {
      this.toast.show('Please fill in all required fields in Basic Info.', 'warning');
    }
    return isValid;
  }

  canProceedFromStep3(): boolean {
    if (!this.hasVariants()) return true;

    const list = this.variants();
    if (list.length === 0) {
      this.toast.show('You enabled variants. Please add at least 1 variant or disable the toggle.', 'warning');
      return false;
    }

    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (!v.sku.trim()) {
        this.toast.show(`Variant #${i + 1} is missing a SKU code.`, 'warning');
        return false;
      }
      if (v.price <= 0) {
        this.toast.show(`Variant #${i + 1} must have a price greater than 0.`, 'warning');
        return false;
      }
    }

    return true;
  }

  goToStep(stepNumber: number) {
    if (stepNumber === this.currentStep()) return;

    // Moving forward
    if (stepNumber > this.currentStep()) {
      if (this.currentStep() === 1 && !this.canProceedFromStep1()) return;
      if (this.currentStep() === 3 && !this.canProceedFromStep3()) return;
    }

    this.currentStep.set(stepNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextStep() {
    const cur = this.currentStep();
    if (cur === 1 && !this.canProceedFromStep1()) return;
    if (cur === 3 && !this.canProceedFromStep3()) return;

    if (cur < 4) {
      this.currentStep.set(cur + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  prevStep() {
    const cur = this.currentStep();
    if (cur > 1) {
      this.currentStep.set(cur - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Step 2 Media Handlers
  onFilesQueued(newFiles: QueuedImage[]) {
    this.queuedImages.update(list => [...list, ...newFiles]);
  }

  onRemoveQueued(index: number) {
    const img = this.queuedImages()[index];
    if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl);
    this.queuedImages.update(list => list.filter((_, i) => i !== index));
  }

  onClearAllQueued() {
    for (const q of this.queuedImages()) {
      if (q.previewUrl) URL.revokeObjectURL(q.previewUrl);
    }
    this.queuedImages.set([]);
  }

  onReorderCover(index: number) {
    this.queuedImages.update(list => {
      if (index <= 0 || index >= list.length) return list;
      const copy = [...list];
      const [item] = copy.splice(index, 1);
      copy.unshift(item);
      return copy;
    });
  }

  onDirectUploadFile(file: File) {
    const pId = this.productId();
    if (!pId) return;

    this.isUploadingNewImage.set(true);
    this.productService.uploadImage(pId, file).subscribe({
      next: () => {
        this.isUploadingNewImage.set(false);
        this.toast.show('Photo uploaded successfully!', 'success');
        this.loadProductImages(pId);
      },
      error: (err) => {
        this.isUploadingNewImage.set(false);
        this.toast.show(err.error?.message || 'Failed to upload photo', 'error');
      }
    });
  }

  promptDeleteImage(img: ProductImageDto) {
    this.imageToDelete.set(img);
  }

  cancelDeleteImage() {
    this.imageToDelete.set(null);
  }

  confirmDeleteImage() {
    const img = this.imageToDelete();
    const pId = this.productId();
    if (!img || !pId) return;

    this.isDeletingImage.set(true);
    this.productService.deleteProductImage(pId, img.id).subscribe({
      next: () => {
        this.isDeletingImage.set(false);
        this.imageToDelete.set(null);
        this.toast.show('Image removed successfully', 'success');
        this.loadProductImages(pId);
      },
      error: (err) => {
        this.isDeletingImage.set(false);
        this.toast.show(err.error?.message || 'Failed to delete image', 'error');
      }
    });
  }

  scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Build variant create requests — always at least one default SKU when none provided. */
  private buildVariantRequests(productId: string): Observable<{ variantId: string; message: string } | null>[] {
    const listed = this.hasVariants() ? this.variants() : [];
    const source: FormVariant[] = listed.length > 0
      ? listed
      : [{
          sku: this.slugSku(this.name() || 'SKU'),
          price: Number(this.basePrice()) || 0,
          stockQty: 1,
          lowStockThreshold: 2,
          attributes: [{ name: 'Option', value: 'Standard' }]
        }];

    return source.map(v => {
      const validAttrs = (v.attributes || [])
        .filter(a => a.name?.trim() && a.value?.trim())
        .map(a => ({ attributeName: a.name.trim(), attributeValue: a.value.trim() }));

      const safeAttrs = validAttrs.length > 0
        ? validAttrs
        : [{ attributeName: 'Option', attributeValue: 'Standard' }];

      const req: CreateVariantRequest = {
        sku: (v.sku || this.slugSku(this.name())).trim(),
        price: Number(v.price) || Number(this.basePrice()) || 0,
        stockQty: Number(v.stockQty) || 0,
        lowStockThreshold: Number(v.lowStockThreshold) || 2,
        attributes: safeAttrs
      };
      return this.productService.createProductVariant(productId, req).pipe(
        switchMap(varRes => {
          if (v.imageFile && varRes?.variantId) {
            return this.productService.uploadVariantImage(productId, varRes.variantId, v.imageFile).pipe(
              map(() => varRes),
              catchError(() => of(varRes))
            );
          }
          return of(varRes);
        }),
        catchError(() => of(null))
      );
    });
  }

  private slugSku(name: string): string {
    const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20);
    return `${base || 'SKU'}-${Date.now().toString(36).slice(-4)}`;
  }

  // Single-form submit (create/update + images + variants)
  onFinalSubmit() {
    if (!this.canProceedFromStep1()) {
      this.toast.show('Please complete name, price, and category.', 'warning');
      return;
    }
    if (this.hasVariants() && this.variants().length > 0 && !this.canProceedFromStep3()) {
      this.toast.show('Please fix variant details before submitting.', 'warning');
      return;
    }

    const shopId = this.currentShopId();
    if (!shopId && !this.isEditMode()) {
      this.toast.show('Storekeeper profile is still loading...', 'warning');
      return;
    }

    this.isSubmitting.set(true);

    if (this.isEditMode() && this.productId()) {
      this.submittingStep.set('Updating product details...');
      const updateDto: UpdateProductDto = {
        name: this.name().trim(),
        basePrice: Number(this.basePrice()),
        categoryId: this.categoryId(),
        brandId: this.brandId() ? this.brandId() : null,
        description: this.description().trim() || undefined,
        seoTitle: this.seoTitle().trim() || undefined,
        seoDescription: this.seoDescription().trim() || undefined
      };

      this.productService.updateProduct(this.productId()!, updateDto).subscribe({
        next: (res) => {
          // Check for newly added variants without an existing ID
          const newVariants = this.hasVariants() 
            ? this.variants().filter(v => !v.id) 
            : [];

          if (newVariants.length > 0) {
            this.submittingStep.set(`Creating ${newVariants.length} new variant(s)...`);
            const pId = this.productId()!;
            const variantRequests$ = newVariants.map(v => {
              const validAttrs = (v.attributes || [])
                .filter(a => a.name?.trim() && a.value?.trim())
                .map(a => ({ attributeName: a.name.trim(), attributeValue: a.value.trim() }));

              const safeAttrs = validAttrs.length > 0 
                ? validAttrs 
                : [{ attributeName: 'Option', attributeValue: 'Standard' }];

              const req: CreateVariantRequest = {
                sku: v.sku.trim(),
                price: Number(v.price),
                stockQty: Number(v.stockQty),
                lowStockThreshold: Number(v.lowStockThreshold),
                attributes: safeAttrs
              };
              return this.productService.createProductVariant(pId, req).pipe(
                catchError(() => of(null))
              );
            });

            forkJoin(variantRequests$).subscribe(() => {
              this.isSubmitting.set(false);
              this.savedProduct.set({ id: this.productId()!, name: this.name(), isEdit: true });
              this.toast.show('Product and variants updated successfully!', 'success');
            });
          } else {
            this.isSubmitting.set(false);
            this.savedProduct.set({ id: this.productId()!, name: this.name(), isEdit: true });
            this.toast.show(res?.message || 'Product updated successfully!', 'success');
          }
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.toast.show(err.error?.message || 'Failed to update product', 'error');
        }
      });
    } else {
      // Create New Product
      this.submittingStep.set('1/3 Creating product record in catalog...');
      const createDto: CreateProductDto = {
        shopId: shopId!,
        name: this.name().trim(),
        basePrice: Number(this.basePrice()),
        categoryId: this.categoryId(),
        brandId: this.brandId() ? this.brandId() : null,
        description: this.description().trim() || undefined,
        seoTitle: this.seoTitle().trim() || undefined,
        seoDescription: this.seoDescription().trim() || undefined
      };

      this.productService.createProduct(createDto).subscribe({
        next: (res) => {
          const newProductId = res.productId || res.id;
          if (!newProductId) {
            this.isSubmitting.set(false);
            this.toast.show('Failed to obtain new product ID', 'error');
            return;
          }

          const queued = this.queuedImages();
          this.submittingStep.set(`2/3 Uploading ${queued.length} product photos...`);

          const afterImages = () => {
            this.submittingStep.set('3/3 Creating inventory variants...');
            const variantRequests$ = this.buildVariantRequests(newProductId);
            forkJoin(variantRequests$).subscribe({
              next: () => this.finishCreation(newProductId),
              error: () => this.finishCreation(newProductId)
            });
          };

          if (queued.length === 0) {
            afterImages();
            return;
          }

          this.productService.uploadMultipleImages(newProductId, queued.map(q => q.file)).subscribe({
            next: () => afterImages(),
            error: (imgErr) => {
              this.isSubmitting.set(false);
              const msg = imgErr?.error || imgErr?.error?.error || imgErr?.message || 'Photo upload failed';
              this.toast.show(`Product created but images failed: ${msg}. Open the product to re-upload photos.`, 'error');
              this.finishCreation(newProductId);
            }
          });
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const msg = err.error?.error || err.error?.message || err.message || 'Failed to create product';
          this.toast.show(msg, 'error');
        }
      });
    }
  }

  private finishCreation(newProductId: string) {
    this.isSubmitting.set(false);
    for (const q of this.queuedImages()) {
      if (q.previewUrl) URL.revokeObjectURL(q.previewUrl);
    }
    this.queuedImages.set([]);
    this.savedProduct.set({ id: newProductId, name: this.name(), isEdit: false });
    this.toast.show('Product submitted for Super Admin approval.', 'success');
  }

  closeSuccessModal() {
    this.savedProduct.set(null);
  }

  @HostListener('window:keydown.escape')
  onEscape() {
    if (this.savedProduct()) {
      this.closeSuccessModal();
    }
    if (this.imageToDelete()) {
      this.cancelDeleteImage();
    }
  }

  goToVariants() {
    const p = this.savedProduct();
    this.savedProduct.set(null);
    if (p?.id) {
      this.router.navigate(['/products', p.id, 'variants']);
    } else {
      this.router.navigate(['/variants']);
    }
  }

  goToCatalog() {
    this.savedProduct.set(null);
    this.router.navigate(['/products']);
  }

  resetForNewProduct() {
    this.savedProduct.set(null);
    this.currentStep.set(1);
    this.name.set('');
    this.description.set('');
    this.basePrice.set(null);
    this.categoryId.set('');
    this.brandId.set('');
    this.seoTitle.set('');
    this.seoDescription.set('');
    this.hasVariants.set(false);
    this.variants.set([]);
    this.queuedImages.set([]);
  }
}
