import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SellerProductService } from '../../../core/services/product.service';
import { ProductListDto, PagedList } from 'eseller-shared';

@Component({
  selector: 'app-product-list',
  imports: [CommonModule, RouterLink],
  templateUrl: './product-list.html'
})
export class ProductList implements OnInit {
  private readonly productService = inject(SellerProductService);

  readonly products = signal<ProductListDto[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly totalCount = signal<number>(0);

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.isLoading.set(true);
    this.productService.getSellerProducts().subscribe({
      next: (res: PagedList<ProductListDto>) => {
        this.products.set(res.items);
        this.totalCount.set(res.totalCount);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  deleteProduct(id: string) {
    if (confirm('Are you sure you want to delete this product?')) {
      this.productService.deleteProduct(id).subscribe({
        next: () => {
          this.loadProducts();
        }
      });
    }
  }
}
