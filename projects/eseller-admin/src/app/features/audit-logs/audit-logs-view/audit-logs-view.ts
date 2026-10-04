import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminAuditLogDto } from '../../../core/models/admin.models';

@Component({
  selector: 'app-audit-logs-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-logs-view.html'
})
export class AuditLogsView implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly logs = signal<AdminAuditLogDto[]>([]);
  readonly searchTerm = signal<string>('');

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.isLoading.set(true);
    this.adminService.getAuditLogs().subscribe({
      next: (list) => {
        this.logs.set(list || []);
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
      (l.entityType && l.entityType.toLowerCase().includes(term)) ||
      (l.details && l.details.toLowerCase().includes(term))
    );
  });
}
