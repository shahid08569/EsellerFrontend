import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  OnChanges,
  SimpleChanges,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService } from '../../../core/services/seller.service';
import { SkeletonLayout } from 'eseller-shared';

export interface TierPlan {
  id: string;
  name: string;
  price: number;
  badge: string;
  color: string;
  tagline: string;
  features: string[];
  productLimit: number;
  isCurrent?: boolean;
  isRecommended?: boolean;
}

const FALLBACK_PLANS: TierPlan[] = [
  {
    id: 'bronze',
    name: 'Bronze (Free)',
    price: 0,
    badge: 'Bronze (Free)',
    color: 'border-slate-300',
    tagline: 'Default plan for verified merchants — up to 200 products.',
    productLimit: 200,
    isRecommended: false,
    features: [
      'Up to 200 Products from Warehouse',
      'Flat 20% Commission on every sale',
      'Standard Storefront & Catalog Access'
    ]
  },
  {
    id: 'gold',
    name: 'Gold',
    price: 1000,
    badge: 'Gold',
    color: 'border-amber-400',
    tagline: 'Growth tier for volume sellers — up to 1,000 products.',
    productLimit: 1000,
    isRecommended: true,
    features: [
      'Up to 1,000 Products from Warehouse',
      'Flat 20% Commission on every sale',
      'Gold Verified Merchant Badge'
    ]
  },
  {
    id: 'diamond',
    name: 'Diamond',
    price: 2000,
    badge: 'Diamond',
    color: 'border-cyan-400',
    tagline: 'Enterprise capacity — up to 5,000 products.',
    productLimit: 5000,
    isRecommended: false,
    features: [
      'Up to 5,000 Products from Warehouse',
      'Flat 20% Commission on every sale',
      'Diamond Elite Badge & Top Search Placement'
    ]
  }
];

@Component({
  selector: 'app-tier-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
  templateUrl: './tier-modal.html'
})
export class TierModal implements OnChanges {
  private readonly sellerSvc = inject(SellerService);

  @Input() isOpen = false;
  @Input() currentTier = 'Bronze (Free)';
  @Output() close = new EventEmitter<void>();
  @Output() tierRequested = new EventEmitter<{
    tier: string;
    price: number;
    note: string;
    receiptUrl?: string;
    categoryId?: string;
  }>();

  readonly plans = signal<TierPlan[]>([]);
  readonly isLoadingPlans = signal<boolean>(false);
  readonly selectedTierId = signal<string>('');
  readonly referenceNote = signal<string>('');
  readonly receiptFile = signal<File | null>(null);
  readonly receiptPreviewUrl = signal<string | null>(null);
  readonly isSubmitting = signal<boolean>(false);
  readonly submitted = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.submitted.set(false);
      this.error.set(null);
      this.loadPlans();
    }
    if (changes['currentTier'] && this.isOpen && this.plans().length) {
      this.applySelectionBadges(this.plans());
    }
  }

  private loadPlans(): void {
    this.isLoadingPlans.set(true);
    this.sellerSvc.getShopCategories().subscribe({
      next: (cats) => {
        this.isLoadingPlans.set(false);
        const mapped = (cats || []).map((c) => this.mapCategory(c));
        const plans = mapped.length ? mapped : [...FALLBACK_PLANS];
        this.applySelectionBadges(plans);
      },
      error: () => {
        this.isLoadingPlans.set(false);
        this.applySelectionBadges([...FALLBACK_PLANS]);
      }
    });
  }

  private mapCategory(c: {
    id: string;
    name: string;
    description?: string | null;
    badgeText?: string | null;
    priceUsd?: number;
    maxProductListings?: number;
    isRecommended?: boolean;
    iconUrl?: string | null;
  }): TierPlan {
    const price = Number(c.priceUsd ?? 0);
    const limit = Number(c.maxProductListings ?? 200) || 200;
    const name = c.name || 'Tier';
    const tagline =
      (c.description || '').trim() ||
      `${name} package — up to ${limit.toLocaleString()} products.`;

    return {
      id: c.id,
      name,
      price,
      badge: c.badgeText || name,
      color: price === 0 ? 'border-slate-300' : price < 1500 ? 'border-amber-400' : 'border-cyan-400',
      tagline,
      productLimit: limit,
      isRecommended: !!c.isRecommended,
      features: [
        `Up to ${limit.toLocaleString()} Products from Warehouse`,
        'Flat 20% Commission on every sale',
        price === 0 ? 'Standard Storefront & Catalog Access' : `${name} Verified Merchant Badge`
      ]
    };
  }

  private applySelectionBadges(source: TierPlan[]): void {
    const currentKey = this.normalize(this.currentTier);
    let currentId: string | null = null;

    for (const p of source) {
      if (this.matchesCurrent(p, currentKey)) {
        currentId = p.id;
        break;
      }
    }

    if (!currentId) {
      const free = source.find((p) => p.price === 0) || source[0];
      currentId = free?.id || null;
    }

    // Only ONE recommended — prefer API flag; if none, no recommended badge
    const recommendedId = source.find((p) => p.isRecommended)?.id || null;

    const withFlags = source.map((p) => ({
      ...p,
      isCurrent: p.id === currentId,
      isRecommended: !!recommendedId && p.id === recommendedId && p.id !== currentId
    }));

    this.plans.set(withFlags);
    this.selectedTierId.set(currentId || withFlags[0]?.id || '');
  }

  private matchesCurrent(plan: TierPlan, currentKey: string): boolean {
    if (!currentKey) return false;
    const name = this.normalize(plan.name);
    const badge = this.normalize(plan.badge);
    return (
      currentKey.includes(name) ||
      name.includes(currentKey) ||
      currentKey.includes(badge) ||
      badge.includes(currentKey) ||
      (currentKey.includes('bronze') && plan.price === 0) ||
      (currentKey.includes('gold') && name.includes('gold')) ||
      (currentKey.includes('diamond') && name.includes('diamond'))
    );
  }

  private normalize(value: string | null | undefined): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  selectPlan(id: string): void {
    this.selectedTierId.set(id);
    this.error.set(null);
  }

  getSelectedPlan(): TierPlan {
    return this.plans().find((p) => p.id === this.selectedTierId()) || this.plans()[0];
  }

  isCurrentSelected(): boolean {
    return !!this.getSelectedPlan()?.isCurrent;
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
    if (!plan) return;
    this.error.set(null);

    if (plan.isCurrent) {
      this.error.set('This is already your current plan. Select a different package to upgrade.');
      return;
    }

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
        receiptUrl: this.receiptPreviewUrl() || undefined,
        categoryId: plan.id
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
