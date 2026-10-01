import { Component, input, signal, computed, effect } from '@angular/core';
import { ProductImageDto, ProductBadgeDto } from 'eseller-shared';

@Component({
  selector: 'app-product-gallery',
  imports: [],
  templateUrl: './product-gallery.html',
  styleUrl: './product-gallery.css'
})
export class ProductGallery {
  // Inputs
  readonly images = input<ProductImageDto[]>([]);
  readonly primaryImageUrl = input<string | null>(null);
  readonly productName = input<string>('');
  readonly badges = input<ProductBadgeDto | null>(null);
  readonly variantImageUrl = input<string | null>(null);

  // Gallery State
  readonly selectedIndex = signal<number>(0);
  readonly isZoomModalOpen = signal<boolean>(false);

  // Amazon Hover Zoom State
  readonly isHovering = signal<boolean>(false);
  readonly lensX = signal<number>(0);
  readonly lensY = signal<number>(0);
  readonly zoomX = signal<number>(50); // 0% to 100%
  readonly zoomY = signal<number>(50); // 0% to 100%

  // Unified image list
  readonly allImages = computed(() => {
    const list: string[] = [];
    const variantImg = this.variantImageUrl();
    if (variantImg) {
      list.push(variantImg);
    }

    const fetched = this.images();
    if (fetched && fetched.length > 0) {
      for (const img of fetched) {
        if (!list.includes(img.imageUrl)) {
          list.push(img.imageUrl);
        }
      }
    } else if (this.primaryImageUrl()) {
      const p = this.primaryImageUrl()!;
      if (!list.includes(p)) {
        list.push(p);
      }
    }

    return list;
  });

  // Current active image url
  readonly activeImageUrl = computed(() => {
    const list = this.allImages();
    if (list.length === 0) return null;
    const idx = this.selectedIndex();
    return list[idx] || list[0];
  });

  constructor() {
    effect(() => {
      const v = this.variantImageUrl();
      if (v) {
        this.selectedIndex.set(0);
      }
    });
  }

  selectImage(index: number): void {
    this.selectedIndex.set(index);
  }

  // ============================================================
  // AMAZON HOVER ZOOM
  // ============================================================
  onMouseEnter(): void {
    this.isHovering.set(true);
  }

  onMouseLeave(): void {
    this.isHovering.set(false);
  }

  onMouseMove(e: MouseEvent): void {
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const lensW = 110;
    const lensH = 110;

    let x = mouseX - lensW / 2;
    let y = mouseY - lensH / 2;

    x = Math.max(0, Math.min(x, rect.width - lensW));
    y = Math.max(0, Math.min(y, rect.height - lensH));

    this.lensX.set(x);
    this.lensY.set(y);

    const maxTravelX = rect.width - lensW;
    const maxTravelY = rect.height - lensH;

    const xPercent = maxTravelX > 0 ? (x / maxTravelX) * 100 : 50;
    const yPercent = maxTravelY > 0 ? (y / maxTravelY) * 100 : 50;

    this.zoomX.set(xPercent);
    this.zoomY.set(yPercent);
  }

  // ============================================================
  // FULLSCREEN LIGHTBOX
  // ============================================================
  openModal(): void {
    if (this.activeImageUrl()) {
      this.isZoomModalOpen.set(true);
    }
  }

  closeModal(): void {
    this.isZoomModalOpen.set(false);
  }

  getImageUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const apiBase = (window as any).__ESELLER_API_URL__ as string;
    const host = apiBase ? apiBase.replace(/\/api\/v1\/?$/, '') : '';
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${host}/uploads${path}`;
  }
}
