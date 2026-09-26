import { Component, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BrandDto } from 'eseller-shared';

@Component({
  selector: 'app-brands-grid',
  imports: [RouterLink],
  templateUrl: './brands-grid.html'
})
export class BrandsGrid {
  readonly brands = input<BrandDto[]>([]);
  readonly title = input<string>('Top Brands');
  readonly viewAllLink = input<string>('/brands');
  readonly limit = input<number>(10);

  readonly visibleBrands = computed(() =>
    this.brands().slice(0, this.limit())
  );

  getLogoUrl(logoUrl: string | null | undefined): string | null {
    if (!logoUrl) return null;
    if (logoUrl.startsWith('http')) return logoUrl;
    const apiBase = (window as any).__ESELLER_API_URL__ as string;
    const host = apiBase.replace(/\/api\/v1\/?$/, '');
    const path = logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`;
    return `${host}/uploads${path}`;
  }
}