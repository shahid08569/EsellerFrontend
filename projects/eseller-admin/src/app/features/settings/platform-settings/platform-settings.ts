import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService, SkeletonLayout, resolveMediaUrl } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';

const KEY_NAV = 'Branding.NavLogoUrl';
const KEY_FOOTER = 'Branding.FooterLogoUrl';
const KEY_TAGLINE = 'Branding.Tagline';
const DEFAULT_NAV = '/brand/eseller-global-nav.png';
const DEFAULT_FOOTER = '/brand/eseller-global-logo.png';
const DEFAULT_TAGLINE = 'Shop Without Borders';

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
  readonly isUploadingNav = signal<boolean>(false);
  readonly isUploadingFooter = signal<boolean>(false);

  // Settings State Form
  readonly commissionRate = signal<number>(5);
  readonly affiliateCookieDays = signal<number>(30);
  readonly minWithdrawalThreshold = signal<number>(2000);
  readonly autoApproveProducts = signal<boolean>(false);
  readonly maintenanceMode = signal<boolean>(false);
  readonly supportEmail = signal<string>('support@eseller.com');

  // Branding (SuperAdmin can change nav + footer logos)
  readonly navLogoUrl = signal<string>(DEFAULT_NAV);
  readonly footerLogoUrl = signal<string>(DEFAULT_FOOTER);
  readonly brandingTagline = signal<string>(DEFAULT_TAGLINE);

  ngOnInit(): void {
    this.loadSettings();
  }

  previewUrl(url: string): string {
    const raw = (url || '').trim();
    if (!raw) return DEFAULT_FOOTER;
    if (raw.startsWith('/brand/') || raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
    return resolveMediaUrl(raw) || raw;
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
            if (s.key === KEY_NAV && s.value) this.navLogoUrl.set(s.value);
            if (s.key === KEY_FOOTER && s.value) this.footerLogoUrl.set(s.value);
            if (s.key === KEY_TAGLINE && s.value) this.brandingTagline.set(s.value);
          });
        } finally {
          this.isLoading.set(false);
        }
      },
      error: () => this.isLoading.set(false)
    });
  }

  onNavLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.isUploadingNav.set(true);
    this.adminService.uploadAdminMedia(file, 'branding').subscribe({
      next: (res) => {
        const url = res.imageUrl || res.logoUrl || '';
        if (!url) {
          this.isUploadingNav.set(false);
          this.toast.show('Nav logo upload failed — empty URL', 'error');
          return;
        }
        this.adminService.updateSetting(KEY_NAV, { value: url, isActive: true }).subscribe({
          next: () => {
            this.navLogoUrl.set(url);
            this.isUploadingNav.set(false);
            this.toast.show('Navbar logo updated', 'success');
            input.value = '';
          },
          error: () => {
            this.isUploadingNav.set(false);
            this.toast.show('Upload ok but saving setting failed', 'error');
          }
        });
      },
      error: () => {
        this.isUploadingNav.set(false);
        this.toast.show('Nav logo upload failed', 'error');
      }
    });
  }

  onFooterLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.isUploadingFooter.set(true);
    this.adminService.uploadAdminMedia(file, 'branding').subscribe({
      next: (res) => {
        const url = res.imageUrl || res.logoUrl || '';
        if (!url) {
          this.isUploadingFooter.set(false);
          this.toast.show('Footer logo upload failed — empty URL', 'error');
          return;
        }
        this.adminService.updateSetting(KEY_FOOTER, { value: url, isActive: true }).subscribe({
          next: () => {
            this.footerLogoUrl.set(url);
            this.isUploadingFooter.set(false);
            this.toast.show('Footer logo updated', 'success');
            input.value = '';
          },
          error: () => {
            this.isUploadingFooter.set(false);
            this.toast.show('Upload ok but saving setting failed', 'error');
          }
        });
      },
      error: () => {
        this.isUploadingFooter.set(false);
        this.toast.show('Footer logo upload failed', 'error');
      }
    });
  }

  saveBrandingTagline(): void {
    const tagline = (this.brandingTagline() || DEFAULT_TAGLINE).trim() || DEFAULT_TAGLINE;
    this.adminService.updateSetting(KEY_TAGLINE, { value: tagline, isActive: true }).subscribe({
      next: () => {
        this.brandingTagline.set(tagline);
        this.toast.show('Tagline saved', 'success');
      },
      error: () => this.toast.show('Failed to save tagline', 'error')
    });
  }

  resetNavLogo(): void {
    this.adminService.updateSetting(KEY_NAV, { value: DEFAULT_NAV, isActive: true }).subscribe({
      next: () => {
        this.navLogoUrl.set(DEFAULT_NAV);
        this.toast.show('Navbar logo reset to default', 'success');
      },
      error: () => this.toast.show('Reset failed', 'error')
    });
  }

  resetFooterLogo(): void {
    this.adminService.updateSetting(KEY_FOOTER, { value: DEFAULT_FOOTER, isActive: true }).subscribe({
      next: () => {
        this.footerLogoUrl.set(DEFAULT_FOOTER);
        this.toast.show('Footer logo reset to default', 'success');
      },
      error: () => this.toast.show('Reset failed', 'error')
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
      { key: 'PlatformContactEmail', value: this.supportEmail(), isActive: true },
      { key: KEY_TAGLINE, value: (this.brandingTagline() || DEFAULT_TAGLINE).trim() || DEFAULT_TAGLINE, isActive: true }
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
