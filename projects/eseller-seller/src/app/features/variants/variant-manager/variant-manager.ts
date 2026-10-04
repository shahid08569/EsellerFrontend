import { Component, OnInit, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { 
  SellerProductService, 
  ProductVariantDto, 
  CreateVariantRequest, 
  UpdateVariantRequest 
} from '../../../core/services/product.service';
import { SellerService } from '../../../core/services/seller.service';
import { ProductListDto, ProductDto, ToastService } from 'eseller-shared';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';
import { ImageUrlPipe } from '../../../shared/pipes/image-url.pipe';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';

interface AttributeRow {
  attributeName: string;
  attributeValue: string;
}

@Component({
  selector: 'app-variant-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmModal, ImageUrlPipe, ImgFallbackDirective],
  templateUrl: './variant-manager.html'
})
export class VariantManager implements OnInit {
  private readonly productService = inject(SellerProductService);
  private readonly sellerService = inject(SellerService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly allProducts = signal<ProductListDto[]>([]);
  readonly selectedProductId = signal<string>('');
  readonly selectedProduct = signal<ProductDto | null>(null);
  readonly variants = signal<ProductVariantDto[]>([]);
  
  readonly isLoadingProducts = signal<boolean>(false);
  readonly isLoadingVariants = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly uploadingVariantId = signal<string | null>(null);

  // Edit/Add Variant Modal State
  readonly showModal = signal<boolean>(false);
  readonly editingVariantId = signal<string | null>(null);

  // Delete Variant Modal State
  readonly variantToDelete = signal<{ id: string; sku: string } | null>(null);
  readonly isDeletingVariant = signal<boolean>(false);

  // Remove Image Modal State
  readonly imageVariantIdToRemove = signal<string | null>(null);
  readonly isRemovingImage = signal<boolean>(false);

  // Form Fields
  formSku = signal<string>('');
  formPrice = signal<number | null>(null);
  formStockQty = signal<number>(0);
  formLowStockThreshold = signal<number>(5);
  formIsActive = signal<boolean>(true);
  formAttributes = signal<AttributeRow[]>([]);

  ngOnInit() {
    this.loadAllProducts();

    this.route.paramMap.subscribe(params => {
      const pId = params.get('productId');
      if (pId) {
        this.selectedProductId.set(pId);
        this.onProductSelected(pId);
      }
    });

    this.route.queryParamMap.subscribe(qParams => {
      const qpId = qParams.get('productId');
      if (qpId && !this.selectedProductId()) {
        this.selectedProductId.set(qpId);
        this.onProductSelected(qpId);
      }
    });
  }

  loadAllProducts() {
    this.isLoadingProducts.set(true);
    this.sellerService.getMyShop().subscribe({
      next: (shop) => {
        const shopId = shop?.id;
        this.productService.getSellerProducts(shopId, 1, 100).subscribe({
          next: (res) => {
            this.allProducts.set(res.items);
            this.isLoadingProducts.set(false);

            if (!this.selectedProductId() && res.items.length > 0) {
              this.selectedProductId.set(res.items[0].id);
              this.onProductSelected(res.items[0].id);
            }
          },
          error: () => {
            this.isLoadingProducts.set(false);
            this.toast.show('Failed to load products list', 'error');
          }
        });
      },
      error: () => {
        this.isLoadingProducts.set(false);
      }
    });
  }

  onProductSelected(productId: string) {
    if (!productId) {
      this.selectedProduct.set(null);
      this.variants.set([]);
      return;
    }

    this.selectedProductId.set(productId);

    this.productService.getProductById(productId).subscribe({
      next: (p) => this.selectedProduct.set(p),
      error: () => {}
    });

    this.loadVariants(productId);
  }

  loadVariants(productId: string) {
    this.isLoadingVariants.set(true);
    this.productService.getProductVariants(productId).subscribe({
      next: (vars) => {
        this.variants.set(vars);
        this.isLoadingVariants.set(false);
      },
      error: () => {
        this.isLoadingVariants.set(false);
        this.toast.show('Failed to load product variants', 'error');
      }
    });
  }

  openCreateModal() {
    this.editingVariantId.set(null);
    const p = this.selectedProduct();
    this.formSku.set('');
    this.formPrice.set(p?.basePrice ?? 0);
    this.formStockQty.set(10);
    this.formLowStockThreshold.set(3);
    this.formIsActive.set(true);
    this.formAttributes.set([
      { attributeName: 'Size', attributeValue: 'Medium' }
    ]);
    this.showModal.set(true);
  }

  openEditModal(v: ProductVariantDto) {
    this.editingVariantId.set(v.id);
    this.formSku.set(v.sku);
    this.formPrice.set(v.price);
    this.formStockQty.set(v.stockQty);
    this.formLowStockThreshold.set(v.lowStockThreshold);
    this.formIsActive.set(v.isActive);

    const attrs: AttributeRow[] = (v.attributes || []).map(a => ({
      attributeName: a.attributeName,
      attributeValue: a.attributeValue
    }));
    this.formAttributes.set(attrs.length > 0 ? attrs : [{ attributeName: 'Option', attributeValue: 'Standard' }]);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingVariantId.set(null);
  }

  @HostListener('window:keydown.escape')
  onEscape() {
    if (this.showModal()) {
      this.closeModal();
    }
  }

  addAttributeRow() {
    this.formAttributes.update(list => [...list, { attributeName: '', attributeValue: '' }]);
  }

  removeAttributeRow(index: number) {
    this.formAttributes.update(list => list.filter((_, i) => i !== index));
  }

  saveVariant() {
    const pId = this.selectedProductId();
    if (!pId) return;

    const sku = this.formSku().trim();
    if (!sku) {
      this.toast.show('SKU code is required (e.g. PROD-RED-M)', 'error');
      return;
    }
    const price = Number(this.formPrice());
    if (price <= 0) {
      this.toast.show('Price must be greater than 0', 'error');
      return;
    }

    const validAttrs = this.formAttributes()
      .filter(a => a.attributeName.trim() && a.attributeValue.trim())
      .map(a => ({
        attributeName: a.attributeName.trim(),
        attributeValue: a.attributeValue.trim()
      }));

    if (validAttrs.length === 0) {
      this.toast.show('At least one attribute is required (e.g. Size: Medium or Color: Blue).', 'warning');
      return;
    }

    // Check duplicate attribute names
    const names = validAttrs.map(a => a.attributeName.toLowerCase());
    if (new Set(names).size !== names.length) {
      this.toast.show('Duplicate attribute names are not allowed (e.g. multiple "Size" rows).', 'warning');
      return;
    }

    this.isSaving.set(true);

    if (this.editingVariantId()) {
      const req: UpdateVariantRequest = {
        sku,
        price,
        stockQty: Number(this.formStockQty()),
        lowStockThreshold: Number(this.formLowStockThreshold()),
        isActive: this.formIsActive(),
        attributes: validAttrs
      };

      this.productService.updateProductVariant(pId, this.editingVariantId()!, req).subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.toast.show(res?.message || 'Variant updated successfully!', 'success');
          this.closeModal();
          this.loadVariants(pId);
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toast.show(err.error?.message || err.error?.error || 'Failed to update variant', 'error');
        }
      });
    } else {
      const req: CreateVariantRequest = {
        sku,
        price,
        stockQty: Number(this.formStockQty()),
        lowStockThreshold: Number(this.formLowStockThreshold()),
        attributes: validAttrs
      };

      this.productService.createProductVariant(pId, req).subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.toast.show(res?.message || 'Variant created successfully!', 'success');
          this.closeModal();
          this.loadVariants(pId);
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toast.show(err.error?.message || err.error?.error || 'Failed to create variant', 'error');
        }
      });
    }
  }

  // Delete Variant Flow with ConfirmModal
  promptDeleteVariant(vId: string, sku: string) {
    this.variantToDelete.set({ id: vId, sku });
  }

  cancelDeleteVariant() {
    this.variantToDelete.set(null);
  }

  confirmDeleteVariant() {
    const target = this.variantToDelete();
    const pId = this.selectedProductId();
    if (!target || !pId) return;

    this.isDeletingVariant.set(true);
    this.productService.deleteProductVariant(pId, target.id).subscribe({
      next: () => {
        this.isDeletingVariant.set(false);
        this.variantToDelete.set(null);
        this.toast.show(`Variant "${target.sku}" deleted successfully`, 'success');
        this.loadVariants(pId);
      },
      error: (err) => {
        this.isDeletingVariant.set(false);
        this.toast.show(err.error?.message || 'Failed to delete variant', 'error');
      }
    });
  }

  onImageSelected(event: Event, vId: string) {
    const pId = this.selectedProductId();
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file || !pId) return;

    this.uploadingVariantId.set(vId);
    this.productService.uploadVariantImage(pId, vId, file).subscribe({
      next: (res) => {
        this.uploadingVariantId.set(null);
        this.toast.show('Variant image uploaded successfully!', 'success');
        this.loadVariants(pId);
        input.value = '';
      },
      error: (err) => {
        this.uploadingVariantId.set(null);
        this.toast.show(err.error?.message || 'Failed to upload image', 'error');
        input.value = '';
      }
    });
  }

  // Remove Image Flow with ConfirmModal
  promptRemoveImage(vId: string) {
    this.imageVariantIdToRemove.set(vId);
  }

  cancelRemoveImage() {
    this.imageVariantIdToRemove.set(null);
  }

  confirmRemoveImage() {
    const vId = this.imageVariantIdToRemove();
    const pId = this.selectedProductId();
    if (!vId || !pId) return;

    this.isRemovingImage.set(true);
    this.productService.deleteVariantImage(pId, vId).subscribe({
      next: () => {
        this.isRemovingImage.set(false);
        this.imageVariantIdToRemove.set(null);
        this.toast.show('Variant image removed', 'success');
        this.loadVariants(pId);
      },
      error: (err) => {
        this.isRemovingImage.set(false);
        this.toast.show(err.error?.message || 'Failed to remove image', 'error');
      }
    });
  }

  triggerVariantUpload(vId: string) {
    document.getElementById(`variant-file-${vId}`)?.click();
  }
}
