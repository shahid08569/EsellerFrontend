import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService, BrandDto } from '../../../core/services/seller.service';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { ImageUrlPipe } from '../../../shared/pipes/image-url.pipe';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';

@Component({
  selector: 'app-brand-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageUrlPipe, ImgFallbackDirective, SkeletonLayout],
  templateUrl: './brand-list.html'
})
export class BrandList implements OnInit {
  private readonly sellerSvc = inject(SellerService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly brands = signal<BrandDto[]>([]);
  readonly searchTerm = signal<string>('');
  readonly requestModalOpen = signal<boolean>(false);
  readonly newBrandName = signal<string>('');
  readonly newBrandNote = signal<string>('');

  ngOnInit(): void {
    this.loadBrands();
  }

  loadBrands(): void {
    this.isLoading.set(true);
    this.sellerSvc.getBrands().subscribe({
      next: (res) => {
        this.brands.set(res || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.show('Failed to load brands', 'error');
      }
    });
  }

  readonly filteredBrands = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.brands();
    if (!term) return list;
    return list.filter(b => b.name.toLowerCase().includes(term));
  });

  openRequestModal(): void {
    this.newBrandName.set('');
    this.newBrandNote.set('');
    this.requestModalOpen.set(true);
  }

  closeRequestModal(): void {
    this.requestModalOpen.set(false);
  }

  submitBrandRequest(): void {
    const name = this.newBrandName().trim();
    if (!name) {
      this.toast.show('Please provide a brand name', 'error');
      return;
    }
    this.toast.show(`Request for brand "${name}" submitted to Management!`, 'success');
    this.closeRequestModal();
  }
}
