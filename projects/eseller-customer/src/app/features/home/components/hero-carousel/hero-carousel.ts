import {
  Component,
  input,
  signal,
  computed,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HomepageBannerDto } from 'eseller-shared';

type ZoomPhase = 'idle' | 'zooming';

@Component({
  selector: 'app-hero-carousel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './hero-carousel.html',
  styleUrl: './hero-carousel.css'
})
export class HeroCarousel implements OnInit, OnDestroy {
  readonly banners = input<HomepageBannerDto[]>([]);

  readonly currentIndex = signal<number>(0);
  readonly selectedSizes = signal<Record<number, string>>({});
  readonly isHovered = signal<boolean>(false);
  
  // 3D Depth Zoom Transition state ("पीछे से आता है اور آگے جاتا ہے")
  readonly zoomPhase = signal<ZoomPhase>('idle');
  readonly departingBanner = signal<HomepageBannerDto | null>(null);
  readonly isIncomingActive = signal<boolean>(false);

  private autoPlayTimer: any = null;
  private zoomTimeout: any = null;

  readonly totalSlides = computed(() => this.banners().length);
  readonly hasSlides = computed(() => this.banners().length > 0);

  readonly currentBanner = computed(() => {
    const list = this.banners();
    if (!list || list.length === 0) return null;
    const idx = Math.min(Math.max(0, this.currentIndex()), list.length - 1);
    return list[idx];
  });

  readonly nextBanner = computed(() => {
    const list = this.banners();
    if (!list || list.length <= 1) return null;
    const nextIdx = (this.currentIndex() + 1) % list.length;
    return list[nextIdx];
  });

  readonly currentSizesList = computed(() => {
    const b = this.currentBanner();
    const raw = b?.availableSizes || '36, 38, 40';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  });

  readonly currentSelectedSize = computed(() => {
    const idx = this.currentIndex();
    const saved = this.selectedSizes()[idx];
    if (saved) return saved;
    const list = this.currentSizesList();
    return list[0] || '36';
  });

