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
import { brandLogoFallback } from '../home/components/catalog-media';

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
        this.brands.set(b);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  getLogoUrl(brand: BrandDto): string | null {
    const resolved = resolveMediaUrl(brand.logoUrl);
    if (!resolved || resolved.includes('/uploads/')) {
      return brandLogoFallback(brand.slug, brand.name) || resolved;
    }
    return resolved;
  }
}
