import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService, SellerReferralDto, ReferredStoreDto } from '../../core/services/seller.service';
import { ToastService, SkeletonLayout } from 'eseller-shared';

import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-referral-center',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
  templateUrl: './referral-center.html'
})
export class ReferralCenter implements OnInit {
  private readonly sellerService = inject(SellerService);
  private readonly toast = inject(ToastService);

  readonly loading = signal<boolean>(true);
  readonly referralData = signal<SellerReferralDto | null>(null);
  readonly copied = signal<boolean>(false);
  readonly searchTerm = signal<string>('');
  readonly statusFilter = signal<string>('all');

  readonly inviteLink = computed(() => {
    const code = this.referralData()?.referralCode;
    if (!code) return '';
    const base = (environment.customerUrl || 'https://www.esellerglobal.com').replace(/\/+$/, '');
    return `${base}/auth/seller-register?ref=${encodeURIComponent(code)}`;
  });

  readonly filteredStores = computed(() => {
    const data = this.referralData();
    if (!data?.referredStores) return [];

    let list = [...data.referredStores];
    const search = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();

    if (search) {
      list = list.filter(s =>
        (s.shopName && s.shopName.toLowerCase().includes(search)) ||
        (s.sellerName && s.sellerName.toLowerCase().includes(search)) ||
        (s.email && s.email.toLowerCase().includes(search)) ||
        (s.shopSlug && s.shopSlug.toLowerCase().includes(search))
      );
    }

    if (status !== 'all') {
      if (status === 'approved') {
        list = list.filter(s => s.isApproved);
      } else if (status === 'pending') {
        list = list.filter(s => !s.isApproved);
      } else if (status === 'active') {
        list = list.filter(s => s.hasListedProducts);
      }
    }

    return list;
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.sellerService.getMyReferrals().subscribe({
      next: (res) => {
        this.referralData.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.show('Failed to load invitation referral data.', 'error');
      }
    });
  }

  copyLink(): void {
    const link = this.inviteLink();
    if (!link) return;

    if (navigator?.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        this.copied.set(true);
        this.toast.show('Invitation link copied to clipboard!', 'success');
        setTimeout(() => this.copied.set(false), 2500);
      }).catch(() => {
        this.fallbackCopy(link);
      });
    } else {
      this.fallbackCopy(link);
    }
  }

  copyCode(): void {
    const code = this.referralData()?.referralCode;
    if (!code) return;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        this.toast.show(`Code ${code} copied!`, 'success');
      });
    }
  }

  private fallbackCopy(text: string): void {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.copied.set(true);
      this.toast.show('Invitation link copied to clipboard!', 'success');
      setTimeout(() => this.copied.set(false), 2500);
    } catch {
      this.toast.show('Unable to copy automatically. Please copy manually.', 'info');
    }
  }
}
