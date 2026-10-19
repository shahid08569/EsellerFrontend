import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminAuditLogDto } from '../../../core/models/admin.models';
import { TablePagination } from '../../../shared/components/table-pagination/table-pagination';

@Component({
  selector: 'app-audit-logs-view',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout, TablePagination],
  templateUrl: './audit-logs-view.html'
})
export class AuditLogsView implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly logs = signal<AdminAuditLogDto[]>([]);
  readonly searchTerm = signal<string>('');

  // Pagination
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 25, 50, 100];

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.isLoading.set(true);
    this.adminService.getAuditLogs().subscribe({
      next: (list) => {
        this.logs.set(list || []);
        this.currentPage.set(1);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  readonly filteredLogs = computed(() => {
    const list = this.logs();
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return list;
    return list.filter(l =>
      l.action.toLowerCase().includes(term) ||
      (l.userEmail && l.userEmail.toLowerCase().includes(term)) ||
      (l.actorEmail && l.actorEmail.toLowerCase().includes(term)) ||
      (l.entityType && l.entityType.toLowerCase().includes(term)) ||
      (l.details && l.details.toLowerCase().includes(term)) ||
      (l.newValues && l.newValues.toLowerCase().includes(term)) ||
      (l.oldValues && l.oldValues.toLowerCase().includes(term))
    );
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredLogs().length / this.pageSize())));

  readonly pagedLogs = computed(() => {
    const list = this.filteredLogs();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  onSearchChange(val: string): void {
    this.searchTerm.set(val);
    this.currentPage.set(1);
  }
}
