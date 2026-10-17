import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminShopDto, AdminProductDto, AdminCategoryDto } from '../../../core/models/admin.models';

export interface ProductGroupListItemDto {
  id: string;
  shopId: string;
  shopName: string;
  batchName: string;
  requestedCount: number;
  deliveredCount: number;
  categoryFilter?: string | null;
  brandFilter?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  createdAt: string;
  activeProductsCount: number;
}

export interface GroupProductCardDto {
  id: string;
  sourceProductId?: string | null;
  name: string;
  slug: string;
  basePrice: number;
  categoryName?: string | null;
  brandName?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  isApproved: boolean;
  createdAt: string;
  variantsCount: number;
}

export interface ProductGroupDetailDto {
  id: string;
  shopId: string;
  shopName: string;
  batchName: string;
  requestedCount: number;
  deliveredCount: number;
  categoryFilter?: string | null;
  brandFilter?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  createdAt: string;
  products: GroupProductCardDto[];
}

@Component({
  selector: 'app-product-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SkeletonLayout],
  templateUrl: './product-groups.html'
})
export class ProductGroups implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal<boolean>(true);
  readonly groups = signal<ProductGroupListItemDto[]>([]);
  readonly shops = signal<AdminShopDto[]>([]);
  readonly categories = signal<AdminCategoryDto[]>([]);

  // Selected Group for Detail / Cards View
  readonly selectedGroup = signal<ProductGroupDetailDto | null>(null);
  readonly isLoadingGroupDetail = signal<boolean>(false);

  // Filters for Groups List
  readonly searchTerm = signal<string>('');
  readonly selectedShopId = signal<string>('all');

  // Search within selected group cards
  readonly cardSearchTerm = signal<string>('');

  // Modals state
  readonly removeProductModalOpen = signal<boolean>(false);
  readonly productToRemove = signal<GroupProductCardDto | null>(null);
  readonly isRemovingProduct = signal<boolean>(false);

  readonly replaceModalOpen = signal<boolean>(false);
  readonly productToReplace = signal<GroupProductCardDto | null>(null);
  readonly warehouseProducts = signal<AdminProductDto[]>([]);
  readonly warehouseSearch = signal<string>('');
  readonly warehouseCategoryId = signal<string>('all');
  readonly isLoadingWarehouse = signal<boolean>(false);
  readonly isReplacing = signal<boolean>(false);

  readonly addMoreModalOpen = signal<boolean>(false);
  readonly addMoreCount = signal<number>(10);
  readonly isAddingMore = signal<boolean>(false);

  readonly deleteGroupModalOpen = signal<boolean>(false);
  readonly groupToDelete = signal<ProductGroupListItemDto | null>(null);
  readonly isDeletingGroup = signal<boolean>(false);

  // Filtered Groups list
  readonly filteredGroups = computed(() => {
    let list = [...this.groups()];
    const term = this.searchTerm().trim().toLowerCase();
    const shop = this.selectedShopId();

    if (shop && shop !== 'all') {
      list = list.filter(g => g.shopId.toLowerCase() === shop.toLowerCase());
    }

    if (term) {
      list = list.filter(g =>
        g.batchName.toLowerCase().includes(term) ||
        g.shopName.toLowerCase().includes(term) ||
        (g.categoryFilter && g.categoryFilter.toLowerCase().includes(term))
      );
    }

    return list;
  });

  // Filtered cards within selected group
  readonly filteredGroupProducts = computed(() => {
    const group = this.selectedGroup();
    if (!group) return [];
    let list = [...group.products];
    const term = this.cardSearchTerm().trim().toLowerCase();
    if (term) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(term)) ||
        (p.brandName && p.brandName.toLowerCase().includes(term)) ||
        p.slug.toLowerCase().includes(term)
      );
    }
    return list;
  });

  // Filtered warehouse products for replace
  readonly filteredWarehouseProducts = computed(() => {
    let list = [...this.warehouseProducts()];
    const term = this.warehouseSearch().trim().toLowerCase();
    const cat = this.warehouseCategoryId();

    if (cat && cat !== 'all') {
      list = list.filter(p => p.categoryId === cat);
    }

    if (term) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(term)) ||
        (p.brandName && p.brandName.toLowerCase().includes(term))
      );
    }

    return list;
  });

  ngOnInit(): void {
    this.loadShops();
    this.loadCategories();
    this.loadGroups();

    this.route.queryParams.subscribe(params => {
      const gid = params['groupId'];
      if (gid) {
        this.openGroupDetail(gid);
      }
    });
  }

  loadShops(): void {
    this.adminService.getShops(1, 200).subscribe({
      next: (res) => this.shops.set(res?.items || []),
      error: () => {}
    });
  }

  loadCategories(): void {
    this.adminService.getCategories().subscribe({
      next: (res) => this.categories.set(res || []),
      error: () => {}
    });
  }

  loadGroups(): void {
    this.isLoading.set(true);
    this.adminService.getProductGroups(1, 100).subscribe({
      next: (res) => {
        this.groups.set(res?.items || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.show(err?.error?.error || 'Failed to load product group listings.', 'error');
      }
    });
  }

  openGroupDetail(groupId: string): void {
    this.isLoadingGroupDetail.set(true);
    this.adminService.getProductGroupById(groupId).subscribe({
      next: (detail) => {
        this.selectedGroup.set(detail);
        this.isLoadingGroupDetail.set(false);
      },
      error: (err) => {
        this.isLoadingGroupDetail.set(false);
        this.toast.show(err?.error?.error || 'Failed to load group details.', 'error');
      }
    });
  }

  closeGroupDetail(): void {
    this.selectedGroup.set(null);
    this.cardSearchTerm.set('');
    this.loadGroups();
  }

  // ─── REMOVE PRODUCT FROM GROUP ─────────────────────────────
  openRemoveProductModal(prod: GroupProductCardDto): void {
    this.productToRemove.set(prod);
    this.removeProductModalOpen.set(true);
  }

  closeRemoveProductModal(): void {
    if (this.isRemovingProduct()) return;
    this.removeProductModalOpen.set(false);
    this.productToRemove.set(null);
  }

  confirmRemoveProduct(): void {
    const prod = this.productToRemove();
    const group = this.selectedGroup();
    if (!prod || !group) return;

    this.isRemovingProduct.set(true);
    this.adminService.removeProductFromGroup(group.id, prod.id).subscribe({
      next: () => {
        this.isRemovingProduct.set(false);
        this.removeProductModalOpen.set(false);
        this.productToRemove.set(null);
        this.toast.show(`"${prod.name}" removed from group and shop successfully.`, 'success');

        // Update local list
        this.selectedGroup.update(g => {
          if (!g) return null;
          return {
            ...g,
            products: g.products.filter(p => p.id !== prod.id)
          };
        });
      },
      error: (err) => {
        this.isRemovingProduct.set(false);
        const msg = err?.error?.error || err?.error?.message || 'Failed to remove product from group.';
        this.toast.show(msg, 'error');
      }
    });
  }

  // ─── REPLACE PRODUCT IN GROUP ──────────────────────────────
  openReplaceModal(prod: GroupProductCardDto): void {
    this.productToReplace.set(prod);
    this.replaceModalOpen.set(true);
    this.loadWarehouseCatalogForReplace();
  }

  closeReplaceModal(): void {
    if (this.isReplacing()) return;
    this.replaceModalOpen.set(false);
    this.productToReplace.set(null);
  }

  loadWarehouseCatalogForReplace(): void {
    this.isLoadingWarehouse.set(true);
    this.adminService.getProducts(undefined, undefined, 1, 200).subscribe({
      next: (res) => {
        this.warehouseProducts.set(res?.items || []);
        this.isLoadingWarehouse.set(false);
      },
      error: () => this.isLoadingWarehouse.set(false)
    });
  }

  selectWarehouseProductToReplace(newWarehouseProd: AdminProductDto): void {
    const group = this.selectedGroup();
    const oldProd = this.productToReplace();
    if (!group || !oldProd) return;

    this.isReplacing.set(true);
    this.adminService.replaceProductInGroup(group.id, oldProd.id, newWarehouseProd.id).subscribe({
      next: (res) => {
        this.isReplacing.set(false);
        this.replaceModalOpen.set(false);
        this.productToReplace.set(null);
        this.toast.show(`Replaced with "${newWarehouseProd.name}" successfully!`, 'success');

        // Reload group to reflect the new replaced product
        this.openGroupDetail(group.id);
      },
      error: (err) => {
        this.isReplacing.set(false);
        const msg = err?.error?.error || err?.error?.message || 'Failed to replace product.';
        this.toast.show(msg, 'error');
      }
    });
  }

  // ─── ADD MORE PRODUCTS TO GROUP ───────────────────────────
  openAddMoreModal(): void {
    this.addMoreCount.set(10);
    this.addMoreModalOpen.set(true);
  }

  closeAddMoreModal(): void {
    if (this.isAddingMore()) return;
    this.addMoreModalOpen.set(false);
  }

  confirmAddMore(): void {
    const group = this.selectedGroup();
    if (!group) return;

    const count = Math.max(1, Math.min(50, Number(this.addMoreCount()) || 10));
    this.isAddingMore.set(true);

    this.adminService.addProductsToGroup(group.id, count).subscribe({
      next: (res) => {
        this.isAddingMore.set(false);
        this.addMoreModalOpen.set(false);
        const added = res?.addedCount ?? count;
        this.toast.show(`Added ${added} new warehouse product(s) to "${group.batchName}"!`, 'success');
        this.openGroupDetail(group.id);
      },
      error: (err) => {
        this.isAddingMore.set(false);
        const msg = err?.error?.error || err?.error?.message || 'Failed to add products to group.';
        this.toast.show(msg, 'error');
      }
    });
  }

  // ─── DELETE ENTIRE GROUP ───────────────────────────────────
  openDeleteGroupModal(group: ProductGroupListItemDto): void {
    this.groupToDelete.set(group);
    this.deleteGroupModalOpen.set(true);
  }

  closeDeleteGroupModal(): void {
    if (this.isDeletingGroup()) return;
    this.deleteGroupModalOpen.set(false);
    this.groupToDelete.set(null);
  }

  confirmDeleteGroup(): void {
    const group = this.groupToDelete();
    if (!group) return;

    this.isDeletingGroup.set(true);
    this.adminService.deleteProductGroup(group.id).subscribe({
      next: () => {
        this.isDeletingGroup.set(false);
        this.deleteGroupModalOpen.set(false);
        this.groupToDelete.set(null);
        this.toast.show(`Product group "${group.batchName}" and its active shop listings deleted.`, 'success');
        if (this.selectedGroup()?.id === group.id) {
          this.closeGroupDetail();
        } else {
          this.loadGroups();
        }
      },
      error: (err) => {
        this.isDeletingGroup.set(false);
        const msg = err?.error?.error || err?.error?.message || 'Failed to delete group.';
        this.toast.show(msg, 'error');
      }
    });
  }

  formatImageUrl(url?: string | null): string {
    return this.adminService.formatImageUrl(url);
  }

  onImgError(event: Event): void {
    (event.target as HTMLElement).style.display = 'none';
  }
}
