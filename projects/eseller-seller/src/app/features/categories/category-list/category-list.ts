import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HomeService, CategoryTreeDto, ToastService } from 'eseller-shared';
import { ImageUrlPipe } from '../../../shared/pipes/image-url.pipe';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ImageUrlPipe, ImgFallbackDirective],
  templateUrl: './category-list.html'
})
export class CategoryList implements OnInit {
  private readonly homeService = inject(HomeService);
  private readonly toast = inject(ToastService);

  readonly categories = signal<CategoryTreeDto[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly searchTerm = signal<string>('');

  ngOnInit() {
    this.loadCategories();
  }

  loadCategories() {
    this.isLoading.set(true);
    this.homeService.getCategories(true).subscribe({
      next: (tree) => {
        this.categories.set(tree);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.show('Failed to load categories catalog', 'error');
      }
    });
  }

  readonly filteredCategories = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.categories() || [];
    if (!term) return list;

    // Filter root or if any child matches
    return list.filter(cat => 
      cat.name?.toLowerCase().includes(term) ||
      (cat.children && cat.children.some(c => 
        c.name?.toLowerCase().includes(term) ||
        (c.children && c.children.some(gc => gc.name?.toLowerCase().includes(term)))
      ))
    );
  });
}
