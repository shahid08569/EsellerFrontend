import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface TierPlan {
  id: string;
  name: string;
  price: number;
  badge: string;
  color: string;
  tagline: string;
  features: string[];
  popular?: boolean;
  productLimit: number;
}

@Component({
  selector: 'app-tier-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tier-modal.html'
})
export class TierModal {
  @Input() isOpen = false;
  @Input() currentTier = 'Bronze (Free)';
  @Output() close = new EventEmitter<void>();
  @Output() tierRequested = new EventEmitter<{ tier: string; price: number; note: string; receiptUrl?: string }>();

  readonly plans: TierPlan[] = [
    {
      id: 'bronze',
      name: 'Bronze (Free)',
      price: 0,
      badge: 'Bronze (Free)',
      color: 'border-slate-300 text-slate-800 bg-slate-50',
      tagline: 'Default plan for verified merchants — up to 200 products.',
      productLimit: 200,
      features: [
        'Up to 200 Products from Warehouse',
        'Flat 20% Commission on every sale',
        'Standard Storefront & Catalog Access',
        'Chat with customers + Super Admin'
      ]
    },
    {
      id: 'gold',
      name: 'Gold',
      price: 1000,
      badge: 'Gold ($1000)',
      color: 'border-amber-400 text-amber-900 bg-amber-50/70',
      tagline: 'Growth tier for volume sellers — up to 1,000 products.',
      productLimit: 1000,
      features: [
        'Up to 1,000 Products from Warehouse',
        'Flat 20% Commission on every sale',
        'Gold Verified Merchant Badge',
        'Marketplace Featured Placement',
        'Priority Customer Support'
      ],
      popular: true
    },
    {
      id: 'diamond',
      name: 'Diamond',
      price: 2000,
      badge: 'Diamond ($2000)',
      color: 'border-cyan-400 text-cyan-900 bg-cyan-50/70',
      tagline: 'Enterprise capacity — up to 5,000 products.',
      productLimit: 5000,
      features: [
        'Up to 5,000 Products from Warehouse',
        'Flat 20% Commission on every sale',
        'Diamond Elite Badge & Top Search Placement',
        'Dedicated VIP Account Manager',
        'Instant Daily COD Payouts'
      ]
    }
  ];

  readonly selectedTierId = signal<string>('gold');
  readonly referenceNote = signal<string>('');
  readonly receiptFile = signal<File | null>(null);
  readonly receiptPreviewUrl = signal<string | null>(null);
  readonly isSubmitting = signal<boolean>(false);
  readonly submitted = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  selectPlan(id: string): void {
    this.selectedTierId.set(id);
    this.error.set(null);
  }

  getSelectedPlan(): TierPlan {
    return this.plans.find((p) => p.id === this.selectedTierId()) || this.plans[1];
  }

  onReceiptSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.receiptFile.set(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        this.receiptPreviewUrl.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  removeReceipt(): void {
    this.receiptFile.set(null);
    this.receiptPreviewUrl.set(null);
  }

  submitRequest(): void {
    const plan = this.getSelectedPlan();
    this.error.set(null);

    if (plan.price > 0 && !this.receiptPreviewUrl()) {
      this.error.set('Please upload your payment receipt before submitting a paid package request.');
      return;
    }

    this.isSubmitting.set(true);

    setTimeout(() => {
      this.isSubmitting.set(false);
      this.submitted.set(true);
      this.tierRequested.emit({
        tier: plan.name,
        price: plan.price,
        note: this.referenceNote(),
        receiptUrl: this.receiptPreviewUrl() || undefined
      });
    }, 500);
  }

  closeModal(): void {
    this.submitted.set(false);
    this.isSubmitting.set(false);
    this.receiptFile.set(null);
    this.receiptPreviewUrl.set(null);
    this.referenceNote.set('');
    this.error.set(null);
    this.close.emit();
  }
}
