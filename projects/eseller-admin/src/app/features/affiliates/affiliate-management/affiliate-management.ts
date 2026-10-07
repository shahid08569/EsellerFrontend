import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';

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
  readonly affiliates = signal<any[]>([]);
  readonly selectedAffiliate = signal<any | null>(null);
  readonly detailsModalOpen = signal<boolean>(false);

  ngOnInit(): void {
    this.loadAffiliates();
  }

  loadAffiliates(): void {
    this.isLoading.set(true);
    this.adminService.getAffiliates().subscribe({
      next: (list: any[]) => {
        this.affiliates.set(Array.isArray(list) ? list : (list as any)?.items || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.affiliates.set([]);
        this.isLoading.set(false);
      }
    });
  }

  openDetails(affiliate: any): void {
    this.selectedAffiliate.set(affiliate);
    this.detailsModalOpen.set(true);
  }

  closeDetails(): void {
    this.detailsModalOpen.set(false);
    this.selectedAffiliate.set(null);
  }
}
