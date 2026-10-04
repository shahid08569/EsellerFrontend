import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BlogService } from '../../../core/services/blog.service';
import { CustomerBlogPostDto } from '../../../core/models/blog.models';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './blog-list.html'
})
export class BlogList implements OnInit {
  private readonly blogService = inject(BlogService);

  readonly isLoading = signal<boolean>(true);
  readonly posts = signal<CustomerBlogPostDto[]>([]);
  readonly totalCount = signal<number>(0);
  readonly pageNumber = signal<number>(1);
  readonly totalPages = signal<number>(1);
  readonly searchTerm = signal<string>('');

  ngOnInit(): void {
    this.loadPosts();
  }

  loadPosts(): void {
    this.isLoading.set(true);
    this.blogService.getPosts(this.pageNumber(), 12, this.searchTerm()).subscribe({
      next: (res) => {
        this.posts.set(res.items);
        this.totalCount.set(res.totalCount);
        this.totalPages.set(res.totalPages);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  onSearch(): void {
    this.pageNumber.set(1);
    this.loadPosts();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.pageNumber.set(page);
    this.loadPosts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