  getBackgroundStyle(banner?: HomepageBannerDto | null): string {
    if (!banner || !banner.backgroundColor) {
      return 'linear-gradient(135deg, #ea580c 0%, #c2410c 50%, #431407 100%)';
    }

    const raw = banner.backgroundColor.trim();

    // Already a standard CSS gradient, color, or hex
    if (raw.startsWith('linear-gradient') || raw.startsWith('radial-gradient') || raw.startsWith('#') || raw.startsWith('rgb')) {
      return raw;
    }

    // Extract hex codes from Tailwind arbitrary strings like "from-[#334155] via-[#1e293b] to-[#0f172a]"
    const hexMatches = raw.match(/#(?:[0-9a-fA-F]{3,8})/g);
    if (hexMatches && hexMatches.length >= 2) {
      if (hexMatches.length === 2) {
        return `linear-gradient(135deg, ${hexMatches[0]} 0%, ${hexMatches[1]} 100%)`;
      }
      return `linear-gradient(135deg, ${hexMatches[0]} 0%, ${hexMatches[1]} 50%, ${hexMatches[2]} 100%)`;
    }

    // Keyword detection fallbacks
    if (raw.includes('white') || raw.includes('f8fafc') || raw.includes('f1f5f9')) {
      return 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 50%, #e2e8f0 100%)';
    }
    if (raw.includes('cream') || raw.includes('cashmere') || raw.includes('fef3c7')) {
      return 'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #f59e0b 100%)';
    }
    if (raw.includes('334155') || raw.includes('1e293b') || raw.includes('0f172a') || raw.includes('obsidian') || raw.includes('midnight') || raw.includes('black')) {
      return 'linear-gradient(135deg, #334155 0%, #1e293b 50%, #0f172a 100%)';
    }
    if (raw.includes('ea580c') || raw.includes('c2410c') || raw.includes('431407') || raw.includes('orange') || raw.includes('amber')) {
      return 'linear-gradient(135deg, #ea580c 0%, #c2410c 50%, #431407 100%)';
    }
    if (raw.includes('581c87') || raw.includes('violet') || raw.includes('purple')) {
      return 'linear-gradient(135deg, #581c87 0%, #3b0764 50%, #1e1b4b 100%)';
    }
    if (raw.includes('065f46') || raw.includes('emerald') || raw.includes('forest')) {
      return 'linear-gradient(135deg, #065f46 0%, #064e3b 50%, #022c22 100%)';
    }

    return raw;
  }

  readonly isDarkText = computed(() => {
    const banner = this.currentBanner();
    if (!banner) return false;
    if (banner.textColor === 'dark') return true;
    if (banner.textColor === 'light') return false;

    // Automatic calculation from background luminance
    const bg = this.getBackgroundStyle(banner).toLowerCase();
    const hexMatches = bg.match(/#(?:[0-9a-fA-F]{6})/g);
    if (hexMatches && hexMatches.length > 0) {
      let totalLuminance = 0;
      for (const hex of hexMatches) {
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b;
      }
      const avgLuminance = totalLuminance / hexMatches.length;
      return avgLuminance > 140; // If light background (> 140), text MUST be dark!
    }

    return (
      bg.includes('ffffff') ||
      bg.includes('f8fafc') ||
      bg.includes('fde68a') ||
      bg.includes('fef3c7') ||
      bg.includes('f1f5f9') ||
      bg.includes('e2e8f0') ||
      bg.includes('white') ||
      bg.includes('cream')
    );
  });

  ngOnInit(): void {
    this.startAutoPlay();
  }

  ngOnDestroy(): void {
    this.stopAutoPlay();
    if (this.zoomTimeout) clearTimeout(this.zoomTimeout);
  }

  startAutoPlay(): void {
    this.stopAutoPlay();
    this.autoPlayTimer = setInterval(() => {
      if (!this.isHovered() && this.totalSlides() > 1 && this.zoomPhase() === 'idle') {
        this.nextSlide();
      }
    }, 6500);
  }

  stopAutoPlay(): void {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  onMouseEnter(): void {
    this.isHovered.set(true);
  }

  onMouseLeave(): void {
    this.isHovered.set(false);
  }

  prevSlide(): void {
    const total = this.totalSlides();
    if (total <= 1 || this.zoomPhase() === 'zooming') return;
    const prevIdx = (this.currentIndex() - 1 + total) % total;
    this.execute3DDepthTransition(prevIdx);
  }

  nextSlide(): void {
    const total = this.totalSlides();
    if (total <= 1 || this.zoomPhase() === 'zooming') return;
    const nextIdx = (this.currentIndex() + 1) % total;
    this.execute3DDepthTransition(nextIdx);
  }

  goTo(index: number): void {
    const total = this.totalSlides();
    if (index >= 0 && index < total && index !== this.currentIndex() && this.zoomPhase() === 'idle') {
      this.execute3DDepthTransition(index);
    }
  }

  selectSize(size: string): void {
    const idx = this.currentIndex();
    this.selectedSizes.update((prev) => ({
      ...prev,
      [idx]: size
    }));
  }

  /**
   * 3D Depth Zoom Transition ("पीछे سے آتا ہے اور آگے جاتا ہے"):
   * 1. The old product zooms forward into camera and dissolves.
   * 2. The new product comes from behind (scale 0.18, blurred) and rushes to foreground.
   */
  private execute3DDepthTransition(newIndex: number): void {
    const current = this.currentBanner();
    this.departingBanner.set(current);
    this.zoomPhase.set('zooming');
    this.isIncomingActive.set(false);

    // Update to new index
    this.currentIndex.set(newIndex);

    // Trigger incoming animation in next frame
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.isIncomingActive.set(true);
      }, 30);
    });

    if (this.zoomTimeout) clearTimeout(this.zoomTimeout);
    this.zoomTimeout = setTimeout(() => {
      this.zoomPhase.set('idle');
      this.departingBanner.set(null);
      this.isIncomingActive.set(false);
    }, 780);
  }

  formatImageUrl(imageUrl?: string | null): string {
    if (!imageUrl) return 'assets/placeholder.jpg';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    const apiBase = (window as any).__ESELLER_API_URL__ as string || 'https://api.esellerglobal.com/api/v1';
    const host = apiBase.replace(/\/api\/v1\/?$/, '');
    const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
    if (path.startsWith('/uploads')) {
      return `${host}${path}`;
    }
    return `${host}/uploads${path}`;
  }
}