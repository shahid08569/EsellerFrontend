import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService } from '../../core/services/seller.service';
import { ToastService } from 'eseller-shared';

interface ShopForm {
  name: string;
  description: string;
  city: string;
  country: string;
}

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html'
})
export class Settings implements OnInit {
  private readonly sellerSvc = inject(SellerService);
  private readonly toast = inject(ToastService);

  readonly loading = signal<boolean>(true);
  readonly saving = signal<boolean>(false);
  readonly uploadingLogo = signal<boolean>(false);
  readonly uploadingBanner = signal<boolean>(false);
  readonly shop = signal<any>(null);

  form: ShopForm = { name: '', description: '', city: '', country: '' };

  ngOnInit(): void {
    this.sellerSvc.getMyShop().subscribe({
      next: (shop) => {
        this.shop.set(shop);
        if (shop) {
          this.form = {
            name: shop.name ?? '',
            description: shop.description ?? '',
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

  saveShop(): void {
    const shopId = this.shop()?.id;
    if (!shopId) return;
    this.saving.set(true);
    this.sellerSvc.updateShop(shopId, this.form).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.show('Shop updated successfully!', 'success');
        // Update local signal
        this.shop.update(s => ({ ...s, ...this.form }));
      },
      error: (err: any) => {
        this.saving.set(false);
        this.toast.show(err?.error ?? 'Failed to update shop.', 'error');
      }
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file || !this.shop()?.id) return;
    this.uploadingLogo.set(true);
    this.sellerSvc.uploadLogo(this.shop().id, file).subscribe({
      next: (res: any) => {
        this.uploadingLogo.set(false);
        this.toast.show('Logo uploaded successfully!', 'success');
        const logoUrl = res?.logoUrl ?? res?.url ?? URL.createObjectURL(file);
        this.shop.update(s => ({ ...s, logoUrl }));
        input.value = '';
      },
      error: (err: any) => {
        this.uploadingLogo.set(false);
        this.toast.show(err?.error ?? 'Failed to upload logo.', 'error');
        input.value = '';
      }
    });
  }

  onBannerSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file || !this.shop()?.id) return;
    this.uploadingBanner.set(true);
    this.sellerSvc.uploadBanner(this.shop().id, file).subscribe({
      next: (res: any) => {
        this.uploadingBanner.set(false);
        this.toast.show('Banner uploaded successfully!', 'success');
        const bannerUrl = res?.bannerUrl ?? res?.url ?? URL.createObjectURL(file);
        this.shop.update(s => ({ ...s, bannerUrl }));
        input.value = '';
      },
      error: (err: any) => {
        this.uploadingBanner.set(false);
        this.toast.show(err?.error ?? 'Failed to upload banner.', 'error');
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
