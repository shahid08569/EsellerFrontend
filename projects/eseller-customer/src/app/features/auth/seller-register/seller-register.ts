import { Component, OnInit, inject, signal, computed, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService, AuthStore, ToastService, ApiService } from 'eseller-shared';
import {
  COUNTRIES_DATA,
  CountryStateData,
  DEFAULT_DIAL_CODE,
  phonePlaceholderForDialCode
} from '../../../shared/data/countries-states.data';

export interface VerificationDocOption {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  hint: string;
  requiresBackSide: boolean;
}

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
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly toastService = inject(ToastService);
  private readonly elementRef = inject(ElementRef);

  readonly referralCode = signal<string>('');

  // Available Countries
  readonly allCountries = COUNTRIES_DATA;

  // Merchant Personal Details
  readonly name = signal<string>('');
  readonly email = signal<string>('');
  readonly phone = signal<string>('');

  // Country Code Picker
  readonly selectedCountryCode = signal<string>(DEFAULT_DIAL_CODE);
  readonly selectedCountryFlag = signal<string>('🇺🇸');
  readonly countryCodeSearch = signal<string>('');
  readonly isCountryCodeDropdownOpen = signal<boolean>(false);

  readonly filteredCountryCodes = computed(() => {
    const query = this.countryCodeSearch().trim().toLowerCase();
    if (!query) return this.allCountries;
    return this.allCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.phoneCode.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query)
    );
  });

  readonly phonePlaceholder = computed(() =>
    phonePlaceholderForDialCode(this.selectedCountryCode())
  );

  // Shop & Brand Details
  readonly storeName = signal<string>('');
  readonly storeUrl = signal<string>('');
  readonly isCustomSlug = signal<boolean>(false);
  readonly storeDescription = signal<string>('');

  // Location & Warehouse Details
  readonly selectedCountry = signal<string>('');
  readonly selectedState = signal<string>('');
  readonly city = signal<string>('');
  readonly address = signal<string>('');

  readonly sortedCountries = computed(() =>
    [...this.allCountries].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )
  );

  readonly availableStates = computed(() => {
    const countryName = this.selectedCountry();
    if (!countryName) return [];
    const found = this.allCountries.find(
      (c) => c.name.toLowerCase() === countryName.toLowerCase()
    );
    return found
      ? [...found.states].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: 'base' })
        )
      : [];
  });

  // Document Verification Options
  readonly docOptions: VerificationDocOption[] = [
    {
      id: 'cnic',
      name: 'Identity Card (CNIC / National ID)',
      label: 'Identity Card',
      placeholder: '',
      hint: 'Upload clear Front & Back scans or photos of your official Government Identity Card.',
      requiresBackSide: true
    },
    {
      id: 'passport',
      name: 'Passport',
      label: 'International Passport',
      placeholder: '',
      hint: 'Upload clear scan of the main photo and identity data page of your valid Passport.',
      requiresBackSide: false
    },
    {
      id: 'license',
      name: 'Driving License',
      label: 'Driving License',
      placeholder: '',
      hint: 'Upload clear Front & Back photos of your valid government-issued Driving License.',
      requiresBackSide: true
    },
    {
      id: 'security-card',
      name: 'Security Card (SSN / National ID Proof)',
      label: 'Security Identification / SSN Card',
      placeholder: '',
      hint: 'Upload official Government Security Identification Card or National SSN document.',
      requiresBackSide: true
    }
  ];

  readonly selectedDocType = signal<string>('cnic');
  readonly docNumber = signal<string>('');
  readonly passportExpiryDate = signal<string>('');

  // Front Document Upload State
  readonly docFrontFile = signal<File | null>(null);
  readonly docFrontFileName = signal<string>('');
  readonly docFrontUrl = signal<string>('');
  readonly docFrontPreview = signal<string | null>(null);
  readonly isUploadingFrontDoc = signal<boolean>(false);

  // Back Document Upload State
  readonly docBackFile = signal<File | null>(null);
  readonly docBackFileName = signal<string>('');
  readonly docBackUrl = signal<string>('');
  readonly docBackPreview = signal<string | null>(null);
  readonly isUploadingBackDoc = signal<boolean>(false);

  // Security Credentials
  readonly password = signal<string>('');
  readonly confirmPassword = signal<string>('');
  readonly agreeToTerms = signal<boolean>(true);

  // Visibility toggles
  readonly showPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);

  // Submission & Progress States
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly registrationSuccess = signal<boolean>(false);
  readonly registeredStoreName = signal<string>('');
  readonly registeredStoreSlug = signal<string>('');

  // Field Errors
  readonly nameError = signal<string | null>(null);
  readonly emailError = signal<string | null>(null);
  readonly phoneError = signal<string | null>(null);
  readonly storeNameError = signal<string | null>(null);
  readonly storeUrlError = signal<string | null>(null);
  readonly countryError = signal<string | null>(null);
  readonly stateError = signal<string | null>(null);
  readonly cityError = signal<string | null>(null);
  readonly addressError = signal<string | null>(null);
  readonly docNumberError = signal<string | null>(null);
  readonly docFrontError = signal<string | null>(null);
  readonly docBackError = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);
  readonly confirmPasswordError = signal<string | null>(null);
  readonly termsError = signal<string | null>(null);

  // Current selected document config
  readonly currentDocConfig = computed(() => {
    const selected = this.selectedDocType();
    return this.docOptions.find((d) => d.id === selected) || this.docOptions[0];
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!this.elementRef.nativeElement.querySelector('.country-code-picker-container')?.contains(target)) {
      this.isCountryCodeDropdownOpen.set(false);
    }
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const ref = params.get('ref') || params.get('referral');
      if (ref) {
        const clean = ref.trim().toUpperCase();
        this.referralCode.set(clean);
        this.api.get(`/affiliate/track/${encodeURIComponent(clean)}`).subscribe({ error: () => {} });
      }
    });

    if (this.authStore.isAuthenticated()) {
      const user = this.authStore.currentAccount();
      if (user && !this.name()) {
        this.name.set(user.username || '');
        this.email.set(user.email || '');
      }
    }
  }

  toggleCountryCodeDropdown(): void {
    this.isCountryCodeDropdownOpen.update((v) => !v);
    if (this.isCountryCodeDropdownOpen()) {
      this.countryCodeSearch.set('');
    }
  }

  selectCountryCode(country: CountryStateData): void {
    this.selectedCountryCode.set(country.phoneCode);
    this.selectedCountryFlag.set(country.flag);
    this.isCountryCodeDropdownOpen.set(false);
    this.countryCodeSearch.set('');
  }

  onCountryChange(countryName: string): void {
    this.selectedCountry.set(countryName);
    this.countryError.set(null);
    this.selectedState.set('');
    this.city.set('');

    const match = this.allCountries.find(
      (c) => c.name.toLowerCase() === countryName.toLowerCase()
    );

    if (match) {
      this.selectedCountryCode.set(match.phoneCode);
      this.selectedCountryFlag.set(match.flag);
    }
  }

  onStateChange(stateName: string): void {
    this.selectedState.set(stateName);
    this.stateError.set(null);
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
    const sanitized = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    this.storeUrl.set(sanitized);
    this.storeUrlError.set(null);
  }

  onDocTypeSelect(typeId: string): void {
    this.selectedDocType.set(typeId);
    this.docNumberError.set(null);
    this.docFrontError.set(null);
    this.docBackError.set(null);
  }

  onFrontFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    const maxSizeBytes = 10 * 1024 * 1024;

    if (!allowedTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(jpg|jpeg|png|webp|pdf)$/i)) {
      this.docFrontError.set('Please upload JPG, PNG, WEBP, or PDF format.');
      this.toastService.show('Invalid file format', 'error');
      return;
    }

    if (file.size > maxSizeBytes) {
      this.docFrontError.set('File size exceeds 10 MB limit.');
      this.toastService.show('File is too large (max 10 MB)', 'error');
      return;
    }

    this.docFrontError.set(null);
    this.docFrontFile.set(file);
    this.docFrontFileName.set(file.name);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => this.docFrontPreview.set(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      this.docFrontPreview.set(null);
    }

    this.isUploadingFrontDoc.set(true);
    this.authService.uploadVerificationDocument(file).subscribe({
      next: (res) => {
        this.isUploadingFrontDoc.set(false);
        this.docFrontUrl.set(res.documentUrl);
        this.toastService.show('Front document uploaded successfully.', 'success');
      },
      error: (err) => {
        this.isUploadingFrontDoc.set(false);
        this.docFrontUrl.set('');
        this.docFrontError.set(
          (typeof err?.error === 'string' ? err.error : '') ||
            'Front document upload failed. Please try again.'
        );
        this.toastService.show('Front document upload failed. Re-upload required.', 'error');
      }
    });
  }

  removeFrontFile(): void {
    this.docFrontFile.set(null);
    this.docFrontFileName.set('');
    this.docFrontUrl.set('');
    this.docFrontPreview.set(null);
    this.docFrontError.set(null);
  }

  onBackFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    const maxSizeBytes = 10 * 1024 * 1024;

    if (!allowedTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(jpg|jpeg|png|webp|pdf)$/i)) {
      this.docBackError.set('Please upload JPG, PNG, WEBP, or PDF format.');
      this.toastService.show('Invalid file format', 'error');
      return;
    }

    if (file.size > maxSizeBytes) {
      this.docBackError.set('File size exceeds 10 MB limit.');
      this.toastService.show('File is too large (max 10 MB)', 'error');
      return;
    }

    this.docBackError.set(null);
    this.docBackFile.set(file);
    this.docBackFileName.set(file.name);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => this.docBackPreview.set(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      this.docBackPreview.set(null);
    }

    this.isUploadingBackDoc.set(true);
    this.authService.uploadVerificationDocument(file).subscribe({
      next: (res) => {
        this.isUploadingBackDoc.set(false);
        this.docBackUrl.set(res.documentUrl);
        this.toastService.show('Back document uploaded successfully.', 'success');
      },
      error: (err) => {
        this.isUploadingBackDoc.set(false);
        this.docBackUrl.set('');
        this.docBackError.set(
          (typeof err?.error === 'string' ? err.error : '') ||
            'Back document upload failed. Please try again.'
        );
        this.toastService.show('Back document upload failed. Re-upload required.', 'error');
      }
    });
  }

  removeBackFile(): void {
    this.docBackFile.set(null);
    this.docBackFileName.set('');
    this.docBackUrl.set('');
    this.docBackPreview.set(null);
    this.docBackError.set(null);
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
    this.countryError.set(null);
    this.cityError.set(null);
    this.addressError.set(null);
    this.docNumberError.set(null);
    this.docFrontError.set(null);
    this.docBackError.set(null);
    this.passwordError.set(null);
    this.confirmPasswordError.set(null);

    let hasError = false;

    if (!this.name().trim()) {
      this.nameError.set('Legal full name is required.');
      hasError = true;
    }
    if (!this.email().trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim())) {
      this.emailError.set('Valid business email address is required.');
      hasError = true;
    }
    if (!this.phone().trim()) {
      this.phoneError.set('Contact phone number is required.');
      hasError = true;
    }
    if (!this.storeName().trim()) {
      this.storeNameError.set('Store name is required.');
      hasError = true;
    }
    if (!this.storeUrl().trim()) {
      this.storeUrlError.set('Store URL handle is required.');
      hasError = true;
    }
    if (!this.city().trim()) {
      this.cityError.set('City name is required.');
      hasError = true;
    }
    if (!this.address().trim()) {
      this.addressError.set('Warehouse / Store address is required.');
      hasError = true;
    }
    // Document number is optional / removed from UI — KYC uses uploads only.
    if (!this.docFrontFileName()) {
      this.docFrontError.set(`Please upload the Front view of your ${this.currentDocConfig().label}.`);
      hasError = true;
    }
    const frontReady = !!this.docFrontUrl() && !this.docFrontUrl().startsWith('local-');
    if (this.docFrontFileName() && (!frontReady || this.isUploadingFrontDoc())) {
      this.docFrontError.set('Front document upload incomplete. Please wait or re-upload.');
      hasError = true;
    }
    if (this.currentDocConfig().requiresBackSide && !this.docBackFileName()) {
      this.docBackError.set(`Please upload the Back view of your ${this.currentDocConfig().label}.`);
      hasError = true;
    }
    const backReady = !!this.docBackUrl() && !this.docBackUrl().startsWith('local-');
    if (this.currentDocConfig().requiresBackSide && this.docBackFileName() && (!backReady || this.isUploadingBackDoc())) {
      this.docBackError.set('Back document upload incomplete. Please wait or re-upload.');
      hasError = true;
    }
    if (!this.password() || this.password().length < 8) {
      this.passwordError.set('Password must be at least 8 characters.');
      hasError = true;
    } else if (!/[A-Z]/.test(this.password()) || !/[a-z]/.test(this.password()) || !/[0-9]/.test(this.password()) || !/[^a-zA-Z0-9]/.test(this.password())) {
      this.passwordError.set('Password needs uppercase, lowercase, number, and special character.');
      hasError = true;
    }
    if (this.password() !== this.confirmPassword()) {
      this.confirmPasswordError.set('Passwords do not match.');
      hasError = true;
    }
    if (!this.agreeToTerms()) {
      this.termsError.set('You must accept the Seller Terms of Service to register.');
      hasError = true;
    }

    if (hasError) {
      this.toastService.show('Please fill in all mandatory fields correctly.', 'error');
      return;
    }

    this.isSubmitting.set(true);

    const fullPhone = `${this.selectedCountryCode()} ${this.phone().trim()}`;
    const frontUrl = this.docFrontUrl().startsWith('local-') ? '' : this.docFrontUrl();
    const backUrl = this.docBackUrl().startsWith('local-') ? '' : this.docBackUrl();
    if (!frontUrl) {
      this.docFrontError.set('Front document must be uploaded to the server before registering.');
      this.toastService.show('Please re-upload your identity documents.', 'error');
      this.isSubmitting.set(false);
      return;
    }

    const payload = {
      name: this.name().trim(),
      email: this.email().trim(),
      phone: fullPhone,
      password: this.password(),
      storeName: this.storeName().trim(),
      storeUrl: this.storeUrl().trim(),
      storeDescription: this.storeDescription().trim() || undefined,
      address: this.address().trim(),
      city: this.city().trim(),
      country: this.selectedCountry(),
      documentType: this.currentDocConfig().name,
      documentNumber: null,
      cnicFrontUrl: frontUrl,
      cnicBackUrl: backUrl,
      // Single-sided docs (e.g. passport) also keep a generic DocumentUrl
      documentUrl: frontUrl,
      referralCode: this.referralCode().trim() || null
    };

    this.authService.registerSeller(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.registeredStoreName.set(this.storeName());
        this.registeredStoreSlug.set(this.storeUrl());
        this.registrationSuccess.set(true);
        this.toastService.show('Merchant registration submitted for review!', 'success');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        // ApiService/errorInterceptor already normalises to { error, errorCode, errors? }
        const code = (err?.errorCode as string | undefined) || '';
        const fieldErrors = err?.errors as Record<string, string[]> | undefined;
        let msg = (typeof err?.error === 'string' ? err.error : '')
          || 'Registration failed. Please review your details.';

        if (code === 'EMAIL_TAKEN') {
          this.emailError.set(msg || 'Email is already registered.');
        } else if (code === 'STORE_URL_TAKEN') {
          this.storeUrlError.set(msg || 'Store URL is already taken.');
        } else if (fieldErrors) {
          const firstFieldErrors = Object.values(fieldErrors).flat().filter(Boolean);
          if (firstFieldErrors.length) msg = firstFieldErrors[0];

          const map: Record<string, (m: string) => void> = {
            email: (m) => this.emailError.set(m),
            storeurl: (m) => this.storeUrlError.set(m),
            password: (m) => this.passwordError.set(m),
            name: (m) => this.nameError.set(m),
            phone: (m) => this.phoneError.set(m),
            storename: (m) => this.storeNameError.set(m),
            address: (m) => this.addressError.set(m),
            city: (m) => this.cityError.set(m)
          };
          for (const [key, msgs] of Object.entries(fieldErrors)) {
            const setter = map[key.toLowerCase()];
            if (setter && msgs?.[0]) setter(msgs[0]);
          }
        }

        this.errorMessage.set(msg);
        this.toastService.show(msg, 'error');
      }
    });
  }
}
