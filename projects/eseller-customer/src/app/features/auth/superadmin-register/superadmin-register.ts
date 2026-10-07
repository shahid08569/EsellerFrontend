import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, AuthStore, ToastService } from 'eseller-shared';

@Component({
  selector: 'app-superadmin-register',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './superadmin-register.html'
})
export class SuperAdminRegister implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly isSubmitting = signal(false);
  readonly checking = signal(true);
  readonly signupOpen = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly hasMinLength = computed(() => this.password().length >= 12);
  readonly hasUpperCase = computed(() => /[A-Z]/.test(this.password()));
  readonly hasLowerCase = computed(() => /[a-z]/.test(this.password()));
  readonly hasNumber = computed(() => /[0-9]/.test(this.password()));
  readonly hasSpecial = computed(() => /[^a-zA-Z0-9]/.test(this.password()));

  ngOnInit(): void {
    if (this.authStore.isAuthenticated()) {
      this.router.navigate(['/']);
      return;
    }
    this.authService.isSuperAdminSignupAvailable().subscribe({
      next: (ok) => {
        this.signupOpen.set(ok);
        this.checking.set(false);
      },
      error: () => {
        this.signupOpen.set(false);
        this.checking.set(false);
      }
    });
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  onSubmit(): void {
    this.errorMessage.set(null);
    const name = this.name().trim();
    const email = this.email().trim();
    const password = this.password();
    const confirm = this.confirmPassword();

    if (name.length < 2) {
      this.errorMessage.set('Enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.errorMessage.set('Enter a valid email.');
      return;
    }
    if (!this.hasMinLength() || !this.hasUpperCase() || !this.hasLowerCase() || !this.hasNumber() || !this.hasSpecial()) {
      this.errorMessage.set('Password must be 12+ chars with upper, lower, number, and special character.');
      return;
    }
    if (password !== confirm) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.isSubmitting.set(true);
    this.authService.registerSuperAdmin({ name, email, password }).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.toast.show(res.message || 'SuperAdmin created. Please sign in.', 'success');
        this.router.navigate(['/auth/login'], {
          queryParams: { registered: 'superadmin', email }
        });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error || err?.message || 'Signup failed.');
      }
    });
  }
}
