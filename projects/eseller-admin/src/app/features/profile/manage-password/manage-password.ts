import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService, AuthStore, ToastService, SkeletonLayout } from 'eseller-shared';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-manage-password',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
  templateUrl: './manage-password.html'
})
export class ManagePassword implements OnInit {
  private readonly http = inject(HttpClient);
  readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly isSavingName = signal<boolean>(false);
  readonly isChangingPassword = signal<boolean>(false);

  // Profile data
  readonly displayName = signal<string>('');
  readonly email = signal<string>('');
  readonly role = signal<string>('');
  readonly permissions = signal<string[]>([]);

  // Password fields
  readonly currentPassword = signal<string>('');
  readonly newPassword = signal<string>('');
  readonly confirmPassword = signal<string>('');

  readonly showCurrent = signal<boolean>(false);
  readonly showNew = signal<boolean>(false);
  readonly showConfirm = signal<boolean>(false);

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading.set(true);
    const account = this.authStore.currentAccount();
    if (account) {
      this.displayName.set(account.username || '');
      this.email.set(account.email || '');
      this.role.set(account.roleType || '');
    }

    this.http.get<any>(`${environment.apiUrl}/api/v1/auth/me`).subscribe({
      next: (res) => {
        if (res) {
          if (res.username) this.displayName.set(res.username);
          if (res.email) this.email.set(res.email);
          if (res.roleType) this.role.set(res.roleType);
          if (res.permissions) {
            try {
              const parsed = typeof res.permissions === 'string' ? JSON.parse(res.permissions) : res.permissions;
              this.permissions.set(Array.isArray(parsed) ? parsed : []);
            } catch {
              this.permissions.set(typeof res.permissions === 'string' ? res.permissions.split(',') : []);
            }
          }
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  saveName(): void {
    const name = this.displayName().trim();
    if (!name) {
      this.toast.show('Please enter a valid display name.', 'error');
      return;
    }

    this.isSavingName.set(true);
    this.http.put<any>(`${environment.apiUrl}/api/v1/auth/profile`, { username: name }).subscribe({
      next: (res) => {
        this.isSavingName.set(false);
        this.toast.show(res?.message || 'Display name updated successfully.', 'success');

        // Update local authStore state
        const current = this.authStore.currentAccount();
        if (current) {
          this.authStore.setAuth({
            accessToken: this.authStore.accessToken() || '',
            accessTokenExpiresAt: this.authStore.accessTokenExpiresAt() || new Date(Date.now() + 3600000),
            account: { ...current, username: name }
          });
        }
      },
      error: (err) => {
        this.isSavingName.set(false);
        this.toast.show(err?.error?.error || 'Failed to update name.', 'error');
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
    if (next.length < 6) {
      this.toast.show('New password must be at least 6 characters.', 'error');
      return;
    }
    if (next !== conf) {
      this.toast.show('New password and confirmation do not match.', 'error');
      return;
    }

    this.isChangingPassword.set(true);
    this.authService.changePassword({ currentPassword: cur, newPassword: next }).subscribe({
      next: (res) => {
        this.isChangingPassword.set(false);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.toast.show(res?.message || 'Password updated successfully.', 'success');
      },
      error: (err) => {
        this.isChangingPassword.set(false);
        this.toast.show(err?.error?.error || 'Failed to update password.', 'error');
      }
    });
  }
}
