import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { SellerProductService, CreateProductDto } from '../../../core/services/product.service';
import { ToastService, HomeService, CategoryTreeDto } from 'eseller-shared';

@Component({
  selector: 'app-product-form',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './product-form.html'
})
export class ProductForm implements OnInit {
  private readonly productService = inject(SellerProductService);
  private readonly homeService = inject(HomeService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isSubmitting = signal<boolean>(false);
  readonly categories = signal<CategoryTreeDto[]>([]);

  // Form State
  name = signal<string>('');
  basePrice = signal<number | null>(null);
  categoryId = signal<string>('');
  description = signal<string>('');
  seoTitle = signal<string>('');
  seoDescription = signal<string>('');

  // Validation errors
  nameError = signal<string | null>(null);
  priceError = signal<string | null>(null);
  categoryError = signal<string | null>(null);

  ngOnInit() {
    this.homeService.getCategories().subscribe(cats => {
      this.categories.set(cats);
    });
  }

  onSubmit() {
    let isValid = true;
    this.nameError.set(null);
    this.priceError.set(null);
    this.categoryError.set(null);

    if (!this.name().trim()) {
      this.nameError.set('Product name is required');
      isValid = false;
    }
    if (!this.basePrice() || this.basePrice()! <= 0) {
      this.priceError.set('Valid base price is required');
      isValid = false;
    }
    if (!this.categoryId()) {
      this.categoryError.set('Please select a category');
      isValid = false;
    }

    if (!isValid) return;

    this.isSubmitting.set(true);

    const dto: CreateProductDto = {
      name: this.name(),
      basePrice: this.basePrice()!,
      categoryId: this.categoryId(),
      description: this.description(),
      seoTitle: this.seoTitle(),
      seoDescription: this.seoDescription()
    };

    this.productService.createProduct(dto).subscribe({
      next: (res) => {
        this.toast.show('Product created successfully! You can now add images.', 'success');
        this.isSubmitting.set(false);
        this.router.navigate(['..'], { relativeTo: this.route });
      },
      error: (err) => {
        this.toast.show(err.error?.message || 'Failed to create product', 'error');
        this.isSubmitting.set(false);
      }
    });
  }
}
