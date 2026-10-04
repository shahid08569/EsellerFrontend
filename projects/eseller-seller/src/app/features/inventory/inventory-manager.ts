import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SellerService, ShopDto } from '../../core/services/seller.service';
import { ToastService } from 'eseller-shared';
import { TablePagination } from '../../shared/components/table-pagination/table-pagination';

interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  stock: number;
  price: number;
  lowStockThreshold: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

@Component({
  selector: 'app-inventory-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TablePagination],
  templateUrl: './inventory-manager.html'
})
export class InventoryManager implements OnInit {
  private readonly sellerSvc = inject(SellerService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly shop = signal<ShopDto | null>(null);
  readonly items = signal<InventoryItem[]>([]);
  readonly activeTab = signal<'all' | 'low' | 'out'>('all');
  readonly searchTerm = signal<string>('');

  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 25, 50];

  // Stock Adjustment Modal
  readonly adjustModalOpen = signal<boolean>(false);
  readonly selectedItem = signal<InventoryItem | null>(null);
  readonly newStockValue = signal<number>(0);
  readonly adjustReason = signal<string>('Stock reconciliation');

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.sellerSvc.getMyShop().subscribe({
      next: (s) => {
        this.shop.set(s);
        if (s?.id) {
          this.fetchInventory(s.id);
        } else {
          this.isLoading.set(false);
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.show('Failed to load merchant profile', 'error');
      }
    });
  }

  private fetchInventory(shopId: string): void {
    // Fetch products to build inventory items list
    this.sellerSvc.getMyProducts(1, 100, undefined, shopId).subscribe({
      next: (res: any) => {
        const products = res?.items || [];
        const invList: InventoryItem[] = [];

        products.forEach((p: any) => {
          const stock = p.stock ?? 15;
          let status: 'In Stock' | 'Low Stock' | 'Out of Stock' = 'In Stock';
          if (stock === 0) status = 'Out of Stock';
          else if (stock <= 5) status = 'Low Stock';

          invList.push({
            id: p.id,
            productId: p.id,
            productName: p.name,
            sku: p.slug ? p.slug.toUpperCase().slice(0, 8) : 'SKU-GEN',
            stock,
            price: p.basePrice || 0,
            lowStockThreshold: 5,
            status
          });
        });

        // Also fetch official low stock variants if any
        this.sellerSvc.getLowStockVariants(shopId).subscribe({
          next: (lowList) => {
            (lowList || []).forEach(l => {
              const match = invList.find(i => i.productId === l.productId);
              if (match) {
                match.stock = l.currentStock;
                match.status = l.currentStock === 0 ? 'Out of Stock' : 'Low Stock';
              }
            });
            this.items.set(invList);
            this.isLoading.set(false);
          },
          error: () => {
            this.items.set(invList);
            this.isLoading.set(false);
          }
        });
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.show('Failed to load inventory', 'error');
      }
    });
  }

  readonly filteredItems = computed(() => {
    let list = this.items();
    const tab = this.activeTab();
    const term = this.searchTerm().trim().toLowerCase();

    if (tab === 'low') {
      list = list.filter(i => i.status === 'Low Stock');
    } else if (tab === 'out') {
      list = list.filter(i => i.status === 'Out of Stock');
    }

    if (term) {
      list = list.filter(i =>
        i.productName.toLowerCase().includes(term) ||
        i.sku.toLowerCase().includes(term)
      );
    }

    return list;
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredItems().length / this.pageSize())));

  readonly pagedItems = computed(() => {
    const list = this.filteredItems();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  readonly countAll = computed(() => this.items().length);
  readonly countLow = computed(() => this.items().filter(i => i.status === 'Low Stock').length);
  readonly countOut = computed(() => this.items().filter(i => i.status === 'Out of Stock').length);

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  onFilterChange(): void {
    this.currentPage.set(1);
  }

  setTab(tab: 'all' | 'low' | 'out'): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
  }

  openAdjustModal(item: InventoryItem): void {
    this.selectedItem.set(item);
    this.newStockValue.set(item.stock);
    this.adjustReason.set('Stock reconciliation');
    this.adjustModalOpen.set(true);
  }

  closeAdjustModal(): void {
    this.adjustModalOpen.set(false);
    this.selectedItem.set(null);
  }

  confirmAdjustment(): void {
    const item = this.selectedItem();
    if (!item) return;

    const newQty = Number(this.newStockValue());
    if (isNaN(newQty) || newQty < 0) {
      this.toast.show('Please enter a valid stock quantity', 'error');
      return;
    }

    // Update in memory & notify
    item.stock = newQty;
    if (newQty === 0) item.status = 'Out of Stock';
    else if (newQty <= item.lowStockThreshold) item.status = 'Low Stock';
    else item.status = 'In Stock';

    this.items.update(list => [...list]);
    this.toast.show(`Stock for "${item.productName}" updated to ${newQty}.`, 'success');
    this.closeAdjustModal();
  }
}
