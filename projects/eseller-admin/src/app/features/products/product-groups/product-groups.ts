import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminShopDto, AdminProductDto, AdminCategoryDto } from '../../../core/models/admin.models';

export interface ProductGroupListItemDto {
  id: string;
  shopId: string;
  shopName: string;
  shopSlug?: string;
  batchName: string;
  requestedCount: number;
  deliveredCount: number;
  currentProductCount?: number;
  activeProductsCount: number;
  approvedProductsCount?: number;
  pendingProductsCount?: number;
  isApproved?: boolean;
  categoryFilter?: string | null;
  brandFilter?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  createdAt: string;
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
  primaryImageUrl?: string | null;
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
  approvedProductsCount?: number;
  pendingProductsCount?: number;
  isApproved?: boolean;
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
  private readonly destroyRef = inject(DestroyRef);

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

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const gid = params['groupId'];
      if (gid) {
        this.openGroupDetail(gid);
      }
    });
  }

  loadShops(): void {
    this.adminService.getShops(1, 200).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.shops.set(res?.items || []),
      error: () => {}
    });
  }

  loadCategories(): void {
    this.adminService.getCategories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.categories.set(res || []),
      error: () => {}
    });
  }

  // Approving state
  readonly isApprovingBatch = signal<string | null>(null);

  loadGroups(): void {
    this.isLoading.set(true);
    this.adminService.getProductGroups(1, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        const rawList = Array.isArray(res) ? res : (res?.items || res?.value || res?.data || []);
        const list: ProductGroupListItemDto[] = rawList.map((g: any) => {
          const total = g.currentProductCount ?? g.CurrentProductCount ?? g.activeProductsCount ?? g.deliveredCount ?? 0;
          const approved = g.approvedProductsCount ?? g.ApprovedProductsCount ?? 0;
          const pending = g.pendingProductsCount ?? g.PendingProductsCount ?? (g.isApproved ? 0 : total);
          const isApproved = g.isApproved ?? g.IsApproved ?? (pending === 0 && total > 0);

          return {
            id: g.id || g.Id,
            shopId: g.shopId || g.ShopId,
            shopName: g.shopName || g.ShopName || 'Store',
            shopSlug: g.shopSlug || g.ShopSlug || '',
            batchName: g.batchName || g.BatchName || 'Batch',
            requestedCount: g.requestedCount ?? g.RequestedCount ?? 0,
            deliveredCount: g.deliveredCount ?? g.DeliveredCount ?? 0,
            currentProductCount: total,
            activeProductsCount: total,
            approvedProductsCount: approved,
            pendingProductsCount: pending,
            isApproved: isApproved,
            categoryFilter: g.categoryFilter || g.CategoryFilter,
            brandFilter: g.brandFilter || g.BrandFilter,
            minPrice: g.minPrice ?? g.MinPrice,
            maxPrice: g.maxPrice ?? g.MaxPrice,
            createdAt: g.createdAt || g.CreatedAt
          };
        });
        this.groups.set(list);
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
    this.adminService.getProductGroupById(groupId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rawDetail: any) => {
        const detail = rawDetail?.value || rawDetail;
        if (detail) {
          const rawProducts = detail.products || detail.Products || [];
          const products: GroupProductCardDto[] = rawProducts.map((p: any) => {
            const img = p.primaryImageUrl || p.imageUrl || p.PrimaryImageUrl || p.ImageUrl || '';
            return {
              id: p.id || p.Id,
              sourceProductId: p.sourceProductId || p.SourceProductId,
              name: p.name || p.Name,
              slug: p.slug || p.Slug,
              basePrice: p.basePrice ?? p.BasePrice ?? 0,
              categoryName: p.categoryName || p.CategoryName,
              brandName: p.brandName || p.BrandName,
              imageUrl: img,
              primaryImageUrl: img,
              isActive: p.isActive ?? p.IsActive ?? true,
              isApproved: p.isApproved ?? p.IsApproved ?? false,
              createdAt: p.createdAt || p.CreatedAt,
              variantsCount: p.variantsCount ?? p.VariantsCount ?? 0
            };
          });

          const approved = products.filter(p => p.isApproved).length;
          const pending = products.filter(p => !p.isApproved).length;
          const isApproved = products.length > 0 && pending === 0;

          this.selectedGroup.set({
            id: detail.id || detail.Id,
            shopId: detail.shopId || detail.ShopId,
            shopName: detail.shopName || detail.ShopName || 'Store',
            batchName: detail.batchName || detail.BatchName || 'Batch',
            requestedCount: detail.requestedCount ?? detail.RequestedCount ?? 0,
            deliveredCount: detail.deliveredCount ?? detail.DeliveredCount ?? 0,
            approvedProductsCount: approved,
            pendingProductsCount: pending,
            isApproved: isApproved,
            categoryFilter: detail.categoryFilter || detail.CategoryFilter,
            brandFilter: detail.brandFilter || detail.BrandFilter,
            minPrice: detail.minPrice ?? detail.MinPrice,
            maxPrice: detail.maxPrice ?? detail.MaxPrice,
            createdAt: detail.createdAt || detail.CreatedAt,
            products
          });
        }
        this.isLoadingGroupDetail.set(false);
      },
      error: (err) => {
        this.isLoadingGroupDetail.set(false);
        this.toast.show(err?.error?.error || 'Failed to load group details.', 'error');
      }
    });
  }

  // ─── APPROVE BATCH DIRECTLY ─────────────────────────────────
  approveBatch(group: ProductGroupListItemDto, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.isApprovingBatch()) return;

    this.isApprovingBatch.set(group.id);
    this.adminService.approveProductGroup(group.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.isApprovingBatch.set(null);
        this.toast.show(res?.message || `Batch "${group.batchName}" approved successfully! All items are now live.`, 'success');

        this.groups.update(list => list.map(g => {
          if (g.id === group.id) {
            return {
              ...g,
              isApproved: true,
              approvedProductsCount: g.deliveredCount,
              pendingProductsCount: 0
            };
          }
          return g;
        }));
      },
      error: (err) => {
        this.isApprovingBatch.set(null);
        this.toast.show(err?.error?.error || err?.error?.message || 'Failed to approve batch.', 'error');
      }
    });
  }

  approveCurrentBatch(): void {
    const grp = this.selectedGroup();
    if (!grp || this.isApprovingBatch()) return;

    this.isApprovingBatch.set(grp.id);
    this.adminService.approveProductGroup(grp.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.isApprovingBatch.set(null);
        this.toast.show(res?.message || `All products in "${grp.batchName}" approved!`, 'success');

        this.selectedGroup.update(g => {
          if (!g) return null;
          return {
            ...g,
            isApproved: true,
            approvedProductsCount: g.products.length,
            pendingProductsCount: 0,
            products: g.products.map(p => ({ ...p, isApproved: true }))
          };
        });

        this.groups.update(list => list.map(g => {
          if (g.id === grp.id) {
            return {
              ...g,
              isApproved: true,
              approvedProductsCount: g.deliveredCount,
              pendingProductsCount: 0
            };
          }
          return g;
        }));
      },
      error: (err) => {
        this.isApprovingBatch.set(null);
        this.toast.show(err?.error?.error || 'Failed to approve batch.', 'error');
      }
    });
  }

  approveSingleProduct(prod: GroupProductCardDto): void {
    const grp = this.selectedGroup();
    if (!grp) return;

    this.adminService.approveGroupProduct(grp.id, prod.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.show(`"${prod.name}" approved successfully!`, 'success');

        this.selectedGroup.update(g => {
          if (!g) return null;
          const updated = g.products.map(p => p.id === prod.id ? { ...p, isApproved: true } : p);
          const approved = updated.filter(p => p.isApproved).length;
          const pending = updated.filter(p => !p.isApproved).length;
          return {
            ...g,
            isApproved: pending === 0 && updated.length > 0,
            approvedProductsCount: approved,
            pendingProductsCount: pending,
            products: updated
          };
        });
      },
      error: (err) => {
        this.toast.show(err?.error?.error || 'Failed to approve product.', 'error');
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
    this.adminService.removeProductFromGroup(group.id, prod.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.adminService.getProducts(undefined, undefined, 1, 200).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.adminService.replaceProductInGroup(group.id, oldProd.id, newWarehouseProd.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

    this.adminService.addProductsToGroup(group.id, count).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.adminService.deleteProductGroup(group.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
