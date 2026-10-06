import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, AuthStore, ToastService } from 'eseller-shared';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <form
        class="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl"
        (ngSubmit)="submit()"
      >
        <h1 class="text-2xl font-bold text-white mb-1">Eseller Admin</h1>
        <p class="text-sm text-slate-400 mb-6">Sign in as SuperAdmin / Partner</p>

        <label class="block text-xs font-semibold text-slate-300 mb-1">Email or username</label>
        <input
          class="w-full mb-4 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-500"
          [(ngModel)]="username"
          name="username"
          autocomplete="username"
          required
        />

        <label class="block text-xs font-semibold text-slate-300 mb-1">Password</label>
        <input
          type="password"
          class="w-full mb-4 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-indigo-500"
          [(ngModel)]="password"
          name="password"
          autocomplete="current-password"
          required
        />

        @if (error()) {
          <p class="mb-4 text-sm text-rose-400">{{ error() }}</p>
        }

        <button
          type="submit"
          class="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-2.5"
          [disabled]="busy()"
        >
          {{ busy() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  `
})
export class AdminLogin {
  private readonly auth = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  username = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    this.error.set(null);
    const u = this.username.trim();
    const p = this.password;
    if (!u || !p) {
      this.error.set('Email and password are required.');
      return;
    }
    this.busy.set(true);
    this.auth.login({ usernameOrEmail: u, password: p }).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res.roleType !== 'SuperAdmin' && res.roleType !== 'Partner') {
          this.error.set('This account is not an admin.');
          return;
        }
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
        this.toast.show(`Welcome, ${res.username}`, 'success');
        void this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error || err?.message || 'Login failed.');
      }
    });
  }
}
