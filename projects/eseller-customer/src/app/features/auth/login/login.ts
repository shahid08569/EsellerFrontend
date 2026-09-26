import { Component } from '@angular/core';

@Component({
  selector: 'app-login',
  imports: [],
  template: `
    <h1 class="text-2xl font-bold text-text-primary mb-2 tracking-tight">Welcome back</h1>
    <p class="text-sm text-text-secondary mb-6">Sign in to continue to Eseller</p>

    <div class="text-center py-8 text-text-muted text-sm">
      Login form — coming in F5
    </div>
  `
})
export class Login {}