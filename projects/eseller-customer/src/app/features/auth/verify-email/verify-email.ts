import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService, AuthStore, ToastService } from 'eseller-shared';

@Component({
  selector: 'app-verify-email',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.css'
})
export class VerifyEmail implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);

  readonly email = signal<string>('');
  readonly code = signal<string>('');
  readonly isSubmitting = signal<boolean>(false);
  readonly isResending = signal<boolean>(false);
  readonly resendCooldown = signal<number>(0);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly isVerified = signal<boolean>(false);

  private cooldownTimer: any = null;

  ngOnInit(): void {
    const qEmail = this.route.snapshot.queryParamMap.get('email');
    const qCode = this.route.snapshot.queryParamMap.get('code');

    if (qEmail) {
      this.email.set(qEmail);
    } else if (this.authStore.isAuthenticated()) {
      const user = this.authStore.currentAccount();
      if (user?.email) {
        this.email.set(user.email);
      }
    }

    if (qCode) {
      this.code.set(qCode);
      if (this.email()) {
        this.onVerify();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }
  }

  onVerify(): void {
    const targetEmail = this.email().trim();
    const targetCode = this.code().trim();

    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (!targetEmail || !targetEmail.includes('@')) {
      this.errorMessage.set('Please enter a valid email address.');
      return;
    }

    if (!targetCode || targetCode.length < 4) {
      this.errorMessage.set('Please enter the 6-digit verification code.');
      return;
    }

    this.isSubmitting.set(true);

    this.authService.verifyEmail({ email: targetEmail, code: targetCode }).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.isVerified.set(true);
        this.successMessage.set(res.message || 'Email verified successfully!');
        this.toastService.show('Email verified successfully!', 'success');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg = err?.error?.error || 'Invalid or expired verification code. Please check and try again.';
        this.errorMessage.set(msg);
        this.toastService.show(msg, 'error');
      }
    });
  }

  onResend(): void {
    const targetEmail = this.email().trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      this.errorMessage.set('Please provide a valid email to resend code.');
      return;
    }

    if (this.resendCooldown() > 0) return;

    this.isResending.set(true);
    this.errorMessage.set(null);

    this.authService.resendVerificationEmail({ email: targetEmail }).subscribe({
      next: (res) => {
        this.isResending.set(false);
        this.toastService.show(res.message || 'Verification email sent.', 'success');
        this.startCooldown(60);
      },
      error: (err) => {
        this.isResending.set(false);
        const msg = err?.error?.error || 'Failed to resend verification email. Please try again.';
        this.errorMessage.set(msg);
      }
    });
  }

  private startCooldown(seconds: number): void {
    this.resendCooldown.set(seconds);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);

    this.cooldownTimer = setInterval(() => {
      const current = this.resendCooldown();
      if (current <= 1) {
        clearInterval(this.cooldownTimer);
        this.resendCooldown.set(0);
      } else {
        this.resendCooldown.set(current - 1);
      }
    }, 1000);
  }

  continueToDashboard(): void {
    if (this.authStore.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/auth/login'], { queryParams: { email: this.email() } });
    }
  }
}
