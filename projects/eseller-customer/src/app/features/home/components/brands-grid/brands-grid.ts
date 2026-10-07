import {
  Component,
  input,
  computed,
  ElementRef,
  viewChild,
  afterNextRender,
  OnDestroy,
  PLATFORM_ID,
  inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BrandDto, resolveMediaUrl } from 'eseller-shared';
import { brandLogoFallback as resolveBrandFallback } from '../catalog-media';

@Component({
  selector: 'app-brands-grid',
  imports: [RouterLink],
  templateUrl: './brands-grid.html',
  styleUrl: './brands-grid.css'
})
export class BrandsGrid implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly brands = input<BrandDto[]>([]);
  readonly title = input<string>('Top Brands');
  readonly viewAllLink = input<string>('/brands');
  readonly limit = input<number>(12);

  readonly visibleBrands = computed(() =>
    this.brands().slice(0, this.limit())
  );

  // Ensure base set has at least 10 items so set width is large and smooth
  readonly baseBrands = computed(() => {
    const list = this.visibleBrands();
    if (list.length === 0) return [];
    let repeated = [...list];
    while (repeated.length < 10) {
      repeated = [...repeated, ...list];
    }
    return repeated;
  });

  // 6 identical sets to provide seamless infinite buffer across all viewports (mobile to 4K)
  readonly sliderBrands = computed(() => {
    const base = this.baseBrands();
    if (base.length === 0) return [];
    return [...base, ...base, ...base, ...base, ...base, ...base];
  });

  private readonly scrollContainer =
    viewChild<ElementRef<HTMLDivElement>>('scrollContainer');
  private readonly trackContainer =
    viewChild<ElementRef<HTMLDivElement>>('trackContainer');

  private animationFrameId: number | null = null;
  private isHovered = false;
  private isDragging = false;
  private hasDragged = false;
  private dragStartX = 0;
  private dragStartScroll = 0;
  private currentScrollPos = 0;
  private isInitialized = false;
  private destroyed = false;
  private readonly speed = 0.8; // pixels per frame at 60fps (~48px/sec)

  constructor() {
    if (this.isBrowser) {
      afterNextRender(() => {
        this.startAnimation();
      });
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.isBrowser) {
      window.removeEventListener('mousemove', this.onWindowMouseMove);
      window.removeEventListener('mouseup', this.onWindowMouseUp);
    }
  }

  private startAnimation(): void {
    if (!this.isBrowser) return;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  private animate = (): void => {
    if (this.destroyed) return;

    const container = this.scrollContainer()?.nativeElement;
    if (container) {
      const w = this.getSetWidth();
      if (w > 0) {
        if (!this.isInitialized) {
          this.isInitialized = true;
          this.currentScrollPos = 2 * w;
          container.scrollLeft = this.currentScrollPos;
        } else if (!this.isHovered && !this.isDragging) {
          this.currentScrollPos += this.speed;
          if (this.currentScrollPos >= 3 * w) {
            this.currentScrollPos -= w;
          }
          container.scrollLeft = this.currentScrollPos;
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  private getSetWidth(): number {
    const track = this.trackContainer()?.nativeElement;
    if (!track) return 0;
    const items = track.children;
    const m = this.baseBrands().length;
    if (m === 0 || items.length < 2 * m) return 0;
    const first = items[0] as HTMLElement;
    const nextSetFirst = items[m] as HTMLElement;
    if (!first || !nextSetFirst) return 0;
    return nextSetFirst.offsetLeft - first.offsetLeft;
  }

  onMouseEnter(): void {
    if (!this.isDragging) {
      this.isHovered = true;
    }
  }

  onMouseLeave(): void {
    if (!this.isDragging) {
      this.isHovered = false;
    }
  }

  onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return; // Only main left click
    this.handlePointerDown(e.clientX);
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
  }

  private onWindowMouseMove = (e: MouseEvent): void => {
    this.handlePointerMove(e.clientX);
  };

  private onWindowMouseUp = (): void => {
    this.handlePointerUp();
    window.removeEventListener('mousemove', this.onWindowMouseMove);
    window.removeEventListener('mouseup', this.onWindowMouseUp);
  };

  onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.handlePointerDown(e.touches[0].clientX);
    }
  }

  onTouchMove(e: TouchEvent): void {
    if (this.isDragging && e.touches.length === 1) {
      this.handlePointerMove(e.touches[0].clientX);
    }
  }

  onTouchEnd(): void {
    this.handlePointerUp();
  }

  private handlePointerDown(clientX: number): void {
    this.isDragging = true;
    this.hasDragged = false;
    this.dragStartX = clientX;
    const container = this.scrollContainer()?.nativeElement;
    this.dragStartScroll = container ? container.scrollLeft : 0;
    this.currentScrollPos = this.dragStartScroll;
  }

  private handlePointerMove(clientX: number): void {
    if (!this.isDragging) return;

    const deltaX = clientX - this.dragStartX;
    if (Math.abs(deltaX) > 6) {
      this.hasDragged = true;
    }

    const container = this.scrollContainer()?.nativeElement;
    if (!container) return;

    const w = this.getSetWidth();
    let newScroll = this.dragStartScroll - deltaX;

    if (w > 0) {
      while (newScroll >= 3 * w) {
        newScroll -= w;
        this.dragStartScroll -= w;
      }
      while (newScroll < 2 * w) {
        newScroll += w;
        this.dragStartScroll += w;
      }
    }

    this.currentScrollPos = newScroll;
    container.scrollLeft = newScroll;
  }

  private handlePointerUp(): void {
    if (this.isDragging) {
      this.isDragging = false;
      const container = this.scrollContainer()?.nativeElement;
      if (container) {
        this.currentScrollPos = container.scrollLeft;
      }
      if (this.hasDragged) {
        setTimeout(() => {
          this.hasDragged = false;
        }, 120);
      }
    }
  }

  onBrandClick(event: MouseEvent): void {
    if (this.hasDragged) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  getLogoUrl(brand: BrandDto): string | null {
    const resolved = resolveMediaUrl(brand.logoUrl);
    // Prefer CDN fallback over broken / missing local uploads for known brands
    if (!resolved || resolved.includes('/uploads/')) {
      return resolveBrandFallback(brand.slug, brand.name) || resolved;
    }
    return resolved;
  }

  brandLogoFallback(slug?: string | null, name?: string | null): string | null {
    return resolveBrandFallback(slug, name);
  }
}