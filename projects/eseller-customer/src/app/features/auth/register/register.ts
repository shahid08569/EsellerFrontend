import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService, AuthStore, ToastService } from 'eseller-shared';

@Component({
  selector: 'app-register',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register implements OnInit {
  private readonly authService = inject(AuthService);
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);

  // Form signals
  readonly name = signal<string>('');
  readonly email = signal<string>('');
  readonly phone = signal<string>('');
  readonly selectedDialCode = signal<string>('+1');
  readonly password = signal<string>('');
  readonly confirmPassword = signal<string>('');
  readonly agreeToTerms = signal<boolean>(true);

  // Visibility toggles
  readonly showPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);

  // State signals
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // Field-level error signals
  readonly nameError = signal<string | null>(null);
  readonly emailError = signal<string | null>(null);
  readonly phoneError = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);
  readonly confirmPasswordError = signal<string | null>(null);
  readonly termsError = signal<string | null>(null);

  // Real-time password criteria computeds
  readonly hasMinLength = computed(() => this.password().length >= 8);
  readonly hasUpperCase = computed(() => /[A-Z]/.test(this.password()));
  readonly hasLowerCase = computed(() => /[a-z]/.test(this.password()));
  readonly hasNumber = computed(() => /[0-9]/.test(this.password()));
  readonly hasSpecial = computed(() => /[^a-zA-Z0-9]/.test(this.password()));

  readonly isPasswordFullyValid = computed(
    () =>
      this.hasMinLength() &&
      this.hasUpperCase() &&
      this.hasLowerCase() &&
      this.hasNumber() &&
      this.hasSpecial()
  );

  readonly passwordScore = computed(() => {
    let score = 0;
    if (this.hasMinLength()) score++;
    if (this.hasUpperCase()) score++;
    if (this.hasLowerCase()) score++;
    if (this.hasNumber()) score++;
    if (this.hasSpecial()) score++;
    return score;
  });

  readonly countryCodes = [
    { label: '🇺🇸 USA (+1)', code: '+1', placeholder: '(555) 123-4567' },
    { label: '🇵🇰 Pakistan (+92)', code: '+92', placeholder: '300 1234567' },
    { label: '🇦🇪 UAE (+971)', code: '+971', placeholder: '50 123 4567' },
    { label: '🇸🇦 Saudi Arabia (+966)', code: '+966', placeholder: '50 123 4567' },
    { label: '🇬🇧 UK (+44)', code: '+44', placeholder: '7911 123456' }
  ];

  readonly currentPlaceholder = computed(() => {
    const found = this.countryCodes.find((c) => c.code === this.selectedDialCode());
    return found ? found.placeholder : 'Enter phone number';
  });

  ngOnInit(): void {
    if (this.authStore.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  onSubmit(): void {
    this.errorMessage.set(null);
    this.nameError.set(null);
    this.emailError.set(null);
    this.phoneError.set(null);
    this.passwordError.set(null);
    this.confirmPasswordError.set(null);
    this.termsError.set(null);

    const valName = this.name().trim();
    const valEmail = this.email().trim();
    const rawPhone = this.phone().trim();
    const valPassword = this.password().trim();
    const valConfirm = this.confirmPassword().trim();

    let hasErrors = false;

    if (!valName || valName.length < 2) {
      this.nameError.set('Please provide your full name (minimum 2 characters).');
      hasErrors = true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!valEmail || !emailRegex.test(valEmail)) {
      this.emailError.set('Please enter a valid email address.');
      hasErrors = true;
    }

    if (!rawPhone || rawPhone.length < 7) {
      this.phoneError.set('Please enter a valid mobile number for parcel delivery.');
      hasErrors = true;
    }

    if (!this.isPasswordFullyValid()) {
      this.passwordError.set('Password must fulfill all security criteria below.');
      hasErrors = true;
    }

    if (valPassword !== valConfirm) {
      this.confirmPasswordError.set('Passwords do not match. Please verify.');
      hasErrors = true;
    }

    if (!this.agreeToTerms()) {
      this.termsError.set('You must accept the Terms of Service to create an account.');
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    this.isSubmitting.set(true);

    const fullPhone = rawPhone.startsWith('+')
      ? rawPhone
      : `${this.selectedDialCode()} ${rawPhone}`;

    this.authService
      .registerCustomer({
        name: valName,
        email: valEmail.toLowerCase(),
        phone: fullPhone,
        password: valPassword
      })
      .subscribe({
        next: (registerRes) => {
          this.toastService.show('Account created! Signing you in...', 'success');

          // Auto-login newly registered customer
          this.authService
            .login({
              usernameOrEmail: valEmail,
              password: valPassword
            })
            .subscribe({
              next: (loginRes) => {
                this.authStore.setAuth({
                  accessToken: loginRes.accessToken,
                  accessTokenExpiresAt: loginRes.accessTokenExpiresAt,
                  account: {
                    accountId: loginRes.accountId,
                    username: loginRes.username,
                    email: loginRes.email,
                    roleType: loginRes.roleType
                  }
                });

                this.toastService.show(
                  `Welcome to Eseller, ${registerRes.name || valName}! Your account is ready.`,
                  'success'
                );

                this.isSubmitting.set(false);
                this.router.navigate(['/dashboard']);
              },
              error: () => {
                // If auto-login fails, redirect to login page with pre-filled email
                this.isSubmitting.set(false);
                this.router.navigate(['/auth/login'], {
                  queryParams: {
                    email: valEmail,
                    registered: 'true'
                  }
                });
              }
            });
        },
        error: (err) => {
          this.isSubmitting.set(false);
          // ApiService/errorInterceptor already normalises to { error, errorCode, errors? }
          const code = err?.errorCode || '';
          const fieldErrors = err?.errors as Record<string, string[]> | undefined;

          if (fieldErrors) {
            const map: Record<string, (msg: string) => void> = {
              name: (m) => this.nameError.set(m),
              email: (m) => this.emailError.set(m),
              phone: (m) => this.phoneError.set(m),
              password: (m) => this.passwordError.set(m),
              confirmpassword: (m) => this.confirmPasswordError.set(m)
            };
            for (const [key, msgs] of Object.entries(fieldErrors)) {
              const msg = msgs?.[0];
              if (!msg) continue;
              const setter = map[key.toLowerCase()];
              if (setter) setter(msg);
            }
          }

          let message = err?.error || 'Registration could not be completed. Please check your details.';

          if (code === 'EMAIL_TAKEN' || String(message).toLowerCase().includes('already registered')) {
            message = 'An account with this email address already exists. Please sign in instead.';
            this.emailError.set(message);
          } else if (code === 'LOCATION_REQUIRED') {
            message = 'Location authorization is required for account security. Allow location and try again.';
          } else if (code === 'VALIDATION_ERROR' && fieldErrors) {
            const first = Object.values(fieldErrors).flat()[0];
            if (first) message = first;
          }

          this.errorMessage.set(message);
          this.toastService.show(message, 'error');
        }
      });
  }
}