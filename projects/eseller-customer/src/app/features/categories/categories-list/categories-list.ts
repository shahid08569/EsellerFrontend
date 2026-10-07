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
import {
  HomeService,
  CategoryTreeDto,
  EmptyState,
  SkeletonLayout,
  resolveMediaUrl
} from 'eseller-shared';
import { categoryImageFallback } from '../../home/components/catalog-media';

@Component({
  selector: 'app-categories-list',
  imports: [CommonModule, RouterLink, FormsModule, EmptyState, SkeletonLayout],
  templateUrl: './categories-list.html',
  styleUrl: './categories-list.css'
})
export class CategoriesList implements OnInit {
  private readonly homeService = inject(HomeService);

  readonly categories = signal<CategoryTreeDto[]>([]);
  readonly loading = signal<boolean>(true);
  readonly searchQuery = signal<string>('');

  // Filtered categories based on search query
  readonly filteredCategories = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.categories();
    if (!q) return list;

    return list.filter((cat) => {
      if (cat.name.toLowerCase().includes(q)) return true;
      if (cat.children && cat.children.some((c) => c.name.toLowerCase().includes(q))) {
        return true;
      }
      return false;
    });
  });

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading.set(true);
    this.homeService.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  getImageUrl(category: CategoryTreeDto): string | null {
    return (
      resolveMediaUrl(category.imageUrl) ||
      categoryImageFallback(category.slug, category.name)
    );
  }
}
