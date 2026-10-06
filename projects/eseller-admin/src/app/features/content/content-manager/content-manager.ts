import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminBlogPostDto, AdminCmsDto } from '../../../core/models/admin.models';
import { environment } from '../../../../environments/environment';

type ContentTab = 'blog' | 'cms';

@Component({
  selector: 'app-content-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './content-manager.html'
})
export class ContentManager implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly activeTab = signal<ContentTab>('blog');

  readonly blogPosts = signal<AdminBlogPostDto[]>([]);
  readonly cmsPages = signal<AdminCmsDto[]>([]);

  // Blog Post Modal
  readonly blogModalOpen = signal<boolean>(false);
  readonly editingPostId = signal<string | null>(null);
  readonly bpTitle = signal<string>('');
  readonly bpContent = signal<string>('');
  readonly bpCoverImageUrl = signal<string>('');
  readonly bpSeoTitle = signal<string>('');
  readonly bpSeoDescription = signal<string>('');
  readonly isSavingPost = signal<boolean>(false);
  readonly isUploadingCover = signal<boolean>(false);
  readonly localPreviewUrl = signal<string | null>(null);

  // CMS Edit Modal
  readonly cmsModalOpen = signal<boolean>(false);
  readonly selectedCms = signal<AdminCmsDto | null>(null);
  readonly cmsTitle = signal<string>('');
  readonly cmsContent = signal<string>('');
  readonly isSavingCms = signal<boolean>(false);

  formatImageUrl(url?: string | null): string {
    return this.adminService.formatImageUrl(url);
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);

    this.adminService.getBlogPosts().subscribe({
      next: (data) => {
        this.blogPosts.set(data || []);
      },
      error: () => {}
    });

    this.adminService.getCmsPages().subscribe({
      next: (data) => {
        this.cmsPages.set(data || []);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  openBlogModal(): void {
    this.editingPostId.set(null);
    this.bpTitle.set('');
    this.bpContent.set('');
    this.bpCoverImageUrl.set('');
    this.localPreviewUrl.set(null);
    this.bpSeoTitle.set('');
    this.bpSeoDescription.set('');
    this.blogModalOpen.set(true);
  }

  openEditBlogModal(post: AdminBlogPostDto): void {
    this.editingPostId.set(post.id);
    this.bpTitle.set(post.title);
    this.bpContent.set(post.content || '');
    this.bpCoverImageUrl.set(post.coverImageUrl || '');
    this.localPreviewUrl.set(null);
    this.bpSeoTitle.set(post.seoTitle || post.title);
    this.bpSeoDescription.set(post.seoDescription || '');
    this.blogModalOpen.set(true);

    this.adminService.getBlogPostById(post.id).subscribe({
      next: (fresh) => {
        if (fresh) {
          if (fresh.content) this.bpContent.set(fresh.content);
          if (fresh.seoDescription) this.bpSeoDescription.set(fresh.seoDescription);
          if (fresh.seoTitle) this.bpSeoTitle.set(fresh.seoTitle);
          if (fresh.coverImageUrl) this.bpCoverImageUrl.set(fresh.coverImageUrl);
        }
      },
      error: () => {}
    });
  }

  onBlogImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const objectUrl = URL.createObjectURL(file);
      this.localPreviewUrl.set(objectUrl);
      this.isUploadingCover.set(true);

      this.adminService.uploadBannerImage(file).subscribe({
        next: (res) => {
          this.isUploadingCover.set(false);
          if (res && res.imageUrl) {
            this.bpCoverImageUrl.set(res.imageUrl);
            this.toast.show('Cover image uploaded successfully!', 'success');
          }
        },
        error: (err) => {
          this.isUploadingCover.set(false);
          this.toast.show(err?.error?.error || 'Failed to upload cover image', 'error');
        }
      });
    }
  }

  removeCoverImage(): void {
    this.localPreviewUrl.set(null);
    this.bpCoverImageUrl.set('');
  }

  saveBlogPost(): void {
    const title = this.bpTitle().trim();
    const content = this.bpContent().trim();
    if (!title || !content) {
      this.toast.show('Title and content are required', 'error');
      return;
    }

    this.isSavingPost.set(true);

    const payload = {
      title,
      content,
      coverImageUrl: this.bpCoverImageUrl().trim() || null,
      isPublished: true,
      seoTitle: this.bpSeoTitle().trim() || title,
      seoDescription: this.bpSeoDescription().trim() || null
    };

    const editId = this.editingPostId();

    if (editId) {
      this.adminService.updateBlogPost(editId, payload).subscribe({
        next: () => {
          this.toast.show('Blog post updated successfully!', 'success');
          this.blogModalOpen.set(false);
          this.isSavingPost.set(false);
          this.loadData();
        },
        error: (err) => {
          this.isSavingPost.set(false);
          this.toast.show(err?.error?.error || 'Failed to update blog post', 'error');
        }
      });
    } else {
      this.adminService.createBlogPost(payload).subscribe({
        next: () => {
          this.toast.show('Blog article published to marketplace!', 'success');
          this.blogModalOpen.set(false);
          this.isSavingPost.set(false);
          this.loadData();
        },
        error: (err) => {
          this.isSavingPost.set(false);
          this.toast.show(err?.error?.error || 'Failed to publish blog post', 'error');
        }
      });
    }
  }

  deleteBlogPost(post: AdminBlogPostDto): void {
    if (!confirm(`Delete blog post "${post.title}"?`)) return;
    this.adminService.deleteBlogPost(post.id).subscribe({
      next: () => {
        this.toast.show('Post deleted', 'info');
        this.loadData();
      },
      error: (err) => this.toast.show(err?.error?.error || 'Failed to delete post', 'error')
    });
  }

  openCmsEdit(page: AdminCmsDto): void {
    this.selectedCms.set(page);
    this.cmsTitle.set(page.title);
    this.cmsContent.set(page.content);
    this.cmsModalOpen.set(true);

    this.adminService.getCmsPage(page.slug).subscribe({
      next: (fresh) => {
        if (fresh) {
          this.selectedCms.set(fresh);
          this.cmsTitle.set(fresh.title);
          this.cmsContent.set(fresh.content);
        }
      },
      error: () => {}
    });
  }

  saveCmsPage(): void {
    const page = this.selectedCms();
    if (!page) return;

    const title = this.cmsTitle().trim();
    const content = this.cmsContent().trim();

    if (!title || !content) {
      this.toast.show('Title and page content are required', 'error');
      return;
    }

    this.isSavingCms.set(true);

    this.adminService.saveCmsPage({
      id: page.id,
      slug: page.slug,
      title,
      content
    }).subscribe({
      next: () => {
        this.toast.show(`Page "${title}" updated successfully!`, 'success');
        this.cmsModalOpen.set(false);
        this.isSavingCms.set(false);
        this.loadData();
      },
      error: (err) => {
        this.isSavingCms.set(false);
        this.toast.show(err?.error?.error || 'Failed to update CMS page', 'error');
      }
    });
  }

  openPreview(type: 'blog' | 'cms', slug: string): void {
    const path = type === 'blog' ? `/blog/${slug}` : `/page/${slug}`;
    window.open(`${environment.customerUrl}${path}`, '_blank');
  }
}
