import { Component, Output, EventEmitter, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormVariant } from '../step-variants/step-variants.component';
import { QueuedImage } from '../step-media/step-media.component';
import { ProductImageDto } from '../../../../../core/services/product.service';
import { ImageUrlPipe } from '../../../../../shared/pipes/image-url.pipe';
import { ImgFallbackDirective } from '../../../../../shared/directives/img-fallback.directive';

@Component({
  selector: 'app-step-review',
  standalone: true,
  imports: [CommonModule, ImageUrlPipe, ImgFallbackDirective],
  templateUrl: './step-review.component.html'
})
export class StepReviewComponent {
  name = input<string>('');
  description = input<string>('');
  basePrice = input<number | null>(null);
  categoryName = input<string>('');
  brandName = input<string>('');
  seoTitle = input<string>('');
  seoDescription = input<string>('');
  queuedImages = input<QueuedImage[]>([]);
  existingImages = input<ProductImageDto[]>([]);
  hasVariants = input<boolean>(false);
  variants = input<FormVariant[]>([]);

  @Output() jumpToStep = new EventEmitter<number>();

  readonly coverImageUrl = computed(() => {
    const existing = this.existingImages();
    if (existing.length > 0) {
      const primary = existing.find(i => i.sortOrder === 0) || existing[0];
      return primary.imageUrl;
    }
    const queued = this.queuedImages();
    if (queued.length > 0) {
      return queued[0].previewUrl;
    }
    return null;
  });

  readonly isCoverBlob = computed(() => {
    const existing = this.existingImages();
    if (existing.length > 0) return false;
    return this.queuedImages().length > 0;
  });

  readonly totalImagesCount = computed(() => {
    return this.existingImages().length + this.queuedImages().length;
  });

  readonly totalStock = computed(() => {
    if (!this.hasVariants()) return 'Single Item';
    const sum = this.variants().reduce((acc, v) => acc + (Number(v.stockQty) || 0), 0);
    return `${sum} Units Across ${this.variants().length} Variants`;
  });
}
