import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthStore, ToastService, RoleType } from 'eseller-shared';
import { environment } from '../../../../environments/environment';
import { AdminPermissionService } from '../../../core/services/admin-permission.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class AdminLogin {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly toast = inject(ToastService);
  private readonly permissionService = inject(AdminPermissionService);

  readonly usernameOrEmail = signal('tomadmin@gmail.com');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  onSubmit(): void {
    const valUser = this.usernameOrEmail().trim();
    const valPass = this.password();

    this.errorMessage.set(null);

    if (!valUser) {
      this.errorMessage.set('Please enter your email or username.');
      return;
    }
    if (!valPass) {
      this.errorMessage.set('Please enter your password.');
      return;
    }

    this.isSubmitting.set(true);

    this.http.post<any>(`${environment.apiUrl}/auth/login`, {
      usernameOrEmail: valUser,
      password: valPass,
      deviceType: 'Desktop'
    }).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        const rLower = String(res?.roleType || '').toLowerCase();

        if (rLower !== 'superadmin' && rLower !== 'partner') {
          this.errorMessage.set('Access restricted: Only SuperAdmin and Partners can access this portal.');
          return;
        }

        const role: RoleType = rLower === 'superadmin' ? 'SuperAdmin' : 'Partner';
        const expiresAt = res.accessTokenExpiresAt
          ? new Date(res.accessTokenExpiresAt).toISOString()
          : new Date(Date.now() + 6 * 3600 * 1000).toISOString();

        const perms = res.permissions || null;

        const authPayload = {
          accessToken: String(res.accessToken || ''),
          accessTokenExpiresAt: expiresAt,
          account: {
            accountId: String(res.accountId || ''),
            username: String(res.username || ''),
            email: String(res.email || ''),
            roleType: role,
            permissions: perms
          }
        };

        this.authStore.setAuth(authPayload);

        try {
          const sessionData = JSON.stringify(authPayload);
          window.sessionStorage?.setItem('eseller_auth_session', sessionData);
          window.localStorage?.setItem('eseller_auth_session', sessionData);
        } catch {}

        this.permissionService.hydrateFromCache();
        this.toast.show(`Welcome, ${res.username || 'Partner'}!`, 'success');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg =
          err?.error?.error ||
          err?.error?.message ||
          (typeof err?.error === 'string' ? err.error : '') ||
          err?.message ||
          'Invalid credentials. Please verify your email and password.';
        this.errorMessage.set(msg);
      }
    });
  }
}
