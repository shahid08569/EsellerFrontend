import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService, ShopDto, UpdateShopDto } from '../../core/services/seller.service';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { ImageUrlPipe } from '../../shared/pipes/image-url.pipe';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModal, ImageUrlPipe, ImgFallbackDirective, SkeletonLayout],
  templateUrl: './settings.html'
})
export class Settings implements OnInit {
  private readonly sellerSvc = inject(SellerService);
  private readonly toast = inject(ToastService);

  readonly loading = signal<boolean>(true);
  readonly saving = signal<boolean>(false);
  readonly uploadingLogo = signal<boolean>(false);
  readonly uploadingBanner = signal<boolean>(false);
  readonly shop = signal<ShopDto | null>(null);

  // Confirmation before saving
  readonly showConfirmUpdateModal = signal<boolean>(false);

  // Success Confirmation after saving
  readonly showSuccessModal = signal<boolean>(false);

  form: UpdateShopDto = {
    name: '',
    description: '',
    phone: '',
    address: '',
    city: '',
    country: ''
  };

  ngOnInit(): void {
    this.loadShop();
  }

  loadShop(): void {
    this.loading.set(true);
    this.sellerSvc.getMyShop(true).subscribe({
      next: (shop) => {
        this.shop.set(shop);
        if (shop) {
          this.form = {
            name: shop.name ?? '',
            description: shop.description ?? '',
            phone: shop.phone ?? '',
            address: shop.address ?? '',
            city: shop.city ?? '',
            country: shop.country ?? ''
          };
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.show('Failed to load shop data.', 'error');
      }
    });
  }

  promptSaveShop(): void {
    if (!this.form.name.trim()) {
      this.toast.show('Shop name is required.', 'error');
      return;
    }
    this.showConfirmUpdateModal.set(true);
  }

  cancelSaveShop(): void {
    this.showConfirmUpdateModal.set(false);
  }

  confirmSaveShop(): void {
    this.showConfirmUpdateModal.set(false);
    this.saveShop();
  }

  saveShop(): void {
    const shopId = this.shop()?.id;
    if (!shopId) return;

    this.saving.set(true);
    this.sellerSvc.updateShop(shopId, this.form).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.shop.update(s => s ? ({ ...s, ...this.form }) : null);
        this.showSuccessModal.set(true);
        this.toast.show(res?.message || 'Shop updated successfully!', 'success');
      },
      error: (err: any) => {
        this.saving.set(false);
        const msg = err?.error?.error || err?.error || err?.message || 'Failed to update shop.';
        this.toast.show(msg, 'error');
      }
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file || !this.shop()?.id) return;

    this.uploadingLogo.set(true);
    this.sellerSvc.uploadLogo(this.shop()!.id, file).subscribe({
      next: (res: any) => {
        this.uploadingLogo.set(false);
        this.toast.show('Logo uploaded successfully!', 'success');
        const logoUrl = res?.logoUrl ?? res?.url;
        if (logoUrl) {
          this.shop.update(s => s ? ({ ...s, logoUrl }) : null);
        } else {
          this.loadShop();
        }
        input.value = '';
      },
      error: (err: any) => {
        this.uploadingLogo.set(false);
        const msg = err?.error?.error || err?.error || 'Failed to upload logo.';
        this.toast.show(msg, 'error');
        input.value = '';
      }
    });
  }

  onBannerSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file || !this.shop()?.id) return;

    this.uploadingBanner.set(true);
    this.sellerSvc.uploadBanner(this.shop()!.id, file).subscribe({
      next: (res: any) => {
        this.uploadingBanner.set(false);
        this.toast.show('Banner uploaded successfully!', 'success');
        const bannerUrl = res?.bannerUrl ?? res?.url;
        if (bannerUrl) {
          this.shop.update(s => s ? ({ ...s, bannerUrl }) : null);
        } else {
          this.loadShop();
        }
        input.value = '';
      },
      error: (err: any) => {
        this.uploadingBanner.set(false);
        const msg = err?.error?.error || err?.error || 'Failed to upload banner.';
        this.toast.show(msg, 'error');
        input.value = '';
      }
    });
  }

  triggerLogoUpload(): void {
    document.getElementById('logoInput')?.click();
  }

  triggerBannerUpload(): void {
    document.getElementById('bannerInput')?.click();
  }
}
