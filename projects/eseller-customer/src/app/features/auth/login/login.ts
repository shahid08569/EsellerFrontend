import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService, AuthStore, ToastService, safeEncodeHandoff, sanitizeAppPath } from 'eseller-shared';
import { environment } from '../../../../environments/environment';

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
    const isLogout = this.route.snapshot.queryParamMap.get('logout') === 'true' ||
                     (typeof window !== 'undefined' && window.location.search.includes('logout=true'));
    if (isLogout) {
      this.authStore.clearAuth();
      this.toastService.show('You have been signed out successfully.', 'info');
      try {
        window.history.replaceState(null, '', '/auth/login');
      } catch {}
      return;
    }

    // If already authenticated, check expiry and redirect with handoff token
    if (this.authStore.isAuthenticated()) {
      const token = this.authStore.accessToken();
      const expiresAt = this.authStore.accessTokenExpiresAt();
      const isExpired = !token || (expiresAt ? expiresAt.getTime() <= Date.now() : false);

      if (isExpired) {
        // Token expired, clear it so user can cleanly sign in again
        this.authStore.clearAuth();
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('eseller_auth_session');
        }
      } else {
        const role = this.authStore.currentAccount()?.roleType;
        const account = this.authStore.currentAccount()!;
        const handoff = safeEncodeHandoff({
          accessToken: token,
          accessTokenExpiresAt: expiresAt?.toISOString() || new Date(Date.now() + 3600000).toISOString(),
          accountId: account.accountId,
          username: account.username,
          email: account.email,
          roleType: role
        });

        if (role === 'Shopkeeper') {
          if (typeof window !== 'undefined') {
            window.location.href = this.portalHandoffUrl(environment.sellerUrl, handoff);
            return;
          }
        }
        if (role === 'SuperAdmin' || role === 'Partner') {
          if (typeof window !== 'undefined') {
            window.location.href = this.portalHandoffUrl(environment.adminUrl, handoff);
            return;
          }
        }
        this.router.navigate(['/dashboard']);
        return;
      }
    }

    // Capture returnUrl (same-origin relative paths only)
    const rUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const safeReturn = sanitizeAppPath(rUrl);
    if (safeReturn && safeReturn !== '/auth/login') {
      this.returnUrl = safeReturn;
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
    // Do not trim password — must match exactly what was registered
    const valPassword = this.password();

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
            const handoff = safeEncodeHandoff({
              accessToken: res.accessToken,
              accessTokenExpiresAt: res.accessTokenExpiresAt,
              accountId: res.accountId,
              username: res.username,
              email: res.email,
              roleType: res.roleType
            });
            window.location.href = this.portalHandoffUrl(environment.sellerUrl, handoff);
          }
        } else if (res.roleType === 'SuperAdmin' || res.roleType === 'Partner') {
          if (typeof window !== 'undefined') {
            const handoff = safeEncodeHandoff({
              accessToken: res.accessToken,
              accessTokenExpiresAt: res.accessTokenExpiresAt,
              accountId: res.accountId,
              username: res.username,
              email: res.email,
              roleType: res.roleType
            });
            window.location.href = this.portalHandoffUrl(environment.adminUrl, handoff);
          }
        } else {
          this.router.navigateByUrl(this.returnUrl);
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const code = err?.errorCode || err?.error?.errorCode || (typeof err?.error === 'string' ? err.error : '') || '';
        const errMsg = (typeof err?.error === 'string' ? err.error : '') || err?.error?.error || err?.message || '';
        let message = 'Unable to sign in. Please try again.';

        if (
          code === 'TIMEOUT' ||
          String(errMsg).toLowerCase().includes('timed out') ||
          String(errMsg).toLowerCase().includes('timeout')
        ) {
          message = 'Server was slow or restarting. Please try Sign In again.';
        } else if (
          code === 'HTTP_503' ||
          String(errMsg).toLowerCase().includes('updating eseller')
        ) {
          message = 'API is updating right now. Wait ~30 seconds and try again.';
        } else if (
          code === 'HTTP_0' ||
          code === 'HTTP_undefined' ||
          String(errMsg).toLowerCase().includes('http failure') ||
          String(errMsg).toLowerCase().includes('failed to fetch') ||
          String(errMsg).toLowerCase().includes('unknown error')
        ) {
          message = environment.production
            ? 'Cannot reach API right now. Please wait a moment and try again.'
            : 'Cannot reach API. Start the backend (https://localhost:7127) then try again.';
        } else if (code === 'INVALID_CREDENTIALS' || errMsg.toLowerCase().includes('invalid credentials')) {
          message = 'Invalid email/username or password. Please try again.';
        } else if (code === 'ACCOUNT_INACTIVE' || errMsg.toLowerCase().includes('inactive')) {
          message = 'Your account has been deactivated. Please contact platform support.';
        } else if (code === 'LOCATION_REQUIRED' || errMsg.toLowerCase().includes('location')) {
          message = 'Location authorization is required for account security.';
        } else if (errMsg && typeof errMsg === 'string' && !errMsg.includes('Http failure')) {
          message = errMsg;
        }

        this.errorMessage.set(message);
        this.toastService.show(message, 'error');
      }
    });
  }

  /** Admin/seller handoff URL; prefers returnUrl when it already targets that portal. */
  private portalHandoffUrl(portalBase: string, handoff: string): string {
    const base = portalBase.replace(/\/$/, '');
    let dest = `${base}/dashboard`;
    const ret = this.returnUrl?.trim();
    if (ret?.startsWith(base)) {
      try {
        const u = new URL(ret);
        dest = u.pathname && u.pathname !== '/' ? `${u.origin}${u.pathname}${u.search}` : dest;
      } catch {
        /* keep dashboard */
      }
    }
    return `${dest}#auth=${encodeURIComponent(handoff)}`;
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
        const msg =
          (typeof err?.error === 'string' ? err.error : '') ||
          err?.message ||
          'Invalid or expired verification code. Please check and try again.';
        this.forgotErrorMsg.set(msg);
        this.toastService.show(msg, 'error');
      }
    });
  }
}