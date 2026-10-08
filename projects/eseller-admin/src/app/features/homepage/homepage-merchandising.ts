import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../core/services/admin.service';
import { TablePagination } from '../../shared/components/table-pagination/table-pagination';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';

type HomeTab = 'catalog' | 'featured' | 'hot' | 'flash';

interface HomeProduct {
  id: string;
  name: string;
  slug?: string;
  basePrice: number;
  isFeatured: boolean;
  isHotSelling: boolean;
  viewCount?: number;
  coverImageUrl?: string | null;
}

@Component({
  selector: 'app-homepage-merchandising',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TablePagination, SkeletonLayout, ConfirmModal],
  templateUrl: './homepage-merchandising.html'
})
export class HomepageMerchandising implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly activeTab = signal<HomeTab>('catalog');
  readonly isLoading = signal(true);
  readonly products = signal<HomeProduct[]>([]);
  readonly flashSales = signal<any[]>([]);
  readonly searchTerm = signal('');
  readonly busyId = signal<string | null>(null);
  readonly deleteConfirmOpen = signal(false);
  readonly flashToDelete = signal<any | null>(null);

  // Multi-select & bulk actions (catalog tab)
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly isBulkBusy = signal(false);

  // Client-side pagination
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 25, 50];

  // Flash sale create (inline — no redirect to promotions)
  readonly flashFormOpen = signal(false);
  readonly fTitle = signal('');
  readonly fDiscount = signal(20);
  readonly fStart = signal('');
  readonly fEnd = signal('');
  readonly selectedFlashIds = signal<string[]>([]);
  readonly isSavingFlash = signal(false);
  private loadSeq = 0;

  readonly filteredProducts = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.products();
    if (!term) return list;
    return list.filter(p =>
      p.name.toLowerCase().includes(term) || (p.slug || '').toLowerCase().includes(term)
    );
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredProducts().length / this.pageSize())));

  readonly pagedProducts = computed(() => {
    const list = this.filteredProducts();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  readonly isAllPageSelected = computed(() => {
    const list = this.pagedProducts();
    if (list.length === 0) return false;
    const selected = this.selectedIds();
    return list.every(p => selected.has(p.id));
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

  toggleSelectAllOnPage(): void {
    const set = new Set(this.selectedIds());
    const list = this.pagedProducts();
    if (this.isAllPageSelected()) {
      list.forEach(p => set.delete(p.id));
    } else {
      list.forEach(p => set.add(p.id));
    }
    this.selectedIds.set(set);
  }

  toggleSelectProduct(id: string): void {
    const set = new Set(this.selectedIds());
    if (set.has(id)) set.delete(id); else set.add(id);
    this.selectedIds.set(set);
  }

  isProductSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  private runBulkAction(
    action: 'featured-add' | 'featured-remove' | 'hot-add' | 'hot-remove'
  ): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0 || this.isBulkBusy()) return;

    this.isBulkBusy.set(true);
    const call = action === 'featured-add' || action === 'featured-remove'
      ? this.adminService.setFeaturedBulk(ids, action === 'featured-add')
      : this.adminService.setHotSellingBulk(ids, action === 'hot-add');

    const labels: Record<typeof action, string> = {
      'featured-add': `Added ${ids.length} product(s) to Featured.`,
      'featured-remove': `Removed ${ids.length} product(s) from Featured.`,
      'hot-add': `Added ${ids.length} product(s) to Hot Selling.`,
      'hot-remove': `Removed ${ids.length} product(s) from Hot Selling.`
    };

    call.subscribe({
      next: () => {
        this.isBulkBusy.set(false);
        this.toast.show(labels[action], 'success');
        this.clearSelection();
        this.loadTab(this.activeTab());
      },
      error: (err) => {
        this.isBulkBusy.set(false);
        this.toast.show(err?.error?.error || 'Bulk update failed.', 'error');
      }
    });
  }

  bulkAddFeatured(): void {
    this.runBulkAction('featured-add');
  }

  bulkRemoveFeatured(): void {
    this.runBulkAction('featured-remove');
  }

  bulkAddHotSelling(): void {
    this.runBulkAction('hot-add');
  }

  bulkRemoveHotSelling(): void {
    this.runBulkAction('hot-remove');
  }

  ngOnInit(): void {
    const tab = String(this.route.snapshot.queryParamMap.get('tab') || 'catalog').toLowerCase();
    const initial: HomeTab =
      tab === 'featured' || tab === 'hot' || tab === 'flash' || tab === 'catalog' ? (tab as HomeTab) : 'catalog';
    this.activeTab.set(initial);
    this.loadTab(initial);
  }

  setTab(tab: HomeTab): void {
    this.activeTab.set(tab);
    this.flashFormOpen.set(false);
    this.clearSelection();
    this.currentPage.set(1);
    this.loadTab(tab);
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1);
  }

  loadTab(tab: HomeTab): void {
    const seq = ++this.loadSeq;
    this.isLoading.set(true);

    if (tab === 'flash') {
      this.adminService.getFlashSales().subscribe({
        next: (list) => {
          if (seq !== this.loadSeq || this.activeTab() !== 'flash') return;
          this.flashSales.set(list || []);
          this.isLoading.set(false);
        },
        error: () => {
          if (seq !== this.loadSeq || this.activeTab() !== 'flash') return;
          this.flashSales.set([]);
          this.isLoading.set(false);
        }
      });
      // Catalog for flash product picker — do not overwrite other tabs
      this.adminService.getHomepageProducts('all', 1, 100).subscribe({
        next: (res) => {
          if (seq !== this.loadSeq || this.activeTab() !== 'flash') return;
          this.products.set(this.mapProducts(res?.items || []));
        },
        error: () => {}
      });
      return;
    }

    const apiTab = tab === 'catalog' ? 'all' : tab === 'hot' ? 'hot' : 'featured';
    this.adminService.getHomepageProducts(apiTab, 1, 100).subscribe({
      next: (res) => {
        if (seq !== this.loadSeq || this.activeTab() !== tab) return;
        this.products.set(this.mapProducts(res?.items || []));
        this.isLoading.set(false);
      },
      error: () => {
        if (seq !== this.loadSeq || this.activeTab() !== tab) return;
        this.products.set([]);
        this.isLoading.set(false);
        this.toast.show('Failed to load products.', 'error');
      }
    });
  }

  private mapProducts(items: any[]): HomeProduct[] {
    return (items || []).map((p: any) => ({
      id: String(p.id),
      name: p.name || 'Product',
      slug: p.slug,
      basePrice: Number(p.basePrice || 0),
      isFeatured: !!p.isFeatured,
      isHotSelling: !!p.isHotSelling,
      viewCount: p.viewCount || 0,
      coverImageUrl: p.coverImageUrl || null
    }));
  }

  coverSrc(url?: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const apiBase = ((window as any).__ESELLER_API_URL__ as string) || '';
    const host = apiBase.replace(/\/api\/v1\/?$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return path.startsWith('/uploads') ? `${host}${path}` : `${host}/uploads${path}`;
  }

  toggleFeatured(p: HomeProduct): void {
    if (this.busyId() === p.id || this.isBulkBusy()) return;
    const prev = p.isFeatured;
    const next = !prev;
    this.busyId.set(p.id);
    // Optimistic UI so Add/Remove can be toggled again immediately
    this.patchProduct(p.id, { isFeatured: next });
    this.adminService.setProductFeatured(p.id, next).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.show(next ? 'Added to Featured' : 'Removed from Featured', 'success');
        if (this.activeTab() === 'featured' && !next) {
          this.products.update(list => list.filter(x => x.id !== p.id));
        }
      },
      error: (err) => {
        this.patchProduct(p.id, { isFeatured: prev });
        this.busyId.set(null);
        this.toast.show(err?.error?.error || 'Failed to update Featured.', 'error');
      }
    });
  }

  toggleHotSelling(p: HomeProduct): void {
    if (this.busyId() === p.id || this.isBulkBusy()) return;
    const prev = p.isHotSelling;
    const next = !prev;
    this.busyId.set(p.id);
    this.patchProduct(p.id, { isHotSelling: next });
    this.adminService.setProductHotSelling(p.id, next).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.show(next ? 'Added to Hot Selling' : 'Removed from Hot Selling', 'success');
        if (this.activeTab() === 'hot' && !next) {
          this.products.update(list => list.filter(x => x.id !== p.id));
        }
      },
      error: (err) => {
        this.patchProduct(p.id, { isHotSelling: prev });
        this.busyId.set(null);
        this.toast.show(err?.error?.error || 'Failed to update Hot Selling.', 'error');
      }
    });
  }

  private patchProduct(id: string, patch: Partial<HomeProduct>): void {
    this.products.update(list =>
      list.map(x => (x.id === id ? { ...x, ...patch } : x))
    );
  }

  openFlashForm(): void {
    this.fTitle.set('');
    this.fDiscount.set(20);
    this.fStart.set('');
    this.fEnd.set('');
    this.selectedFlashIds.set([]);
    this.flashFormOpen.set(true);
    if (!this.products().length) {
      this.adminService.getHomepageProducts('all', 1, 100).subscribe({
        next: (res) => this.products.set(this.mapProducts(res?.items || [])),
        error: () => {}
      });
    }
  }

  toggleFlashProduct(id: string): void {
    const cur = this.selectedFlashIds();
    this.selectedFlashIds.set(
      cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    );
  }

  saveFlashSale(): void {
    const name = this.fTitle().trim();
    if (!name) {
      this.toast.show('Campaign name is required.', 'error');
      return;
    }
    const ids = this.selectedFlashIds();
    if (!ids.length) {
      this.toast.show('Select at least one product for the flash sale.', 'error');
      return;
    }

    this.isSavingFlash.set(true);
    const discount = Number(this.fDiscount()) || 10;
    this.adminService.createFlashSale({
      name,
      startDate: this.fStart() ? new Date(this.fStart()).toISOString() : new Date().toISOString(),
      endDate: this.fEnd()
        ? new Date(this.fEnd()).toISOString()
        : new Date(Date.now() + 86400000 * 3).toISOString(),
      products: ids.map(productId => ({
        productId,
        discountType: 1,
        discountValue: discount
      }))
    }).subscribe({
      next: () => {
        this.isSavingFlash.set(false);
        this.flashFormOpen.set(false);
        this.toast.show('Flash sale created.', 'success');
        this.loadTab('flash');
      },
      error: (err) => {
        this.isSavingFlash.set(false);
        this.toast.show(err?.error?.error || 'Failed to create flash sale.', 'error');
      }
    });
  }

  deleteFlashSale(id: string): void {
    this.flashToDelete.set({ id });
    this.deleteConfirmOpen.set(true);
  }

  cancelDeleteFlash(): void {
    if (this.busyId()) return;
    this.deleteConfirmOpen.set(false);
    this.flashToDelete.set(null);
  }

  confirmDeleteFlash(): void {
    const row = this.flashToDelete();
    if (!row?.id) return;
    this.busyId.set(row.id);
    this.adminService.deleteFlashSale(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.deleteConfirmOpen.set(false);
        this.flashToDelete.set(null);
        this.toast.show('Flash sale deleted.', 'info');
        this.loadTab('flash');
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.show(err?.error?.error || 'Delete failed.', 'error');
      }
    });
  }
}
