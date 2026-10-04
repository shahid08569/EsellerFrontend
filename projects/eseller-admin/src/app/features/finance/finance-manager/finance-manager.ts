import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminCommissionDto, AdminWithdrawalDto } from '../../../core/models/admin.models';

type FinanceTab = 'commissions' | 'withdrawals';

@Component({
  selector: 'app-finance-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './finance-manager.html'
})
export class FinanceManager implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal<boolean>(true);
  readonly activeTab = signal<FinanceTab>('withdrawals');
  readonly commissions = signal<AdminCommissionDto[]>([]);
  readonly withdrawals = signal<AdminWithdrawalDto[]>([]);
  readonly actionInProgress = signal<string | null>(null);

  // Process / Reject Modal State
  readonly processModalOpen = signal<boolean>(false);
  readonly selectedWithdrawal = signal<AdminWithdrawalDto | null>(null);
  readonly transactionReference = signal<string>('');
  readonly rejectionReason = signal<string>('');
  readonly isRejecting = signal<boolean>(false);

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab') as FinanceTab | null;
    if (tab && ['commissions', 'withdrawals'].includes(tab)) {
      this.activeTab.set(tab);
    }
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.adminService.getWithdrawals().subscribe({
      next: (data) => {
        this.withdrawals.set(data || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });

    this.adminService.getCommissions().subscribe({
      next: (data) => {
        this.commissions.set(data || []);
      },
      error: () => {}
    });
  }

  readonly pendingWithdrawals = computed(() =>
    this.withdrawals().filter(w => String(w.status).toLowerCase() === 'pending')
  );

  approveWithdrawal(w: AdminWithdrawalDto): void {
    this.actionInProgress.set(w.id);
    this.adminService.approveWithdrawal(w.id).subscribe({
      next: () => {
        this.actionInProgress.set(null);
        this.toast.show(`Withdrawal request approved`, 'success');
        this.loadData();
      },
      error: (err) => {
        this.actionInProgress.set(null);
        this.toast.show(err?.error?.error || 'Failed to approve withdrawal', 'error');
      }
    });
  }

  openProcessModal(w: AdminWithdrawalDto): void {
    this.selectedWithdrawal.set(w);
    this.transactionReference.set('');
    this.isRejecting.set(false);
    this.processModalOpen.set(true);
  }

  openRejectModal(w: AdminWithdrawalDto): void {
    this.selectedWithdrawal.set(w);
    this.rejectionReason.set('');
    this.isRejecting.set(true);
    this.processModalOpen.set(true);
  }

  closeProcessModal(): void {
    this.processModalOpen.set(false);
    this.selectedWithdrawal.set(null);
  }

  confirmProcessOrReject(): void {
    const w = this.selectedWithdrawal();
    if (!w) return;

    if (this.isRejecting()) {
      const reason = this.rejectionReason().trim();
      if (!reason) {
        this.toast.show('Rejection reason is required', 'error');
        return;
      }
      this.actionInProgress.set(w.id);
      this.closeProcessModal();
      this.adminService.rejectWithdrawal(w.id, reason).subscribe({
        next: () => {
          this.actionInProgress.set(null);
          this.toast.show('Withdrawal rejected', 'info');
          this.loadData();
        },
        error: (err) => {
          this.actionInProgress.set(null);
          this.toast.show(err?.error?.error || 'Failed to reject withdrawal', 'error');
        }
      });
    } else {
      const ref = this.transactionReference().trim();
      if (!ref) {
        this.toast.show('Transaction / Bank reference is required', 'error');
        return;
      }
      this.actionInProgress.set(w.id);
      this.closeProcessModal();
      this.adminService.processWithdrawal(w.id, ref).subscribe({
        next: () => {
          this.actionInProgress.set(null);
          this.toast.show('Withdrawal marked as Processed & Paid', 'success');
          this.loadData();
        },
        error: (err) => {
          this.actionInProgress.set(null);
          this.toast.show(err?.error?.error || 'Failed to process payout', 'error');
        }
      });
    }
  }
}
