import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService, AuthStore, ToastService } from 'eseller-shared';

@Component({
  selector: 'app-seller-register',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './seller-register.html',
  styleUrl: './seller-register.css'
})
export class SellerRegister implements OnInit {
  private readonly authService = inject(AuthService);
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  // Merchant Personal Details
  readonly name = signal<string>('');
  readonly email = signal<string>('');
  readonly phone = signal<string>('');
  readonly selectedDialCode = signal<string>('+92');

  // Shop & Brand Details
  readonly storeName = signal<string>('');
  readonly storeUrl = signal<string>('');
  readonly isCustomSlug = signal<boolean>(false);
  readonly storeDescription = signal<string>('');

  // Business Location & Warehouse
  readonly address = signal<string>('');
  readonly city = signal<string>('Lahore');
  readonly country = signal<string>('Pakistan');

  // Security Credentials
  readonly password = signal<string>('');
  readonly confirmPassword = signal<string>('');
  readonly agreeToTerms = signal<boolean>(true);

  // Visibility toggles
  readonly showPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);

  // State signals
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly registrationSuccess = signal<boolean>(false);
  readonly registeredStoreName = signal<string>('');
  readonly registeredStoreSlug = signal<string>('');

  // Field errors
  readonly nameError = signal<string | null>(null);
  readonly emailError = signal<string | null>(null);
  readonly phoneError = signal<string | null>(null);
  readonly storeNameError = signal<string | null>(null);
  readonly storeUrlError = signal<string | null>(null);
  readonly addressError = signal<string | null>(null);
  readonly cityError = signal<string | null>(null);
  readonly countryError = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);
  readonly confirmPasswordError = signal<string | null>(null);
  readonly termsError = signal<string | null>(null);

  // Real-time password criteria
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

  readonly countryCodes = [
    { label: '🇵🇰 Pakistan (+92)', code: '+92', placeholder: '300 1234567' },
    { label: '🇦🇪 UAE (+971)', code: '+971', placeholder: '50 123 4567' },
    { label: '🇸🇦 Saudi Arabia (+966)', code: '+966', placeholder: '50 123 4567' },
    { label: '🇬🇧 UK (+44)', code: '+44', placeholder: '7911 123456' },
    { label: '🇺🇸 USA (+1)', code: '+1', placeholder: '(555) 000-0000' }
  ];

  ngOnInit(): void {
    if (this.authStore.isAuthenticated()) {
      const user = this.authStore.currentAccount();
      if (user && !this.name()) {
        this.name.set(user.username || '');
        this.email.set(user.email || '');
      }
    }
  }

  onStoreNameChange(val: string): void {
    this.storeName.set(val);
    this.storeNameError.set(null);
    if (!this.isCustomSlug()) {
      const autoSlug = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      this.storeUrl.set(autoSlug);
    }
  }

  onStoreUrlChange(val: string): void {
    this.isCustomSlug.set(true);
    const sanitized = val
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    this.storeUrl.set(sanitized);
    this.storeUrlError.set(null);
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
    this.storeNameError.set(null);
    this.storeUrlError.set(null);
    this.addressError.set(null);
    this.cityError.set(null);
    this.countryError.set(null);
    this.passwordError.set(null);
    this.confirmPasswordError.set(null);
    this.termsError.set(null);

    const valName = this.name().trim();
    const valEmail = this.email().trim();
    const rawPhone = this.phone().trim();
    const valStoreName = this.storeName().trim();
    const valStoreUrl = this.storeUrl().trim();
    const valAddress = this.address().trim();
    const valCity = this.city().trim();
    const valCountry = this.country().trim();
    const valPassword = this.password().trim();
    const valConfirm = this.confirmPassword().trim();

    let hasErrors = false;

    if (!valName || valName.length < 2) {
      this.nameError.set('Please provide merchant full legal name.');
      hasErrors = true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!valEmail || !emailRegex.test(valEmail)) {
      this.emailError.set('Please enter a valid business email.');
      hasErrors = true;
    }

    if (!rawPhone || rawPhone.length < 7) {
      this.phoneError.set('Please enter a valid mobile number for merchant notifications.');
      hasErrors = true;
    }

    if (!valStoreName || valStoreName.length < 2) {
      this.storeNameError.set('Store or Brand Name is required.');
      hasErrors = true;
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!valStoreUrl || !slugRegex.test(valStoreUrl)) {
      this.storeUrlError.set('Store URL can only contain lowercase letters, numbers, and hyphens.');
      hasErrors = true;
    }

    if (!valAddress || valAddress.length < 5) {
      this.addressError.set('Please provide physical warehouse or dispatch address.');
      hasErrors = true;
    }

    if (!valCity) {
      this.cityError.set('Warehouse / Store city is required.');
      hasErrors = true;
    }

    if (!valCountry) {
      this.countryError.set('Country is required.');
      hasErrors = true;
    }

    if (!this.isPasswordFullyValid()) {
      this.passwordError.set('Password must fulfill all 5 security criteria.');
      hasErrors = true;
    }

    if (valPassword !== valConfirm) {
      this.confirmPasswordError.set('Passwords do not match.');
      hasErrors = true;
    }

    if (!this.agreeToTerms()) {
      this.termsError.set('You must accept the Merchant Agreement and Code of Conduct.');
      hasErrors = true;
    }

    if (hasErrors) {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 100, behavior: 'smooth' });
      }
      return;
    }

    this.isSubmitting.set(true);

    const fullPhone = rawPhone.startsWith('+')
      ? rawPhone
      : `${this.selectedDialCode()} ${rawPhone}`;

    this.authService
      .registerSeller({
        name: valName,
        email: valEmail,
        phone: fullPhone,
        password: valPassword,
        storeName: valStoreName,
        storeUrl: valStoreUrl,
        storeDescription: this.storeDescription().trim(),
        address: valAddress,
        city: valCity,
        country: valCountry
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.registeredStoreName.set(res.storeName || valStoreName);
          this.registeredStoreSlug.set(res.storeUrl || valStoreUrl);
          this.registrationSuccess.set(true);
          this.toastService.show(
            `Store "${valStoreName}" registered successfully! Welcome to Eseller Merchant Network.`,
            'success'
          );
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const code = err?.error?.errorCode || err?.error || '';
          let message = 'Seller registration could not be processed. Please check your data.';

          if (code === 'EMAIL_TAKEN') {
            message = 'An account with this email address already exists. Please sign in instead.';
          } else if (code === 'STORE_URL_TAKEN' || code?.includes('URL')) {
            message = 'This Store URL handle is already claimed by another merchant. Please pick another URL.';
          } else if (code === 'LOCATION_REQUIRED') {
            message = 'Location authorization is required for merchant onboarding.';
          } else if (err?.message && !err?.message.includes('Http failure')) {
            message = err.message;
          }

          this.errorMessage.set(message);
          this.toastService.show(message, 'error');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 100, behavior: 'smooth' });
          }
        }
      });
  }

  goToDashboard(): void {
    if (typeof window !== 'undefined') {
      window.location.href = 'http://localhost:54007/dashboard';
    }
  }
}
