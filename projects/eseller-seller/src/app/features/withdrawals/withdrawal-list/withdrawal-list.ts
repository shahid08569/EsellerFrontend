import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService, ShopDto } from '../../../core/services/seller.service';
import { ToastService } from 'eseller-shared';

interface WithdrawalRequest {
  id: string;
  amount: number;
  paymentMethod: string;
  accountDetails: string;
  status: string;
  requestedAt: string;
  processedAt?: string | null;
}

@Component({
  selector: 'app-withdrawal-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './withdrawal-list.html'
})
export class WithdrawalList implements OnInit {
  private readonly sellerSvc = inject(SellerService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly shop = signal<ShopDto | null>(null);
  readonly availableBalance = signal<number>(0);
  readonly pendingEarnings = signal<number>(0);
  readonly withdrawalHistory = signal<WithdrawalRequest[]>([]);

  readonly requestModalOpen = signal<boolean>(false);
  readonly withdrawAmount = signal<number>(1000);
  readonly paymentMethod = signal<string>('Bank Transfer');
  readonly accountTitle = signal<string>('');
  readonly accountNumber = signal<string>('');
  readonly bankName = signal<string>('');
  readonly isSubmitting = signal<boolean>(false);

  readonly MIN_WITHDRAWAL = 1000;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.sellerSvc.getMyShop().subscribe({
      next: (s) => {
        this.shop.set(s);
        this.sellerSvc.getWalletSummary().subscribe({
          next: (sum) => {
            this.availableBalance.set(Number(sum.availableToWithdraw) || 0);
            this.pendingEarnings.set(Number(sum.pendingEarnings) || 0);
            this.sellerSvc.getWithdrawals(1, 50).subscribe({
              next: (res: any) => {
                const items = Array.isArray(res) ? res : res?.items || [];
                this.withdrawalHistory.set(
                  items.map((w: any) => {
                    const raw = String(w.payoutMethod || 'Bank Transfer');
                    const parts = raw.split(' | ');
                    return {
                      id: w.id,
                      amount: w.amount,
                      paymentMethod: parts[0] || 'Bank Transfer',
                      accountDetails: parts.slice(1).join(' | ') || raw,
                      status: w.status || 'Pending',
                      requestedAt: w.requestedAt,
                      processedAt: w.processedAt
                    };
                  })
                );
                this.isLoading.set(false);
              },
              error: () => this.isLoading.set(false)
            });
          },
          error: () => {
            this.availableBalance.set(0);
            this.isLoading.set(false);
          }
        });
      },
      error: () => this.isLoading.set(false)
    });
  }

  openRequestModal(): void {
    this.withdrawAmount.set(
      Math.max(this.MIN_WITHDRAWAL, Math.min(this.availableBalance() || this.MIN_WITHDRAWAL, this.availableBalance()))
    );
    this.accountTitle.set(this.shop()?.name || '');
    this.requestModalOpen.set(true);
  }

  closeRequestModal(): void {
    this.requestModalOpen.set(false);
  }

  submitWithdrawal(): void {
    const amount = Number(this.withdrawAmount());
    const balance = this.availableBalance();

    if (amount < this.MIN_WITHDRAWAL) {
      this.toast.show(`Minimum withdrawal amount is $ ${this.MIN_WITHDRAWAL}`, 'error');
      return;
    }

    if (amount > balance) {
      this.toast.show('Requested amount exceeds available balance', 'error');
      return;
    }

    if (!this.accountNumber().trim()) {
      this.toast.show('Please provide your bank or mobile wallet account number', 'error');
      return;
    }

    this.isSubmitting.set(true);
    const details = `${this.accountTitle()} - ${this.accountNumber()} (${this.bankName().trim() || 'Bank'})`;

    this.sellerSvc
      .requestWithdrawal({
        amount,
        payoutMethod: this.paymentMethod(),
        accountDetails: details
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.toast.show(`Withdrawal request of $ ${amount} submitted to Super Admin!`, 'success');
          this.closeRequestModal();
          this.loadData();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const msg =
            (typeof err?.error === 'string' ? err.error : '') ||
            err?.message ||
            'Failed to submit withdrawal request.';
          this.toast.show(msg, 'error');
        }
      });
  }
}
