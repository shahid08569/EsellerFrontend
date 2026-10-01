import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService, AuthStore, ToastService } from 'eseller-shared';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  private readonly authService = inject(AuthService);
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);

  // Form inputs
  readonly usernameOrEmail = signal<string>('');
  readonly password = signal<string>('');
  readonly rememberMe = signal<boolean>(true);
  readonly showPassword = signal<boolean>(false);

  // State signals
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successBanner = signal<string | null>(null);

  // Field errors
  readonly emailError = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);

  // Forgot password modal state
  readonly forgotModalOpen = signal<boolean>(false);
  readonly forgotStep = signal<'request' | 'reset' | 'success'>('request');
  readonly forgotEmail = signal<string>('');
  readonly forgotCode = signal<string>('');
  readonly forgotNewPassword = signal<string>('');
  readonly forgotConfirmPassword = signal<string>('');
  readonly forgotShowPassword = signal<boolean>(false);
  readonly forgotSubmitting = signal<boolean>(false);
  readonly forgotSuccessMsg = signal<string | null>(null);
  readonly forgotErrorMsg = signal<string | null>(null);

  private returnUrl: string = '/dashboard';

  ngOnInit(): void {
    // If already authenticated, redirect to dashboard
    if (this.authStore.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Capture returnUrl
    const rUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (rUrl && rUrl !== '/auth/login') {
      this.returnUrl = rUrl;
    }

    // Check if redirected after successful registration
    const registered = this.route.snapshot.queryParamMap.get('registered');
    const prefillEmail = this.route.snapshot.queryParamMap.get('email');
    if (registered === 'true') {
      this.successBanner.set('Registration successful! Please sign in with your password.');
    }
    if (prefillEmail) {
      this.usernameOrEmail.set(prefillEmail);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      const savedEmail = window.localStorage.getItem('eseller_remember_email');
      if (savedEmail) {
        this.usernameOrEmail.set(savedEmail);
      }
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  onSubmit(): void {
    this.errorMessage.set(null);
    this.emailError.set(null);
    this.passwordError.set(null);

    const valEmail = this.usernameOrEmail().trim();
    const valPassword = this.password().trim();

    let hasErrors = false;
    if (!valEmail) {
      this.emailError.set('Please enter your email or username.');
      hasErrors = true;
    }

    if (!valPassword) {
      this.passwordError.set('Please enter your password.');
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    this.isSubmitting.set(true);

    this.authService.login({
      usernameOrEmail: valEmail,
      password: valPassword
    }).subscribe({
      next: (res) => {
        // Handle remember me
        if (typeof window !== 'undefined' && window.localStorage) {
          if (this.rememberMe()) {
            window.localStorage.setItem('eseller_remember_email', valEmail);
          } else {
            window.localStorage.removeItem('eseller_remember_email');
          }
        }

        // Set Auth Store
        this.authStore.setAuth({
          accessToken: res.accessToken,
          accessTokenExpiresAt: res.accessTokenExpiresAt,
          account: {
            accountId: res.accountId,
            username: res.username,
            email: res.email,
            roleType: res.roleType
          }
        });

        this.toastService.show(
          `Welcome back, ${res.username || 'Merchant'}! Signed in successfully.`,
          'success'
        );

        this.isSubmitting.set(false);
        
        if (res.roleType === 'Shopkeeper') {
          if (typeof window !== 'undefined') {
            // Encode auth handoff in URL hash (hash never sent to server, more secure)
            const handoff = btoa(JSON.stringify({
              accessToken: res.accessToken,
              accessTokenExpiresAt: res.accessTokenExpiresAt,
              accountId: res.accountId,
              username: res.username,
              email: res.email,
              roleType: res.roleType
            }));
            window.location.href = `http://localhost:54007/dashboard#auth=${handoff}`;
          }
        } else {
          this.router.navigateByUrl(this.returnUrl);
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const code = err?.error?.errorCode || err?.error || '';
        let message = 'Unable to sign in. Please verify your credentials and try again.';

        if (code === 'INVALID_CREDENTIALS') {
          message = 'Invalid email/username or password. Please try again.';
        } else if (code === 'ACCOUNT_INACTIVE') {
          message = 'Your account has been deactivated. Please contact platform support.';
        } else if (code === 'LOCATION_REQUIRED') {
          message = 'Location authorization is required for account security.';
        } else if (err?.message && !err?.message.includes('Http failure')) {
          message = err.message;
        }

        this.errorMessage.set(message);
        this.toastService.show(message, 'error');
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // FORGOT & RESET PASSWORD 2-STEP MODAL HELPERS
  // ─────────────────────────────────────────────────────────────
  openForgotPassword(): void {
    this.forgotEmail.set(this.usernameOrEmail().trim());
    this.forgotCode.set('');
    this.forgotNewPassword.set('');
    this.forgotConfirmPassword.set('');
    this.forgotStep.set('request');
    this.forgotSuccessMsg.set(null);
    this.forgotErrorMsg.set(null);
    this.forgotModalOpen.set(true);
  }

  closeForgotPassword(): void {
    this.forgotModalOpen.set(false);
  }

  toggleForgotShowPassword(): void {
    this.forgotShowPassword.update((v) => !v);
  }

  onSendResetCode(): void {
    const email = this.forgotEmail().trim();
    if (!email || !email.includes('@')) {
      this.forgotErrorMsg.set('Please enter a valid email address.');
      return;
    }

    this.forgotSubmitting.set(true);
    this.forgotErrorMsg.set(null);
    this.forgotSuccessMsg.set(null);

    this.authService.forgotPassword({ email }).subscribe({
      next: () => {
        this.forgotSubmitting.set(false);
        this.forgotStep.set('reset');
        this.forgotSuccessMsg.set(`A 6-digit reset code has been sent to ${email}.`);
        this.toastService.show('Reset code sent to your email.', 'success');
      },
      error: () => {
        this.forgotSubmitting.set(false);
        // For privacy, still move to reset step
        this.forgotStep.set('reset');
        this.forgotSuccessMsg.set(`If an account exists with ${email}, a 6-digit code has been sent.`);
      }
    });
  }

  onResetPasswordSubmit(): void {
    const email = this.forgotEmail().trim();
    const code = this.forgotCode().trim();
    const newPassword = this.forgotNewPassword().trim();
    const confirmPassword = this.forgotConfirmPassword().trim();

    this.forgotErrorMsg.set(null);

    if (!code || code.length < 4) {
      this.forgotErrorMsg.set('Please enter the 6-digit verification code.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      this.forgotErrorMsg.set('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.forgotErrorMsg.set('Passwords do not match.');
      return;
    }

    this.forgotSubmitting.set(true);

    this.authService.resetPassword({ email, code, newPassword }).subscribe({
      next: () => {
        this.forgotSubmitting.set(false);
        this.forgotStep.set('success');
        this.usernameOrEmail.set(email);
        this.toastService.show('Password reset successfully! Please sign in.', 'success');
      },
      error: (err) => {
        this.forgotSubmitting.set(false);
        const msg = err?.error?.error || 'Invalid or expired verification code. Please check and try again.';
        this.forgotErrorMsg.set(msg);
        this.toastService.show(msg, 'error');
      }
    });
  }
}