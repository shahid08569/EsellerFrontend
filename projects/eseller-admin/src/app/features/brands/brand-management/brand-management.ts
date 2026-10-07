import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, map, Observable } from 'rxjs';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminBrandDto } from '../../../core/models/admin.models';
import { TablePagination } from '../../../shared/components/table-pagination/table-pagination';

@Component({
  selector: 'app-brand-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TablePagination, SkeletonLayout],
  templateUrl: './brand-management.html'
})
export class BrandManagement implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly brands = signal<AdminBrandDto[]>([]);
  readonly searchTerm = signal<string>('');
  readonly actionInProgress = signal<string | null>(null);

  // Pagination
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 25, 50];

  // Modal State
  readonly modalOpen = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  readonly editingId = signal<string | null>(null);
  readonly formName = signal<string>('');
  readonly formSlug = signal<string>('');
  readonly formDescription = signal<string>('');
  readonly formLogoUrl = signal<string>('');
  readonly formIsActive = signal<boolean>(true);
  readonly isUploadingLogo = signal<boolean>(false);
  readonly localLogoPreview = signal<string | null>(null);
  private pendingLogoFile: File | null = null;

  // Delete Confirmation Modal State
  readonly deleteModalOpen = signal<boolean>(false);
  readonly brandToDelete = signal<AdminBrandDto | null>(null);
  readonly isDeleting = signal<boolean>(false);

  ngOnInit(): void {
    this.loadBrands();
  }

  formatImageUrl(url?: string | null): string {
    return this.adminService.formatImageUrl(url);
  }

  onImgError(event: Event): void {
    (event.target as HTMLElement).style.display = 'none';
  }

  loadBrands(): void {
    this.isLoading.set(true);
    this.adminService.getBrands().subscribe({
      next: (data) => {
        this.brands.set(data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.show(err?.error?.error || 'Failed to load brands', 'error');
      }
    });
  }

  readonly filteredBrands = computed(() => {
    const list = this.brands();
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return list;
    return list.filter(b => 
      b.name.toLowerCase().includes(term) ||
      (b.slug && b.slug.toLowerCase().includes(term))
    );
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredBrands().length / this.pageSize())));

  readonly pagedBrands = computed(() => {
    const list = this.filteredBrands();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  onSearchChange(val: string): void {
    this.searchTerm.set(val);
    this.currentPage.set(1);
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.editingId.set(null);
    this.formName.set('');
    this.formSlug.set('');
    this.formDescription.set('');
    this.formLogoUrl.set('');
    this.localLogoPreview.set(null);
    this.formIsActive.set(true);
    this.modalOpen.set(true);
  }

  openEditModal(brand: AdminBrandDto): void {
    this.isEditing.set(true);
    this.editingId.set(brand.id);
    this.formName.set(brand.name);
    this.formSlug.set(brand.slug || '');
    this.formDescription.set(brand.description || '');
    this.formLogoUrl.set(brand.logoUrl || '');
    this.localLogoPreview.set(null);
    this.formIsActive.set(brand.isActive !== false);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.localLogoPreview.set(null);
    this.modalOpen.set(false);
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const objectUrl = URL.createObjectURL(file);
      this.localLogoPreview.set(objectUrl);
      this.isUploadingLogo.set(true);

      const brandId = this.editingId();
      const upload$: Observable<string> = brandId
        ? this.adminService.uploadBrandLogo(brandId, file).pipe(
            map((res) => res?.logoUrl || (res as any)?.imageUrl || ''),
            catchError(() =>
              this.adminService.uploadAdminMedia(file, 'brands').pipe(
                map((res) => res?.logoUrl || res?.imageUrl || '')
              )
            )
          )
        : this.adminService.uploadAdminMedia(file, 'brands').pipe(
            map((res) => res?.logoUrl || res?.imageUrl || ''),
            catchError(() =>
              this.adminService.uploadBannerImage(file).pipe(
                map((res) => res?.imageUrl || (res as any)?.logoUrl || '')
              )
            )
          );

      upload$.subscribe({
        next: (url) => {
          this.isUploadingLogo.set(false);
          if (url) {
            this.formLogoUrl.set(url);
            this.toast.show('Brand logo uploaded successfully!', 'success');
          } else {
            this.toast.show('Upload succeeded but logo URL was empty', 'error');
          }
        },
        error: (err) => {
          this.isUploadingLogo.set(false);
          this.toast.show(err?.error?.error || 'Failed to upload brand logo', 'error');
        }
      });
    }
  }

  removeLogo(): void {
    this.localLogoPreview.set(null);
    this.formLogoUrl.set('');
  }

  generateSlug(): void {
    const slug = this.formName()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    this.formSlug.set(slug);
  }

  saveBrand(): void {
    const name = this.formName().trim();
    if (!name) {
      this.toast.show('Brand name is required', 'error');
      return;
    }

    const payload = {
      name,
      slug: this.formSlug().trim() || undefined,
      description: this.formDescription().trim() || null,
      logoUrl: this.formLogoUrl().trim() || null,
      isActive: this.formIsActive()
    };

    if (this.isEditing() && this.editingId()) {
      this.adminService.updateBrand(this.editingId()!, payload).subscribe({
        next: () => {
          this.toast.show('Brand updated successfully', 'success');
          this.closeModal();
          this.loadBrands();
        },
        error: (err) => {
          this.toast.show(err?.error?.error || 'Failed to update brand', 'error');
        }
      });
    } else {
      this.adminService.createBrand(payload).subscribe({
        next: () => {
          this.toast.show('Brand created successfully', 'success');
          this.closeModal();
          this.loadBrands();
        },
        error: (err) => {
          this.toast.show(err?.error?.error || 'Failed to create brand', 'error');
        }
      });
    }
  }

  promptDeleteBrand(brand: AdminBrandDto): void {
    this.brandToDelete.set(brand);
    this.deleteModalOpen.set(true);
  }

  cancelDeleteBrand(): void {
    this.deleteModalOpen.set(false);
    this.brandToDelete.set(null);
  }

  confirmDeleteBrand(): void {
    const brand = this.brandToDelete();
    if (!brand) return;

    this.isDeleting.set(true);
    this.actionInProgress.set(brand.id);
    this.adminService.deleteBrand(brand.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.actionInProgress.set(null);
        this.deleteModalOpen.set(false);
        this.brandToDelete.set(null);
        this.toast.show(`Brand "${brand.name}" removed successfully`, 'info');
        this.loadBrands();
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to delete brand', 'error');
      }
    });
  }
}
