import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AuthStore,
  AuthService,
  DashboardService,
  ToastService,
  UserProfileDto
} from 'eseller-shared';

@Component({
  selector: 'app-seller-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './seller-profile.html'
})
export class SellerProfile implements OnInit, OnDestroy {
  readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly toast = inject(ToastService);

  readonly username = signal<string>('');
  readonly email = signal<string>('');
  readonly phone = signal<string>('');
  readonly isPhoneVerified = signal<boolean>(false);
  readonly isLoadingProfile = signal<boolean>(true);
  readonly isSavingProfile = signal<boolean>(false);
  readonly profileError = signal<string | null>(null);

  // Phone OTP
  readonly otpCode = signal<string>('');
  readonly otpSent = signal<boolean>(false);
  readonly debugOtp = signal<string | null>(null);
  readonly isSendingOtp = signal<boolean>(false);
  readonly isVerifyingOtp = signal<boolean>(false);
  readonly otpError = signal<string | null>(null);
  readonly resendCooldown = signal<number>(0);
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  // Password change
  readonly currentPassword = signal<string>('');
  readonly newPassword = signal<string>('');
  readonly confirmPassword = signal<string>('');
  readonly isChangingPassword = signal<boolean>(false);

  ngOnInit(): void {
    const acc = this.authStore.currentAccount();
    if (acc) {
      this.username.set(acc.username || '');
      this.email.set(acc.email || '');
    }
    this.loadProfile();
  }

  ngOnDestroy(): void {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
  }

  loadProfile(): void {
    this.isLoadingProfile.set(true);
    this.dashboardService.getProfile().subscribe({
      next: (prof: UserProfileDto) => {
        this.applyProfile(prof);
        this.isLoadingProfile.set(false);
      },
      error: () => {
        this.isLoadingProfile.set(false);
        this.toast.show('Could not load profile. Showing session data.', 'warning');
      }
    });
  }

  private applyProfile(prof: UserProfileDto): void {
    this.username.set(prof.name || '');
    this.email.set(prof.email || '');
    this.phone.set(prof.phone || '');
    this.isPhoneVerified.set(!!prof.isPhoneVerified);
    if (prof.isPhoneVerified) {
      this.otpSent.set(false);
      this.otpCode.set('');
    }
  }

  saveProfile(): void {
    this.profileError.set(null);
    const name = this.username().trim();
    const phone = this.phone().trim();

    if (!name || name.length < 2) {
      this.profileError.set('Name must be at least 2 characters.');
      return;
    }

    this.isSavingProfile.set(true);
    this.dashboardService
      .updateProfile({ name, phone: phone || null })
      .subscribe({
        next: () => {
          this.isSavingProfile.set(false);
          this.isPhoneVerified.set(false);
          this.otpSent.set(false);
          this.otpCode.set('');
          this.toast.show('Profile updated. Verify your phone if it changed.', 'success');
          this.loadProfile();
        },
        error: (err) => {
          this.isSavingProfile.set(false);
          const msg = err?.error?.error || 'Failed to update profile.';
          this.profileError.set(msg);
          this.toast.show(msg, 'error');
        }
      });
  }

  sendPhoneOtp(): void {
    this.otpError.set(null);
    const targetEmail = this.email().trim();
    const phone = this.phone().trim();

    if (!targetEmail) {
      this.otpError.set('Account email is missing.');
      return;
    }
    if (!phone) {
      this.otpError.set('Save a phone number first, then request OTP.');
      return;
    }
    if (this.resendCooldown() > 0 || this.isSendingOtp()) return;

    this.isSendingOtp.set(true);
    this.debugOtp.set(null);
    this.authService.sendPhoneOtp({ email: targetEmail }).subscribe({
      next: (res) => {
        this.isSendingOtp.set(false);
        this.otpSent.set(true);
        if (res.debugOtp) {
          this.debugOtp.set(res.debugOtp);
          this.otpCode.set(res.debugOtp);
        }
        this.toast.show(res.message || 'OTP sent. Check your email inbox.', 'success');
        this.startCooldown(60);
      },
      error: (err) => {
        this.isSendingOtp.set(false);
        const msg = err?.error?.error || 'Failed to send OTP. Save phone first, then retry.';
        this.otpError.set(msg);
        this.toast.show(msg, 'error');
      }
    });
  }

  verifyPhoneOtp(): void {
    this.otpError.set(null);
    const targetEmail = this.email().trim();
    const code = this.otpCode().trim();

    if (!targetEmail) {
      this.otpError.set('Account email is missing.');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      this.otpError.set('Enter the 6-digit OTP code.');
      return;
    }

    this.isVerifyingOtp.set(true);
    this.authService.verifyPhoneOtp({ email: targetEmail, code }).subscribe({
      next: (res) => {
        this.isVerifyingOtp.set(false);
        this.isPhoneVerified.set(true);
        this.otpSent.set(false);
        this.otpCode.set('');
        this.debugOtp.set(null);
        this.toast.show(res.message || 'Phone verified successfully!', 'success');
        this.loadProfile();
      },
      error: (err) => {
        this.isVerifyingOtp.set(false);
        const msg = err?.error?.error || 'Invalid or expired OTP.';
        this.otpError.set(msg);
        this.toast.show(msg, 'error');
      }
    });
  }

  changePassword(): void {
    const cur = this.currentPassword().trim();
    const next = this.newPassword().trim();
    const conf = this.confirmPassword().trim();

    if (!cur || !next || !conf) {
      this.toast.show('Please fill in all password fields.', 'error');
      return;
    }
    if (next !== conf) {
      this.toast.show('New password and confirmation do not match.', 'error');
      return;
    }
    if (next.length < 6) {
      this.toast.show('Password must be at least 6 characters.', 'error');
      return;
    }

    this.isChangingPassword.set(true);
    this.authService.changePassword({ currentPassword: cur, newPassword: next }).subscribe({
      next: (res) => {
        this.isChangingPassword.set(false);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.toast.show(res.message || 'Password changed successfully!', 'success');
      },
      error: (err) => {
        this.isChangingPassword.set(false);
        this.toast.show(err?.error?.error || 'Failed to update password.', 'error');
      }
    });
  }

  private startCooldown(seconds: number): void {
    this.resendCooldown.set(seconds);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      const current = this.resendCooldown();
      if (current <= 1) {
        if (this.cooldownTimer) clearInterval(this.cooldownTimer);
        this.resendCooldown.set(0);
      } else {
        this.resendCooldown.set(current - 1);
      }
    }, 1000);
  }
}
