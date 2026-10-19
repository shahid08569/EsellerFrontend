import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminAuditLogDto } from '../../../core/models/admin.models';
import { TablePagination } from '../../../shared/components/table-pagination/table-pagination';

export type DatePreset = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom';

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

  // Filters State
  readonly searchTerm = signal<string>('');
  readonly datePreset = signal<DatePreset>('all');
  readonly customStartDate = signal<string>('');
  readonly customEndDate = signal<string>('');
  readonly selectedEntityType = signal<string>('all');
  readonly selectedActorType = signal<string>('all');
  readonly selectedAction = signal<string>('all');

  readonly datePresets: { id: DatePreset; label: string }[] = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: 'custom', label: 'Custom Range' }
  ];

  // Pagination State
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly pageSizeOptions = [10, 25, 50, 100];

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.isLoading.set(true);
    this.adminService.getAuditLogs({ pageSize: 500 }).subscribe({
      next: (list) => {
        this.logs.set(list || []);
        this.currentPage.set(1);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  // Dynamic Options derived from data
  readonly availableEntityTypes = computed(() => {
    const set = new Set<string>();
    for (const log of this.logs()) {
      if (log.entityType) set.add(log.entityType);
    }
    ['Shopkeeper', 'Order', 'Product', 'Platform'].forEach(e => set.add(e));
    return Array.from(set).sort();
  });

  readonly availableActorTypes = computed(() => {
    const set = new Set<string>();
    for (const log of this.logs()) {
      if (log.actorType) set.add(log.actorType);
    }
    ['SuperAdmin', 'Partner', 'System'].forEach(a => set.add(a));
    return Array.from(set).sort();
  });

  readonly availableActions = computed(() => {
    const set = new Set<string>();
    for (const log of this.logs()) {
      if (log.action) set.add(log.action);
    }
    return Array.from(set).sort();
  });

  private matchesDate(log: AdminAuditLogDto): boolean {
    const preset = this.datePreset();
    if (preset === 'all') return true;

    const raw = log.createdAt || log.timestamp;
    if (!raw) return false;
    const logDate = new Date(raw);
    if (isNaN(logDate.getTime())) return false;

    const now = new Date();

    if (preset === 'today') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return logDate >= startOfToday;
    }

    if (preset === 'yesterday') {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      return logDate >= startOfYesterday && logDate <= endOfYesterday;
    }

    if (preset === '7d') {
      const startOf7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return logDate >= startOf7d;
    }

    if (preset === '30d') {
      const startOf30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return logDate >= startOf30d;
    }

    if (preset === 'custom') {
      const start = this.customStartDate();
      const end = this.customEndDate();
      if (start) {
        const s = new Date(`${start}T00:00:00`);
        if (logDate < s) return false;
      }
      if (end) {
        const e = new Date(`${end}T23:59:59.999`);
        if (logDate > e) return false;
      }
      return true;
    }

    return true;
  }

  readonly filteredLogs = computed(() => {
    let list = this.logs();

    // 1. Date Filter
    list = list.filter(l => this.matchesDate(l));

    // 2. Entity Type Filter
    const entity = this.selectedEntityType();
    if (entity !== 'all') {
      list = list.filter(l => (l.entityType || '').toLowerCase() === entity.toLowerCase());
    }

    // 3. Actor Type Filter
    const actor = this.selectedActorType();
    if (actor !== 'all') {
      list = list.filter(l => (l.actorType || '').toLowerCase() === actor.toLowerCase());
    }

    // 4. Action Filter
    const act = this.selectedAction();
    if (act !== 'all') {
      list = list.filter(l => (l.action || '').toLowerCase() === act.toLowerCase());
    }

    // 5. Search Text Filter
    const term = this.searchTerm().trim().toLowerCase();
    if (term) {
      list = list.filter(l =>
        (l.action && l.action.toLowerCase().includes(term)) ||
        (l.userEmail && l.userEmail.toLowerCase().includes(term)) ||
        (l.actorEmail && l.actorEmail.toLowerCase().includes(term)) ||
        (l.entityType && l.entityType.toLowerCase().includes(term)) ||
        (l.entityId && l.entityId.toLowerCase().includes(term)) ||
        (l.details && l.details.toLowerCase().includes(term)) ||
        (l.newValues && l.newValues.toLowerCase().includes(term)) ||
        (l.oldValues && l.oldValues.toLowerCase().includes(term)) ||
        (l.ipAddress && l.ipAddress.toLowerCase().includes(term))
      );
    }

    return list;
  });

  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.datePreset() !== 'all') count++;
    if (this.datePreset() === 'custom' && (this.customStartDate() || this.customEndDate())) count++;
    if (this.selectedEntityType() !== 'all') count++;
    if (this.selectedActorType() !== 'all') count++;
    if (this.selectedAction() !== 'all') count++;
    if (this.searchTerm().trim()) count++;
    return count;
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredLogs().length / this.pageSize())));

  readonly pagedLogs = computed(() => {
    const list = this.filteredLogs();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  // Filter Actions
  setDatePreset(preset: DatePreset): void {
    this.datePreset.set(preset);
    this.currentPage.set(1);
  }

  onCustomDateChange(type: 'start' | 'end', value: string): void {
    if (type === 'start') {
      this.customStartDate.set(value);
    } else {
      this.customEndDate.set(value);
    }
    this.currentPage.set(1);
  }

  applyCustomDate(): void {
    this.currentPage.set(1);
  }

  onEntityTypeChange(val: string): void {
    this.selectedEntityType.set(val);
    this.currentPage.set(1);
  }

  onActorTypeChange(val: string): void {
    this.selectedActorType.set(val);
    this.currentPage.set(1);
  }

  onActionChange(val: string): void {
    this.selectedAction.set(val);
    this.currentPage.set(1);
  }

  onSearchChange(val: string): void {
    this.searchTerm.set(val);
    this.currentPage.set(1);
  }

  clearAllFilters(): void {
    this.datePreset.set('all');
    this.customStartDate.set('');
    this.customEndDate.set('');
    this.selectedEntityType.set('all');
    this.selectedActorType.set('all');
    this.selectedAction.set('all');
    this.searchTerm.set('');
    this.currentPage.set(1);
  }

  // Pagination Actions
  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  getActionBadgeClass(action: string): string {
    const act = (action || '').toUpperCase();
    if (act.includes('APPROVE') || act.includes('VERIF') || act.includes('CREATE')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('REJECT') || act.includes('DELETE') || act.includes('REMOVE') || act.includes('SUSPEND') || act.includes('BLOCK')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('STATUS')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (act.includes('ORDER')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (act.includes('SYSTEM')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    return 'bg-orange-50 text-orange-700 border-orange-200';
  }
}

