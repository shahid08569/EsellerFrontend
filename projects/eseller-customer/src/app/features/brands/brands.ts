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
import { HomeService, BrandDto, EmptyState } from 'eseller-shared';

@Component({
  selector: 'app-brands',
  imports: [CommonModule, RouterLink, FormsModule, EmptyState],
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

  getLogoUrl(logoUrl: string | null | undefined): string | null {
    if (!logoUrl) return null;
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://') || logoUrl.startsWith('data:') || logoUrl.startsWith('blob:')) {
      return logoUrl;
    }
    const apiBase =
      ((typeof window !== 'undefined' ? (window as any).__ESELLER_API_URL__ : '') as string) ||
      'https://localhost:7127/api/v1';
    const host = apiBase.replace(/\/api\/v1\/?$/, '');
    const path = logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`;
    if (path.startsWith('/uploads/')) return `${host}${path}`;
    return `${host}/uploads${path}`;
  }
}
