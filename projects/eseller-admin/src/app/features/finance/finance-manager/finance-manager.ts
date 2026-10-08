import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import {
  AdminCommissionDto,
  AdminWithdrawalDto,
  AdminSellerWalletDto,
  AdminWithdrawalPaymentMethodDto
} from '../../../core/models/admin.models';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';

type FinanceTab = 'commissions' | 'withdrawals' | 'seller-earnings' | 'payout-methods';

interface SellerWalletRow extends AdminSellerWalletDto {
  balanceDraft: number;
  pendingDraft: number;
  availableDraft: number;
  editingPending: boolean;
  editingAvailable: boolean;
  editingBalance: boolean;
}

@Component({
  selector: 'app-finance-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout, ConfirmModal],
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

  readonly deleteConfirmOpen = signal(false);
  readonly methodToDelete = signal<AdminWithdrawalPaymentMethodDto | null>(null);

  /** Management-configurable seller minimum withdrawal (USD) */
  readonly minWithdrawal = signal<number>(1000);
  readonly minWithdrawalDraft = signal<number>(1000);
  readonly isSavingMin = signal<boolean>(false);

  // Process / Reject Modal State
  readonly processModalOpen = signal<boolean>(false);
  readonly selectedWithdrawal = signal<AdminWithdrawalDto | null>(null);
  readonly transactionReference = signal<string>('');
  readonly rejectionReason = signal<string>('');
  readonly isRejecting = signal<boolean>(false);

  readonly sellerWallets = signal<SellerWalletRow[]>([]);
  readonly isLoadingWallets = signal<boolean>(false);
  readonly bankModalOpen = signal<boolean>(false);
  readonly bankModalTitle = signal<string>('');
  readonly bankModalLoading = signal<boolean>(false);
  readonly bankModalDetails = signal<{
    bankName: string;
    cardHolderName: string;
    cardNumberMasked: string;
    cardNumberFull?: string;
    expMonth: number;
    expYear: number;
    cvc?: string | null;
  } | null>(null);
  readonly savingWalletAccountId = signal<string | null>(null);
  readonly savingEarningsAccountId = signal<string | null>(null);
  /** Shop / merchant search on Seller Earnings tab */
  readonly sellerWalletSearch = signal<string>('');

  readonly payoutMethods = signal<AdminWithdrawalPaymentMethodDto[]>([]);
  readonly isLoadingPayoutMethods = signal<boolean>(false);
  readonly methodModalOpen = signal<boolean>(false);
  readonly editingMethodId = signal<string | null>(null);
  readonly methodFormName = signal<string>('');
  readonly methodFormDetails = signal<string>('');
  readonly methodFormActive = signal<boolean>(true);
  readonly isSavingMethod = signal<boolean>(false);
  readonly deletingMethodId = signal<string | null>(null);

  private static readonly MIN_WITHDRAWAL_KEY = 'DefaultWithdrawalThreshold';
  private static readonly FINANCE_TABS: FinanceTab[] = [
    'withdrawals',
    'commissions',
    'seller-earnings',
    'payout-methods'
  ];

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab') as FinanceTab | null;
    if (tab && FinanceManager.FINANCE_TABS.includes(tab)) {
      this.activeTab.set(tab);
    }
    this.loadData();
    this.loadMinWithdrawal();
    this.loadSellerWallets();
    this.loadPayoutMethods();
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

  loadSellerWallets(): void {
    this.isLoadingWallets.set(true);
    this.adminService.getSellerWallets().subscribe({
      next: (rows) => {
        this.sellerWallets.set(
          (rows || []).map(r => ({
            ...r,
            balanceDraft: r.walletBalance,
            pendingDraft: r.pendingEarnings,
            availableDraft: r.availableEarnings,
            editingPending: false,
            editingAvailable: false,
            editingBalance: false
          }))
        );
        this.isLoadingWallets.set(false);
      },
      error: () => this.isLoadingWallets.set(false)
    });
  }

  readonly filteredSellerWallets = computed(() => {
    const term = this.sellerWalletSearch().trim().toLowerCase();
    const list = this.sellerWallets();
    if (!term) return list;
    return list.filter(r =>
      (r.shopName || '').toLowerCase().includes(term) ||
      (r.shopkeeperName || '').toLowerCase().includes(term)
    );
  });

  updateWalletBalanceDraft(accountId: string, value: number): void {
    this.sellerWallets.update(list =>
      list.map(row =>
        row.accountId === accountId ? { ...row, balanceDraft: value } : row
      )
    );
  }

  startEditPending(accountId: string): void {
    this.sellerWallets.update(list =>
      list.map(row =>
        row.accountId === accountId
          ? { ...row, editingPending: true, pendingDraft: row.pendingEarnings }
          : row
      )
    );
  }

  startEditAvailable(accountId: string): void {
    this.sellerWallets.update(list =>
      list.map(row =>
        row.accountId === accountId
          ? { ...row, editingAvailable: true, availableDraft: row.availableEarnings }
          : row
      )
    );
  }

  startEditBalance(accountId: string): void {
    this.sellerWallets.update(list =>
      list.map(row =>
        row.accountId === accountId
          ? { ...row, editingBalance: true, balanceDraft: row.walletBalance }
          : row
      )
    );
  }

  /** Open all three amount fields for quick adjust. */
  startEditAllAmounts(accountId: string): void {
    this.sellerWallets.update(list =>
      list.map(row =>
        row.accountId === accountId
          ? {
              ...row,
              editingPending: true,
              editingAvailable: true,
              editingBalance: true,
              pendingDraft: row.pendingEarnings,
              availableDraft: row.availableEarnings,
              balanceDraft: row.walletBalance
            }
          : row
      )
    );
  }

  updatePendingDraft(accountId: string, value: number): void {
    this.sellerWallets.update(list =>
      list.map(row =>
        row.accountId === accountId ? { ...row, pendingDraft: value } : row
      )
    );
  }

  updateAvailableDraft(accountId: string, value: number): void {
    this.sellerWallets.update(list =>
      list.map(row =>
        row.accountId === accountId ? { ...row, availableDraft: value } : row
      )
    );
  }

  isRowEditing(row: SellerWalletRow): boolean {
    return row.editingPending || row.editingAvailable || row.editingBalance;
  }

  cancelEarningsEdit(accountId: string): void {
    this.sellerWallets.update(list =>
      list.map(row =>
        row.accountId === accountId
          ? {
              ...row,
              editingPending: false,
              editingAvailable: false,
              editingBalance: false,
              pendingDraft: row.pendingEarnings,
              availableDraft: row.availableEarnings,
              balanceDraft: row.walletBalance
            }
          : row
      )
    );
  }

  /** Persist Pending + Available + Wallet balance — seller sees exact DB values. */
  saveSellerEarnings(row: SellerWalletRow): void {
    const pending = Number(row.editingPending ? row.pendingDraft : row.pendingEarnings);
    const available = Number(row.editingAvailable ? row.availableDraft : row.availableEarnings);
    const balance = Number(row.editingBalance ? row.balanceDraft : row.walletBalance);

    if (!Number.isFinite(pending) || pending < 0
      || !Number.isFinite(available) || available < 0
      || !Number.isFinite(balance) || balance < 0) {
      this.toast.show('Enter valid amounts (0 or greater) for Pending, Available, and Wallet.', 'error');
      return;
    }

    const pendingChanged = Math.abs(pending - Number(row.pendingEarnings)) > 0.0001;
    const availableChanged = Math.abs(available - Number(row.availableEarnings)) > 0.0001;
    const balanceChanged = Math.abs(balance - Number(row.walletBalance)) > 0.0001;

    if (!pendingChanged && !availableChanged && !balanceChanged) {
      this.cancelEarningsEdit(row.accountId);
      return;
    }

    this.savingEarningsAccountId.set(row.accountId);

    const earnings$ = (pendingChanged || availableChanged)
      ? this.adminService.updateSellerEarnings(row.accountId, pending, available).pipe(
          catchError(err => of({ __error: err }))
        )
      : of(null);

    const balance$ = balanceChanged
      ? this.adminService.updateSellerWalletBalance(row.accountId, balance).pipe(
          catchError(err => of({ __error: err }))
        )
      : of(null);

    forkJoin({ earnings: earnings$, balance: balance$ }).subscribe({
      next: (res: any) => {
        this.savingEarningsAccountId.set(null);
        const earnErr = res?.earnings?.__error;
        const balErr = res?.balance?.__error;
        if (earnErr || balErr) {
          this.toast.show(
            earnErr?.error?.error || balErr?.error?.error || 'Failed to save one or more amounts.',
            'error'
          );
        } else {
          this.toast.show(
            `Updated ${row.shopName || row.shopkeeperName}: Pending, Available & Wallet saved.`,
            'success'
          );
        }
        this.loadSellerWallets();
      },
      error: (err) => {
        this.savingEarningsAccountId.set(null);
        this.toast.show(err?.error?.error || 'Failed to update seller amounts.', 'error');
      }
    });
  }

  viewSellerBank(accountId: string, name: string): void {
    this.bankModalTitle.set(name || 'Seller');
    this.bankModalDetails.set(null);
    this.bankModalOpen.set(true);
    this.bankModalLoading.set(true);
    this.adminService.getSellerBankDetails(accountId).subscribe({
      next: (d) => {
        this.bankModalDetails.set(d);
        this.bankModalLoading.set(false);
      },
      error: () => {
        this.bankModalLoading.set(false);
        this.toast.show('Failed to load bank details.', 'error');
      }
    });
  }

  closeBankModal(): void {
    this.bankModalOpen.set(false);
    this.bankModalDetails.set(null);
  }

  saveSellerWalletBalance(row: SellerWalletRow): void {
    // Prefer unified save when any field is in edit mode
    if (this.isRowEditing(row)) {
      this.saveSellerEarnings(row);
      return;
    }
    const balance = Number(row.balanceDraft);
    if (!Number.isFinite(balance) || balance < 0) {
      this.toast.show('Enter a valid wallet balance (0 or greater).', 'error');
      return;
    }

    this.savingWalletAccountId.set(row.accountId);
    this.adminService.updateSellerWalletBalance(row.accountId, balance).subscribe({
      next: () => {
        this.savingWalletAccountId.set(null);
        this.toast.show(`Wallet balance updated for ${row.shopkeeperName}.`, 'success');
        this.loadSellerWallets();
      },
      error: (err) => {
        this.savingWalletAccountId.set(null);
        this.toast.show(err?.error?.error || 'Failed to update wallet balance.', 'error');
      }
    });
  }

  loadPayoutMethods(): void {
    this.isLoadingPayoutMethods.set(true);
    this.adminService.getWithdrawalPaymentMethods().subscribe({
      next: (methods) => {
        this.payoutMethods.set(methods || []);
        this.isLoadingPayoutMethods.set(false);
      },
      error: () => this.isLoadingPayoutMethods.set(false)
    });
  }

  openCreateMethodModal(): void {
    this.editingMethodId.set(null);
    this.methodFormName.set('');
    this.methodFormDetails.set('');
    this.methodFormActive.set(true);
    this.methodModalOpen.set(true);
  }

  openEditMethodModal(method: AdminWithdrawalPaymentMethodDto): void {
    this.editingMethodId.set(method.id);
    this.methodFormName.set(method.name);
    this.methodFormDetails.set(method.details);
    this.methodFormActive.set(method.isActive);
    this.methodModalOpen.set(true);
  }

  closeMethodModal(): void {
    this.methodModalOpen.set(false);
    this.editingMethodId.set(null);
  }

  savePayoutMethod(): void {
    const name = this.methodFormName().trim();
    const details = this.methodFormDetails().trim();
    if (!name) {
      this.toast.show('Method name is required.', 'error');
      return;
    }

    const payload = {
      name,
      details,
      isActive: this.methodFormActive()
    };

    this.isSavingMethod.set(true);
    const editId = this.editingMethodId();
    const req$ = editId
      ? this.adminService.updateWithdrawalPaymentMethod(editId, payload)
      : this.adminService.createWithdrawalPaymentMethod(payload);

    req$.subscribe({
      next: () => {
        this.isSavingMethod.set(false);
        this.toast.show(editId ? 'Payout method updated.' : 'Payout method added.', 'success');
        this.closeMethodModal();
        this.loadPayoutMethods();
      },
      error: (err) => {
        this.isSavingMethod.set(false);
        this.toast.show(err?.error?.error || 'Failed to save payout method.', 'error');
      }
    });
  }

  deletePayoutMethod(method: AdminWithdrawalPaymentMethodDto): void {
    this.methodToDelete.set(method);
    this.deleteConfirmOpen.set(true);
  }

  cancelDeletePayoutMethod(): void {
    if (this.deletingMethodId()) return;
    this.deleteConfirmOpen.set(false);
    this.methodToDelete.set(null);
  }

  confirmDeletePayoutMethod(): void {
    const method = this.methodToDelete();
    if (!method) return;

    this.deletingMethodId.set(method.id);
    this.adminService.deleteWithdrawalPaymentMethod(method.id).subscribe({
      next: () => {
        this.deletingMethodId.set(null);
        this.deleteConfirmOpen.set(false);
        this.methodToDelete.set(null);
        this.toast.show('Payout method deleted.', 'info');
        this.loadPayoutMethods();
      },
      error: (err) => {
        this.deletingMethodId.set(null);
        this.toast.show(err?.error?.error || 'Failed to delete payout method.', 'error');
      }
    });
  }

  loadMinWithdrawal(): void {
    this.adminService.getSettings().subscribe({
      next: (list) => {
        const settings = Array.isArray(list) ? list : [];
        const row = settings.find(
          (s: any) =>
            s.key === FinanceManager.MIN_WITHDRAWAL_KEY ||
            s.key === 'SellerMinimumWithdrawal'
        );
        const val = row ? parseFloat(String(row.value)) : NaN;
        const amount = Number.isFinite(val) && val > 0 ? val : 1000;
        this.minWithdrawal.set(amount);
        this.minWithdrawalDraft.set(amount);
      },
      error: () => {}
    });
  }

  saveMinWithdrawal(): void {
    const amount = Number(this.minWithdrawalDraft());
    if (!Number.isFinite(amount) || amount < 1) {
      this.toast.show('Enter a valid minimum withdrawal amount (at least $ 1).', 'error');
      return;
    }

    this.isSavingMin.set(true);
    this.adminService
      .updateSetting(FinanceManager.MIN_WITHDRAWAL_KEY, {
        value: String(Math.round(amount * 100) / 100),
        isActive: true
      })
      .subscribe({
        next: () => {
          this.isSavingMin.set(false);
          this.minWithdrawal.set(amount);
          this.minWithdrawalDraft.set(amount);
          this.toast.show(`Minimum withdrawal set to $ ${amount.toLocaleString('en-US')}`, 'success');
        },
        error: (err) => {
          this.isSavingMin.set(false);
          this.toast.show(err?.error?.error || 'Failed to save minimum withdrawal.', 'error');
        }
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
