import {
  Component,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HomeService, BrandDto, EmptyState, SkeletonLayout, resolveMediaUrl } from 'eseller-shared';
import {
  brandLogoFallback,
  brandInitialsAvatar,
  resolveBrandLogoUrl,
  isCuratedBrand
} from '../home/components/catalog-media';

@Component({
  selector: 'app-brands',
  imports: [CommonModule, RouterLink, FormsModule, EmptyState, SkeletonLayout],
  templateUrl: './brands.html',
  styleUrl: './brands.css'
})
export class Brands implements OnInit {
  private readonly homeService = inject(HomeService);

  readonly brands = signal<BrandDto[]>([]);
  readonly loading = signal<boolean>(true);
  readonly searchQuery = signal<string>('');

  readonly filteredBrands = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.brands();
    if (!q) return list;
    return list.filter((b) => b.name.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    this.loadBrands();
  }

  loadBrands(): void {
    this.loading.set(true);
    this.homeService.getBrands().subscribe({
      next: (b) => {
        const curated = (b || []).filter((x) => isCuratedBrand(x.name, x.slug, x.logoUrl));
        // Dedupe by display name (keep first)
        const seen = new Set<string>();
        this.brands.set(
          curated.filter((x) => {
            const key = x.name.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  getLogoUrl(brand: BrandDto): string {
    const resolved = resolveMediaUrl(brand.logoUrl);
    return resolveBrandLogoUrl(resolved, brand.slug, brand.name);
  }

  onLogoError(event: Event, brand: BrandDto): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    img.src = brandLogoFallback(brand.slug, brand.name) || brandInitialsAvatar(brand.name);
  }
}
