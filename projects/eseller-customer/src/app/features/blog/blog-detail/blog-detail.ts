import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BlogService } from '../../../core/services/blog.service';
import { CustomerBlogPostDto } from '../../../core/models/blog.models';
import { SkeletonLayout } from 'eseller-shared';

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, SkeletonLayout],
  templateUrl: './blog-detail.html'
})
export class BlogDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly blogService = inject(BlogService);

  readonly isLoading = signal<boolean>(true);
  readonly post = signal<CustomerBlogPostDto | null>(null);
  readonly copied = signal<boolean>(false);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      this.loadPost(slug);
    } else {
      this.isLoading.set(false);
    }
  }

  loadPost(slug: string): void {
    this.isLoading.set(true);
    this.blogService.getPostBySlug(slug).subscribe({
      next: (data) => {
        this.post.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  copyLink(): void {
    navigator.clipboard.writeText(window.location.href);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
