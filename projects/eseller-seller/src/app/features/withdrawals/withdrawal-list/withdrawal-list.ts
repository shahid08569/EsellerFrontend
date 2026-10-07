import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService, ShopDto } from '../../../core/services/seller.service';
import { ToastService, SkeletonLayout } from 'eseller-shared';

interface WithdrawalRequest {
  id: string;
  amount: number;
  paymentMethod: string;
  accountDetails: string;
  status: string;
  requestedAt: string;
  processedAt?: string | null;
}

interface WithdrawalPaymentMethod {
  id: string;
  name: string;
  details: string;
  isActive: boolean;
}

@Component({
  selector: 'app-withdrawal-list',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
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
  readonly minimumWithdrawal = signal<number>(1000);

  readonly platformPaymentMethods = signal<WithdrawalPaymentMethod[]>([]);
  readonly requestModalOpen = signal<boolean>(false);
  readonly withdrawAmount = signal<number>(1000);
  readonly selectedPaymentMethodId = signal<string>('');
  readonly accountTitle = signal<string>('');
  readonly accountNumber = signal<string>('');
  readonly bankName = signal<string>('');
  readonly isSubmitting = signal<boolean>(false);

  ngOnInit(): void {
    this.loadPaymentMethods();
    this.loadData();
  }

  loadPaymentMethods(): void {
    this.sellerSvc.getWithdrawalPaymentMethods().subscribe({
      next: (methods) => {
        this.platformPaymentMethods.set(methods || []);
        if (methods?.length && !this.selectedPaymentMethodId()) {
          this.selectedPaymentMethodId.set(methods[0].id);
        }
      },
      error: () => this.platformPaymentMethods.set([])
    });
  }

  selectedPlatformMethod(): WithdrawalPaymentMethod | null {
    const id = this.selectedPaymentMethodId();
    return this.platformPaymentMethods().find(m => m.id === id) ?? null;
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
            const min = Number(sum.minimumWithdrawal);
            this.minimumWithdrawal.set(Number.isFinite(min) && min > 0 ? min : 1000);
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
    const min = this.minimumWithdrawal();
    const bal = this.availableBalance() || 0;
    this.withdrawAmount.set(Math.max(min, Math.min(bal || min, bal || min)));
    this.accountTitle.set(this.shop()?.name || '');
    const methods = this.platformPaymentMethods();
    if (methods.length && !methods.some(m => m.id === this.selectedPaymentMethodId())) {
      this.selectedPaymentMethodId.set(methods[0].id);
    }
    this.requestModalOpen.set(true);
  }

  closeRequestModal(): void {
    this.requestModalOpen.set(false);
  }

  submitWithdrawal(): void {
    const amount = Number(this.withdrawAmount());
    const balance = this.availableBalance();
    const min = this.minimumWithdrawal();

    if (amount < min) {
      this.toast.show(`Minimum withdrawal amount is $ ${min}`, 'error');
      return;
    }

    if (amount > balance) {
      this.toast.show('Requested amount exceeds available balance', 'error');
      return;
    }

    const platformMethod = this.selectedPlatformMethod();
    if (!platformMethod) {
      this.toast.show('Select a platform payout method configured by Super Admin.', 'error');
      return;
    }

    if (!this.accountNumber().trim()) {
      this.toast.show('Please provide your bank or mobile wallet account number', 'error');
      return;
    }

    this.isSubmitting.set(true);
    const sellerDest = `${this.accountTitle()} - ${this.accountNumber()} (${this.bankName().trim() || 'Bank'})`;
    const details = `${sellerDest} | Pay to: ${platformMethod.details}`;

    this.sellerSvc
      .requestWithdrawal({
        amount,
        payoutMethod: platformMethod.name,
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
            err?.error?.error ||
            (typeof err?.error === 'string' ? err.error : '') ||
            err?.message ||
            'Failed to submit withdrawal request.';
          this.toast.show(msg, 'error');
        }
      });
  }
}
