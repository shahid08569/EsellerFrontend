import { Component, OnInit, inject, signal, computed } from '@angular/core';
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
  readonly minimumWithdrawal = signal<number>(100);

  readonly bankModalOpen = signal<boolean>(false);
  readonly isSavingBank = signal<boolean>(false);
  readonly isSubmittingWithdraw = signal<boolean>(false);
  readonly hasSavedBank = signal<boolean>(false);
  readonly savedMasked = signal<string>('');

  readonly bankName = signal<string>('');
  readonly cardHolderName = signal<string>('');
  readonly cardNumber = signal<string>('');
  readonly expMonth = signal<string>('');
  readonly expYear = signal<string>('');
  readonly cvc = signal<string>('');
  readonly withdrawAmount = signal<number>(100);

  readonly cardPreview = computed(() => {
    const raw = this.cardNumber().replace(/\D/g, '').slice(0, 16);
    const groups: string[] = raw.match(/.{1,4}/g) ?? [];
    while (groups.length < 4) groups.push('••••');
    return groups
      .map((g, i) => (raw.length > i * 4 ? g.padEnd(4, '•') : '••••'))
      .join('  ');
  });

  readonly expPreview = computed(() => {
    const m = this.expMonth().padStart(2, '0').slice(0, 2) || 'MM';
    const y = this.expYear().slice(-2) || 'YY';
    return `${m}/${y}`;
  });

  ngOnInit(): void {
    this.loadData();
    this.loadBankDetails();
  }

  loadBankDetails(): void {
    this.sellerSvc.getBankDetails().subscribe({
      next: (d) => {
        if (d?.cardNumberLast4) {
          this.hasSavedBank.set(true);
          this.savedMasked.set(d.cardNumberMasked || `•••• •••• •••• ${d.cardNumberLast4}`);
          this.bankName.set(d.bankName || '');
          this.cardHolderName.set(d.cardHolderName || '');
          if (d.expMonth) this.expMonth.set(String(d.expMonth).padStart(2, '0'));
          if (d.expYear) this.expYear.set(String(d.expYear));
        } else {
          this.hasSavedBank.set(false);
          this.savedMasked.set('');
        }
      },
      error: () => this.hasSavedBank.set(false)
    });
  }

  loadData(): void {
    this.isLoading.set(true);
    this.sellerSvc.getMyShop().subscribe({
      next: (s) => {
        this.shop.set(s);
        if (!this.cardHolderName()) this.cardHolderName.set(s?.name || '');
        this.sellerSvc.getWalletSummary().subscribe({
          next: (sum) => {
            this.availableBalance.set(Number(sum.availableToWithdraw) || 0);
            this.pendingEarnings.set(Number(sum.pendingEarnings) || 0);
            const min = Number(sum.minimumWithdrawal);
            this.minimumWithdrawal.set(Number.isFinite(min) && min > 0 ? min : 100);
            this.sellerSvc.getWithdrawals(1, 50).subscribe({
              next: (res: any) => {
                const items = Array.isArray(res) ? res : res?.items || [];
                this.withdrawalHistory.set(
                  items.map((w: any) => {
                    const raw = String(w.payoutMethod || 'Bank Card');
                    const parts = raw.split(' | ');
                    return {
                      id: w.id,
                      amount: w.amount,
                      paymentMethod: parts[0] || 'Bank Card',
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

  openBankModal(): void {
    const min = this.minimumWithdrawal();
    const bal = this.availableBalance() || 0;
    this.withdrawAmount.set(Math.max(min, Math.min(bal || min, bal || min)));
    if (!this.cardHolderName()) this.cardHolderName.set(this.shop()?.name || '');
    this.cardNumber.set('');
    this.cvc.set('');
    this.bankModalOpen.set(true);
  }

  closeBankModal(): void {
    if (this.isSavingBank() || this.isSubmittingWithdraw()) return;
    this.bankModalOpen.set(false);
  }

  onCardNumberInput(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    const groups = digits.match(/.{1,4}/g);
    this.cardNumber.set(groups ? groups.join(' ') : digits);
  }

  private validateBankFields(): boolean {
    const bank = this.bankName().trim();
    const holder = this.cardHolderName().trim();
    const pan = this.cardNumber().replace(/\D/g, '');
    const month = Number(this.expMonth());
    const year = Number(this.expYear());
    const cvc = this.cvc().replace(/\D/g, '');

    if (!bank) {
      this.toast.show('Bank name is required.', 'error');
      return false;
    }
    if (!holder) {
      this.toast.show('Card holder name is required.', 'error');
      return false;
    }
    if (pan.length < 13 || pan.length > 19) {
      this.toast.show('Enter a valid card number (13–19 digits).', 'error');
      return false;
    }
    if (!month || month < 1 || month > 12) {
      this.toast.show('Enter a valid expiry month (01–12).', 'error');
      return false;
    }
    const y = year < 100 ? 2000 + year : year;
    if (!y || y < new Date().getFullYear()) {
      this.toast.show('Enter a valid expiry year.', 'error');
      return false;
    }
    if (cvc.length < 3 || cvc.length > 4) {
      this.toast.show('Enter a valid CVC (3–4 digits).', 'error');
      return false;
    }
    return true;
  }

  saveBankOnly(): void {
    if (!this.validateBankFields()) return;
    this.isSavingBank.set(true);
    const pan = this.cardNumber().replace(/\D/g, '');
    const year = Number(this.expYear());
    this.sellerSvc
      .saveBankDetails({
        bankName: this.bankName().trim(),
        cardHolderName: this.cardHolderName().trim(),
        cardNumber: pan,
        expMonth: Number(this.expMonth()),
        expYear: year < 100 ? 2000 + year : year,
        cvc: this.cvc().replace(/\D/g, '')
      })
      .subscribe({
        next: () => {
          this.isSavingBank.set(false);
          this.toast.show('Bank details saved successfully.', 'success');
          this.loadBankDetails();
          this.cardNumber.set('');
          this.cvc.set('');
        },
        error: (err) => {
          this.isSavingBank.set(false);
          this.toast.show(err?.error?.error || 'Failed to save bank details.', 'error');
        }
      });
  }

  submitWithdrawWithBank(): void {
    if (!this.validateBankFields()) return;

    const amount = Number(this.withdrawAmount());
    const balance = this.availableBalance();
    const min = this.minimumWithdrawal();

    if (amount < min) {
      this.toast.show(`Minimum withdrawal amount is $ ${min}`, 'error');
      return;
    }
    if (amount > balance) {
      this.toast.show('Requested amount exceeds available balance.', 'error');
      return;
    }

    const pan = this.cardNumber().replace(/\D/g, '');
    const year = Number(this.expYear());
    const expYear = year < 100 ? 2000 + year : year;

    this.isSubmittingWithdraw.set(true);
    this.sellerSvc
      .saveBankDetails({
        bankName: this.bankName().trim(),
        cardHolderName: this.cardHolderName().trim(),
        cardNumber: pan,
        expMonth: Number(this.expMonth()),
        expYear,
        cvc: this.cvc().replace(/\D/g, '')
      })
      .subscribe({
        next: () => {
          const last4 = pan.slice(-4);
          const details = `${this.cardHolderName().trim()} · ${this.bankName().trim()} · ****${last4} · Exp ${String(this.expMonth()).padStart(2, '0')}/${expYear}`;
          this.sellerSvc
            .requestWithdrawal({
              amount,
              payoutMethod: 'Bank Card',
              accountDetails: details
            })
            .subscribe({
              next: () => {
                this.isSubmittingWithdraw.set(false);
                this.toast.show(`Withdrawal request of $ ${amount} submitted.`, 'success');
                this.bankModalOpen.set(false);
                this.cardNumber.set('');
                this.cvc.set('');
                this.loadBankDetails();
                this.loadData();
              },
              error: (err) => {
                this.isSubmittingWithdraw.set(false);
                this.toast.show(err?.error?.error || 'Bank saved, but withdrawal request failed.', 'error');
                this.loadBankDetails();
              }
            });
        },
        error: (err) => {
          this.isSubmittingWithdraw.set(false);
          this.toast.show(err?.error?.error || 'Failed to save bank details.', 'error');
        }
      });
  }
}
