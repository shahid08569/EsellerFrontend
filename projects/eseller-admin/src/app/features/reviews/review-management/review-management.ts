import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminReviewDto } from '../../../core/models/admin.models';
import { TablePagination } from '../../../shared/components/table-pagination/table-pagination';

type ReviewStatusFilter = 'pending' | 'approved' | 'all';

@Component({
  selector: 'app-review-management',
  standalone: true,
  imports: [CommonModule, TablePagination],
  templateUrl: './review-management.html'
})
export class ReviewManagement implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal(true);
  readonly reviews = signal<AdminReviewDto[]>([]);
  readonly statusFilter = signal<ReviewStatusFilter>('pending');
  readonly totalCount = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 25, 50];

  readonly pendingCount = signal(0);
  readonly approvedCount = signal(0);

  readonly actionId = signal<string | null>(null);
  readonly deleteModalOpen = signal(false);
  readonly reviewToDelete = signal<AdminReviewDto | null>(null);

  ngOnInit(): void {
    this.loadCounts();
    this.loadReviews();
  }

  setFilter(filter: ReviewStatusFilter): void {
    if (this.statusFilter() === filter) return;
    this.statusFilter.set(filter);
    this.currentPage.set(1);
    this.loadReviews();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadReviews();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadReviews();
  }

  loadReviews(): void {
    this.isLoading.set(true);
    this.adminService
      .getReviews(this.statusFilter(), this.currentPage(), this.pageSize())
      .subscribe({
        next: (res) => {
          this.reviews.set(res.items);
          this.totalCount.set(res.totalCount);
          this.isLoading.set(false);
        },
        error: () => {
          this.reviews.set([]);
          this.totalCount.set(0);
          this.isLoading.set(false);
          this.toast.show('Could not load reviews.', 'error');
        }
      });
  }

  loadCounts(): void {
    this.adminService.getReviews('pending', 1, 1).subscribe({
      next: (res) => this.pendingCount.set(res.totalCount)
    });
    this.adminService.getReviews('approved', 1, 1).subscribe({
      next: (res) => this.approvedCount.set(res.totalCount)
    });
  }

  keepReview(review: AdminReviewDto): void {
    if (review.isApproved || this.actionId()) return;
    this.actionId.set(review.id);
    this.adminService.keepReview(review.id).subscribe({
      next: () => {
        this.toast.show('Review kept — now live on the product.', 'success');
        this.actionId.set(null);
        this.loadCounts();
        this.loadReviews();
      },
      error: () => {
        this.actionId.set(null);
        this.toast.show('Could not keep this review.', 'error');
      }
    });
  }

  openDeleteModal(review: AdminReviewDto): void {
    this.reviewToDelete.set(review);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    if (this.actionId()) return;
    this.deleteModalOpen.set(false);
    this.reviewToDelete.set(null);
  }

  confirmDelete(): void {
    const review = this.reviewToDelete();
    if (!review || this.actionId()) return;
    this.actionId.set(review.id);
    this.adminService.deleteReview(review.id).subscribe({
      next: () => {
        this.toast.show('Review deleted.', 'success');
        this.actionId.set(null);
        this.deleteModalOpen.set(false);
        this.reviewToDelete.set(null);
        this.loadCounts();
        this.loadReviews();
      },
      error: () => {
        this.actionId.set(null);
        this.toast.show('Could not delete this review.', 'error');
      }
    });
  }

  stars(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i + 1);
  }

  formatDate(value: string): string {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return value;
    }
  }
}
