import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { map, Observable } from 'rxjs';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminCategoryDto } from '../../../core/models/admin.models';
import { TablePagination } from '../../../shared/components/table-pagination/table-pagination';

type CategoryTab = 'all' | 'homepage';

@Component({
  selector: 'app-category-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TablePagination, SkeletonLayout],
  templateUrl: './category-management.html'
})
export class CategoryManagement implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly categories = signal<AdminCategoryDto[]>([]);
  readonly activeTab = signal<CategoryTab>('all');
  readonly searchTerm = signal<string>('');
  readonly actionInProgress = signal<string | null>(null);

  readonly homepageCategoriesCount = computed(() => 
    this.categories().filter(c => c.isFeaturedOnHomepage).length
  );

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
  readonly formParentId = signal<string | null>(null);
  readonly formImageUrl = signal<string>('');
  readonly formDisplayOrder = signal<number>(0);
  readonly formHomepageDisplayOrder = signal<number>(0);
  readonly formIsFeatured = signal<boolean>(false);
  readonly formIsActive = signal<boolean>(true);
  readonly isUploadingImage = signal<boolean>(false);
  readonly localImagePreview = signal<string | null>(null);

  // Delete Modal State
  readonly deleteModalOpen = signal<boolean>(false);
  readonly catToDelete = signal<AdminCategoryDto | null>(null);
  readonly isDeleting = signal<boolean>(false);

  ngOnInit(): void {
    this.loadCategories();
  }

  formatImageUrl(url?: string | null): string {
    return this.adminService.formatImageUrl(url);
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent && !parent.querySelector('.img-fallback')) {
      const span = document.createElement('span');
      span.className = 'img-fallback text-orange-600 text-xs font-black';
      span.textContent = ((img.alt || 'C').trim()[0] || 'C').toUpperCase();
      parent.appendChild(span);
    }
  }

  loadCategories(): void {
    this.isLoading.set(true);
    this.adminService.getCategories().subscribe({
      next: (data) => {
        this.categories.set(data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.show(err?.error?.error || 'Failed to load categories', 'error');
      }
    });
  }

  readonly filteredCategories = computed(() => {
    let list = this.categories();
    const tab = this.activeTab();
    const term = this.searchTerm().trim().toLowerCase();

    if (tab === 'homepage') {
      list = list
        .filter(c => c.isFeaturedOnHomepage)
        .sort((a, b) => (a.homepageDisplayOrder ?? a.displayOrder ?? 0) - (b.homepageDisplayOrder ?? b.displayOrder ?? 0));
    }

    if (term) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(term) ||
        (c.slug && c.slug.toLowerCase().includes(term))
      );
    }
    return list;
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredCategories().length / this.pageSize())));

  readonly pagedCategories = computed(() => {
    const list = this.filteredCategories();
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

  onTabChange(tab: CategoryTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.editingId.set(null);
    this.formName.set('');
    this.formSlug.set('');
    this.formParentId.set(null);
    this.formImageUrl.set('');
    this.localImagePreview.set(null);
    this.formDisplayOrder.set(0);
    this.formHomepageDisplayOrder.set(0);
    this.formIsFeatured.set(false);
    this.formIsActive.set(true);
    this.modalOpen.set(true);
  }

  openEditModal(cat: AdminCategoryDto): void {
    this.isEditing.set(true);
    this.editingId.set(cat.id);
    this.formName.set(cat.name);
    this.formSlug.set(cat.slug || '');
    this.formParentId.set(cat.parentId || null);
    this.formImageUrl.set(cat.imageUrl || '');
    this.localImagePreview.set(null);
    this.formDisplayOrder.set(cat.displayOrder || 0);
    this.formHomepageDisplayOrder.set(cat.homepageDisplayOrder ?? cat.displayOrder ?? 0);
    this.formIsFeatured.set(!!cat.isFeaturedOnHomepage);
    this.formIsActive.set(cat.isActive !== false);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.localImagePreview.set(null);
    this.modalOpen.set(false);
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const objectUrl = URL.createObjectURL(file);
      this.localImagePreview.set(objectUrl);
      this.isUploadingImage.set(true);

      const categoryId = this.editingId();
      const upload$: Observable<string> = categoryId
        ? this.adminService.uploadCategoryImage(categoryId, file).pipe(
            map((res) => res?.imageUrl || (res as any)?.logoUrl || '')
          )
        : this.adminService.uploadBannerImage(file).pipe(
            map((res) => res?.imageUrl || (res as any)?.logoUrl || '')
          );

      upload$.subscribe({
        next: (url) => {
          this.isUploadingImage.set(false);
          if (url) {
            this.formImageUrl.set(url);
            this.toast.show('Category image uploaded successfully!', 'success');
          } else {
            this.toast.show('Upload succeeded but image URL was empty', 'error');
          }
        },
        error: (err) => {
          this.isUploadingImage.set(false);
          this.toast.show(err?.error?.error || 'Failed to upload category image', 'error');
        }
      });
    }
  }

  removeImage(): void {
    this.localImagePreview.set(null);
    this.formImageUrl.set('');
  }

  generateSlug(): void {
    const slug = this.formName()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    this.formSlug.set(slug);
  }

  saveCategory(): void {
    const name = this.formName().trim();
    if (!name) {
      this.toast.show('Category name is required', 'error');
      return;
    }

    // Keep isActive + homepage featured flags — omitting isActive was deserializing as false
    // and hiding the category (and other featured cats looked "gone") from the storefront.
    const payload = {
      name,
      slug: this.formSlug().trim() || undefined,
      parentCategoryId: this.formParentId() || null,
      imageUrl: this.formImageUrl().trim() || null,
      displayOrder: this.formDisplayOrder(),
      homepageDisplayOrder: this.formHomepageDisplayOrder(),
      isFeaturedOnHomepage: this.formIsFeatured(),
      isActive: this.formIsActive()
    };

    if (this.isEditing() && this.editingId()) {
      this.adminService.updateCategory(this.editingId()!, payload).subscribe({
        next: () => {
          this.toast.show('Category updated successfully', 'success');
          this.closeModal();
          this.loadCategories();
        },
        error: (err) => {
          this.toast.show(err?.error?.error || 'Failed to update category', 'error');
        }
      });
    } else {
      this.adminService.createCategory(payload).subscribe({
        next: () => {
          this.toast.show('Category created successfully', 'success');
          this.closeModal();
          this.loadCategories();
        },
        error: (err) => {
          this.toast.show(err?.error?.error || 'Failed to create category', 'error');
        }
      });
    }
  }

  toggleHomepage(cat: AdminCategoryDto): void {
    const nextVal = !cat.isFeaturedOnHomepage;
    const currentOrder = cat.homepageDisplayOrder ?? cat.displayOrder ?? 0;
    const order = (nextVal && currentOrder === 0) ? (this.homepageCategoriesCount() + 1) : currentOrder;
    this.actionInProgress.set(cat.id);
    this.adminService.toggleCategoryHomepageFeatured(cat.id, nextVal, order).subscribe({
      next: () => {
        this.actionInProgress.set(null);
        this.toast.show(`Category "${cat.name}" homepage status updated`, 'success');
        this.loadCategories();
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to update homepage status', 'error');
      }
    });
  }

  updateHomepageOrder(cat: AdminCategoryDto, newOrderValue: string | number): void {
    const order = typeof newOrderValue === 'string' ? parseInt(newOrderValue, 10) : newOrderValue;
    if (isNaN(order) || order < 0) return;
    if (order === (cat.homepageDisplayOrder ?? cat.displayOrder ?? 0)) return;

    this.actionInProgress.set(cat.id);
    this.adminService.toggleCategoryHomepageFeatured(cat.id, !!cat.isFeaturedOnHomepage, order).subscribe({
      next: () => {
        this.actionInProgress.set(null);
        this.toast.show(`Display order set to #${order} for "${cat.name}"`, 'success');
        this.loadCategories();
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to update order', 'error');
      }
    });
  }

  promptDeleteCategory(cat: AdminCategoryDto): void {
    this.catToDelete.set(cat);
    this.deleteModalOpen.set(true);
  }

  cancelDeleteCategory(): void {
    this.deleteModalOpen.set(false);
    this.catToDelete.set(null);
  }

  confirmDeleteCategory(): void {
    const cat = this.catToDelete();
    if (!cat) return;

    this.isDeleting.set(true);
    this.actionInProgress.set(cat.id);
    this.adminService.deleteCategory(cat.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.actionInProgress.set(null);
        this.deleteModalOpen.set(false);
        this.catToDelete.set(null);
        this.toast.show(`Category "${cat.name}" deleted successfully`, 'info');
        this.loadCategories();
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to delete category', 'error');
      }
    });
  }
}
