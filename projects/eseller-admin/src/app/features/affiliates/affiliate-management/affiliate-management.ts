import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminAffiliateDto, AdminAffiliateDetailDto } from '../../../core/models/admin.models';

@Component({
  selector: 'app-affiliate-management',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
  templateUrl: './affiliate-management.html'
})
export class AffiliateManagement implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly affiliates = signal<AdminAffiliateDto[]>([]);
  readonly selectedAffiliate = signal<AdminAffiliateDto | null>(null);
  readonly affiliateDetails = signal<AdminAffiliateDetailDto | null>(null);
  readonly isLoadingDetails = signal<boolean>(false);
  readonly detailsModalOpen = signal<boolean>(false);

  ngOnInit(): void {
    this.loadAffiliates();
  }

  loadAffiliates(): void {
    this.isLoading.set(true);
    this.adminService.getAffiliates().subscribe({
      next: (list) => {
        this.affiliates.set(list || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.affiliates.set([]);
        this.isLoading.set(false);
      }
    });
  }

  openDetails(affiliate: AdminAffiliateDto): void {
    this.selectedAffiliate.set(affiliate);
    this.detailsModalOpen.set(true);
    this.isLoadingDetails.set(true);
    this.affiliateDetails.set(null);

    this.adminService.getAffiliateDetails(affiliate.id).subscribe({
      next: (details) => {
        this.affiliateDetails.set(details);
        this.isLoadingDetails.set(false);
      },
      error: () => {
        this.isLoadingDetails.set(false);
        this.toast.show('Could not load affiliate referral details', 'error');
      }
    });
  }

  closeDetails(): void {
    this.detailsModalOpen.set(false);
    this.selectedAffiliate.set(null);
    this.affiliateDetails.set(null);
  }
}
