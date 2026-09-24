import { Component } from '@angular/core';
import { Button, Card, Badge } from 'eseller-shared';

@Component({
  selector: 'app-home',
  imports: [Button, Card, Badge],
  template: `
    <div class="p-8 max-w-4xl mx-auto">

      <h1 class="text-3xl font-bold text-text-primary mb-2 tracking-tight">
        Shared Components Test
      </h1>
      <p class="text-sm text-text-secondary mb-8">
        Customer App — Accent should be <strong>ROSE</strong>
      </p>

      <!-- ============================================ -->
      <!-- BUTTON COMPONENT -->
      <!-- ============================================ -->
      <h2 class="text-xl font-semibold mb-4">Buttons</h2>
      <div class="flex flex-wrap gap-3 mb-8">
        <es-button variant="primary">Primary</es-button>
        <es-button variant="secondary">Secondary</es-button>
        <es-button variant="destructive">Delete</es-button>
        <es-button variant="primary" [disabled]="true">Disabled</es-button>
        <es-button variant="primary" size="sm">Small</es-button>
        <es-button variant="primary" size="lg">Large</es-button>
      </div>

      <!-- ============================================ -->
      <!-- BADGE COMPONENT -->
      <!-- ============================================ -->
      <h2 class="text-xl font-semibold mb-4">Badges</h2>
      <div class="flex flex-wrap gap-3 mb-8">
        <es-badge variant="success">Active</es-badge>
        <es-badge variant="warning">Pending</es-badge>
        <es-badge variant="danger">Rejected</es-badge>
        <es-badge variant="info">Info</es-badge>
        <es-badge variant="primary">Primary</es-badge>
        <es-badge variant="neutral">Draft</es-badge>
        <es-badge variant="success" [withDot]="true">With Dot</es-badge>
      </div>

      <!-- ============================================ -->
      <!-- CARD COMPONENT -->
      <!-- ============================================ -->
      <h2 class="text-xl font-semibold mb-4">Cards</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

        <es-card>
          <p class="text-sm text-text-secondary mb-1">Total Revenue</p>
          <p class="stat-number text-3xl text-text-primary">Rs. 1,234,567</p>
        </es-card>

        <es-card [hoverable]="true">
          <p class="text-sm text-text-secondary mb-1">Orders</p>
          <p class="stat-number text-3xl text-text-primary">8,432</p>
          <p class="text-xs text-text-muted mt-2">Click to view →</p>
        </es-card>

        <es-card [padding]="'lg'" [shadow]="'md'">
          <p class="text-sm text-text-secondary mb-1">Customers</p>
          <p class="stat-number text-3xl text-text-primary">1,209</p>
        </es-card>

      </div>

    </div>
  `
})
export class Home {}