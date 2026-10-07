import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService, SkeletonLayout } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminSettingDto } from '../../../core/models/admin.models';

@Component({
  selector: 'app-platform-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
  templateUrl: './platform-settings.html'
})
export class PlatformSettings implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);

  // Settings State Form
  readonly commissionRate = signal<number>(5);
  readonly affiliateCookieDays = signal<number>(30);
  readonly minWithdrawalThreshold = signal<number>(2000);
  readonly autoApproveProducts = signal<boolean>(false);
  readonly maintenanceMode = signal<boolean>(false);
  readonly supportEmail = signal<string>('support@eseller.com');

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.isLoading.set(true);
    this.adminService.getSettings().subscribe({
      next: (list) => {
        try {
          const settings: any[] = Array.isArray(list) ? list : (list && Array.isArray((list as any).items) ? (list as any).items : []);
          settings.forEach((s: any) => {
            if (s.key === 'CommissionRate' || s.key === 'AffiliateDefaultCommissionRate') this.commissionRate.set(parseFloat(s.value) || 5);
            if (s.key === 'AffiliateCookieDurationDays' || s.key === 'AffiliateAttributionWindowDays') this.affiliateCookieDays.set(parseInt(s.value, 10) || 30);
            if (s.key === 'DefaultWithdrawalThreshold' || s.key === 'AffiliateMinimumWithdrawal') this.minWithdrawalThreshold.set(parseFloat(s.value) || 2000);
            if (s.key === 'RequireProductApproval') {
              this.autoApproveProducts.set(s.value?.toLowerCase() === 'false');
            } else if (s.key === 'AutoApproveProducts') {
              this.autoApproveProducts.set(s.value === 'true' || s.isActive === true);
            }
            if (s.key === 'MaintenanceMode') this.maintenanceMode.set(s.value === 'true' || s.isActive === true);
            if (s.key === 'PlatformContactEmail') this.supportEmail.set(s.value || 'support@eseller.com');
          });
        } finally {
          this.isLoading.set(false);
        }
      },
      error: () => this.isLoading.set(false)
    });
  }

  saveAllSettings(): void {
    this.isSaving.set(true);
    const autoApprove = this.autoApproveProducts();
    const updates = [
      { key: 'CommissionRate', value: this.commissionRate().toString(), isActive: true },
      { key: 'AffiliateCookieDurationDays', value: this.affiliateCookieDays().toString(), isActive: true },
      { key: 'DefaultWithdrawalThreshold', value: this.minWithdrawalThreshold().toString(), isActive: true },
      { key: 'AutoApproveProducts', value: autoApprove.toString(), isActive: autoApprove },
      { key: 'RequireProductApproval', value: (!autoApprove).toString(), isActive: !autoApprove },
      { key: 'MaintenanceMode', value: this.maintenanceMode().toString(), isActive: this.maintenanceMode() },
      { key: 'PlatformContactEmail', value: this.supportEmail(), isActive: true }
    ];

    let pending = updates.length;
    let hasError = false;

    updates.forEach(u => {
      this.adminService.updateSetting(u.key, { value: u.value, isActive: u.isActive }).subscribe({
        next: () => {
          pending--;
          if (pending === 0) {
            this.isSaving.set(false);
            if (!hasError) {
              this.toast.show('Platform configuration saved successfully', 'success');
              this.loadSettings();
            }
          }
        },
        error: () => {
          hasError = true;
          pending--;
          if (pending === 0) {
            this.isSaving.set(false);
            this.toast.show('Saved with some warnings', 'info');
          }
        }
      });
    });
  }
}
