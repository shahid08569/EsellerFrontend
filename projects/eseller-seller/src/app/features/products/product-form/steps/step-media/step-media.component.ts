import { Component, Output, EventEmitter, signal, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductImageDto } from '../../../../../core/services/product.service';
import { ImageUrlPipe } from '../../../../../shared/pipes/image-url.pipe';
import { ImgFallbackDirective } from '../../../../../shared/directives/img-fallback.directive';
import { ToastService } from 'eseller-shared';

export interface QueuedImage {
  file: File;
  previewUrl: string;
  name: string;
  size: number;
}

@Component({
  selector: 'app-step-media',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageUrlPipe, ImgFallbackDirective],
  templateUrl: './step-media.component.html'
})
export class StepMediaComponent {
  private readonly toast = inject(ToastService);

  isEditMode = input<boolean>(false);
  queuedImages = input<QueuedImage[]>([]);
  existingImages = input<ProductImageDto[]>([]);
  isLoadingImages = input<boolean>(false);
  isUploadingNewImage = input<boolean>(false);

  @Output() filesQueued = new EventEmitter<QueuedImage[]>();
  @Output() removeQueued = new EventEmitter<number>();
  @Output() clearAllQueued = new EventEmitter<void>();
  @Output() reorderCover = new EventEmitter<number>();
  @Output() directUploadFile = new EventEmitter<File>();
  @Output() deleteExistingImage = new EventEmitter<ProductImageDto>();
  @Output() setExistingCover = new EventEmitter<ProductImageDto>();

  readonly isDragging = signal<boolean>(false);
  readonly isBulkMode = signal<boolean>(true);

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.processSelectedFiles(event.dataTransfer.files);
    }
  }

  onFileInputChange(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    if (inputEl.files && inputEl.files.length > 0) {
      this.processSelectedFiles(inputEl.files);
      inputEl.value = ''; // Reset input to allow selecting same file again
    }
  }

  private processSelectedFiles(fileList: FileList) {
    const validExtensions = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const maxSizeBytes = 5 * 1024 * 1024; // 5 MB

    const accepted: QueuedImage[] = [];

    // If single mode, only take first
    const count = this.isBulkMode() ? fileList.length : 1;

    for (let i = 0; i < count; i++) {
      const file = fileList[i];

      if (!validExtensions.includes(file.type)) {
        this.toast.show(`"${file.name}" ignored. Only JPG, PNG, WEBP, and GIF images are allowed.`, 'warning');
        continue;
      }

      if (file.size > maxSizeBytes) {
        this.toast.show(`"${file.name}" is too large (max 5 MB).`, 'warning');
        continue;
      }

      // If in edit mode, upload directly to the existing product
      if (this.isEditMode()) {
        this.directUploadFile.emit(file);
      } else {
        const previewUrl = URL.createObjectURL(file);
        accepted.push({
          file,
          previewUrl,
          name: file.name,
          size: file.size
        });
      }
    }

    if (accepted.length > 0 && !this.isEditMode()) {
      this.filesQueued.emit(accepted);
      this.toast.show(`Added ${accepted.length} photo(s) to upload queue.`, 'info');
    }
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
