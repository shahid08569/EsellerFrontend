import { Component, input, output, signal, computed, inject, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProductDto, ProductListDto, SkeletonLayout } from 'eseller-shared';
import {
  SellerProductService,
  ProductImageDto,
  ProductVariantDto
} from '../../../core/services/product.service';
import { ImageUrlPipe } from '../../pipes/image-url.pipe';

@Component({
  selector: 'app-warehouse-product-detail-modal',
  standalone: true,
  imports: [CommonModule, ImageUrlPipe, SkeletonLayout],
  templateUrl: './warehouse-product-detail-modal.html'
})
export class WarehouseProductDetailModal implements OnInit, OnChanges {
  private readonly productService = inject(SellerProductService);

  readonly productId = input<string | null>(null);
  readonly preview = input<ProductListDto | null>(null);
  readonly showRequestAction = input<boolean>(true);
  readonly canRequest = input<boolean>(true);
  readonly requestBusy = input<boolean>(false);
  readonly requestLabel = input<string>('Add to List');

  readonly close = output<void>();
  readonly requestList = output<ProductListDto>();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly detail = signal<ProductDto | null>(null);
  readonly images = signal<ProductImageDto[]>([]);
  readonly variants = signal<ProductVariantDto[]>([]);
  readonly activeImageUrl = signal<string | null>(null);

  readonly displayName = computed(
    () => this.detail()?.name || this.preview()?.name || 'Product'
  );

  readonly displayPrice = computed(
    () => Number(this.detail()?.basePrice ?? this.preview()?.basePrice ?? 0)
  );

  readonly commission = computed(() => Math.round(this.displayPrice() * 0.2 * 100) / 100);

  readonly galleryUrls = computed(() => {
    const fromApi = this.images()
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => i.imageUrl)
      .filter(Boolean);
    if (fromApi.length) return fromApi;
    const fallback = this.preview()?.primaryImageUrl;
    return fallback ? [fallback] : [];
  });

  ngOnInit(): void {
    const id = this.productId();
    if (id) this.load(id);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId'] && !changes['productId'].firstChange) {
      const id = this.productId();
      if (id) this.load(id);
      else this.reset();
    }
  }

  private reset(): void {
    this.loading.set(false);
    this.error.set(null);
    this.detail.set(null);
    this.images.set([]);
    this.variants.set([]);
    this.activeImageUrl.set(null);
  }

  private load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.activeImageUrl.set(this.preview()?.primaryImageUrl || null);

    forkJoin({
      detail: this.productService.getProductById(id).pipe(catchError(() => of(null))),
      images: this.productService.getProductImages(id).pipe(catchError(() => of([] as ProductImageDto[]))),
      variants: this.productService.getProductVariants(id).pipe(catchError(() => of([] as ProductVariantDto[])))
    }).subscribe({
      next: ({ detail, images, variants }) => {
        this.loading.set(false);
        if (!detail && !this.preview()) {
          this.error.set('Could not load product details.');
          return;
        }
        this.detail.set(detail);
        this.images.set(images || []);
        this.variants.set(variants || []);
        const cover =
          (images || [])[0]?.imageUrl ||
          this.preview()?.primaryImageUrl ||
          null;
        this.activeImageUrl.set(cover);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Failed to load product details.');
      }
    });
  }

  selectImage(url: string): void {
    this.activeImageUrl.set(url);
  }

  attributeLabel(v: ProductVariantDto): string {
    if (!v.attributes?.length) return v.sku || 'Default';
    return v.attributes.map((a) => `${a.attributeName}: ${a.attributeValue}`).join(' · ');
  }

  onRequest(): void {
    const p = this.preview() || (this.detail()
      ? ({
          id: this.detail()!.id,
          name: this.detail()!.name,
          slug: this.detail()!.slug,
          basePrice: this.detail()!.basePrice,
          primaryImageUrl: this.activeImageUrl() || this.preview()?.primaryImageUrl || null,
          shopName: this.detail()!.shopName,
          shopSlug: this.detail()!.shopSlug,
          categoryName: this.detail()!.categoryName,
          brandName: this.detail()!.brandName,
          avgRating: this.detail()!.avgRating,
          isFeatured: this.detail()!.isFeatured,
          isApproved: this.detail()!.isApproved,
          status: this.detail()!.status,
          rejectionReason: this.detail()!.rejectionReason,
          createdAt: this.detail()!.createdAt,
          badges: null
        } as ProductListDto)
      : null);

    if (p) this.requestList.emit(p);
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }
}
