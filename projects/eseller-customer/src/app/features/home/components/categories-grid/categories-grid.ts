import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CategoryTreeDto } from 'eseller-shared';

@Component({
  selector: 'app-categories-grid',
  imports: [RouterLink],
  templateUrl: './categories-grid.html'
})
export class CategoriesGrid {
  readonly categories = input<CategoryTreeDto[]>([]);

  getImageUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    const apiBase = (window as any).__ESELLER_API_URL__ as string;
    const host = apiBase.replace(/\/api\/v1\/?$/, '');
    const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
    return `${host}/uploads${path}`;
  }
}