import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, ToastService, SkeletonLayout, resolveMediaUrl } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';

const KEY_NAV = 'Branding.NavLogoUrl';
const KEY_FOOTER = 'Branding.FooterLogoUrl';
const KEY_TAGLINE = 'Branding.Tagline';
const KEY_SITE_TITLE = 'Branding.SiteTitle';
const KEY_META_DESC = 'Branding.MetaDescription';
const KEY_FACEBOOK = 'Social.FacebookUrl';
const KEY_TWITTER = 'Social.TwitterUrl';
const KEY_INSTAGRAM = 'Social.InstagramUrl';
const KEY_YOUTUBE = 'Social.YoutubeUrl';
const KEY_LINKEDIN = 'Social.LinkedinUrl';
const KEY_WHATSAPP = 'Social.WhatsappUrl';

const DEFAULT_NAV = '/brand/eseller-global-nav.png';
const DEFAULT_FOOTER = '/brand/eseller-global-logo.png';
const DEFAULT_TAGLINE = 'Shop Without Borders';
const DEFAULT_SITE_TITLE =
  'eSeller Global — Shop Without Borders | Multi-Vendor Marketplace';
const DEFAULT_META_DESC =
  'Shop Without Borders on eSeller Global — premier multi-vendor marketplace for electronics, fashion, lifestyle, and home products from verified merchants worldwide.';

@Component({
  selector: 'app-platform-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
  templateUrl: './platform-settings.html'
})
export class PlatformSettings implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);
  readonly isUploadingNav = signal<boolean>(false);
  readonly isUploadingFooter = signal<boolean>(false);

  readonly currentPassword = signal<string>('');
  readonly newPassword = signal<string>('');
  readonly confirmPassword = signal<string>('');
  readonly isChangingPassword = signal<boolean>(false);

  // Settings State Form
  readonly commissionRate = signal<number>(5);
  readonly affiliateCookieDays = signal<number>(30);
  readonly minWithdrawalThreshold = signal<number>(2000);
  readonly autoApproveProducts = signal<boolean>(false);
  readonly maintenanceMode = signal<boolean>(false);
  readonly supportEmail = signal<string>('support@eseller.com');

  // Branding (Management can change nav + footer logos)
  readonly navLogoUrl = signal<string>(DEFAULT_NAV);
  readonly footerLogoUrl = signal<string>(DEFAULT_FOOTER);
  readonly brandingTagline = signal<string>(DEFAULT_TAGLINE);
  readonly siteTitle = signal<string>(DEFAULT_SITE_TITLE);
  readonly metaDescription = signal<string>(DEFAULT_META_DESC);

  // Social Links
  readonly facebookUrl = signal<string>('https://facebook.com');
  readonly twitterUrl = signal<string>('https://x.com');
  readonly instagramUrl = signal<string>('https://instagram.com');
  readonly youtubeUrl = signal<string>('https://youtube.com');
  readonly linkedinUrl = signal<string>('https://linkedin.com');
  readonly whatsappUrl = signal<string>('');
  readonly isSavingSocial = signal<boolean>(false);

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
            if (s.key === KEY_SITE_TITLE && s.value) this.siteTitle.set(s.value);
            if (s.key === KEY_META_DESC && s.value) this.metaDescription.set(s.value);
            if (s.key === KEY_FACEBOOK && s.value) this.facebookUrl.set(s.value);
            if (s.key === KEY_TWITTER && s.value) this.twitterUrl.set(s.value);
            if (s.key === KEY_INSTAGRAM && s.value) this.instagramUrl.set(s.value);
            if (s.key === KEY_YOUTUBE && s.value) this.youtubeUrl.set(s.value);
            if (s.key === KEY_LINKEDIN && s.value) this.linkedinUrl.set(s.value);
            if (s.key === KEY_WHATSAPP && s.value) this.whatsappUrl.set(s.value);
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

  saveSeoBranding(): void {
    const title = (this.siteTitle() || DEFAULT_SITE_TITLE).trim() || DEFAULT_SITE_TITLE;
    const desc = (this.metaDescription() || DEFAULT_META_DESC).trim() || DEFAULT_META_DESC;
    if (desc.length < 50) {
      this.toast.show('Meta description should be at least ~50 characters for Google.', 'error');
      return;
    }
    if (desc.length > 320) {
      this.toast.show('Keep meta description under 320 characters.', 'error');
      return;
    }
    let pending = 2;
    let failed = false;
    const done = () => {
      pending--;
      if (pending > 0) return;
      if (failed) this.toast.show('SEO save failed', 'error');
      else {
        this.siteTitle.set(title);
        this.metaDescription.set(desc);
        this.toast.show('Google title & description saved. Favicon uses Navbar logo.', 'success');
      }
    };
    this.adminService.updateSetting(KEY_SITE_TITLE, { value: title, isActive: true }).subscribe({
      next: () => done(),
      error: () => { failed = true; done(); }
    });
    this.adminService.updateSetting(KEY_META_DESC, { value: desc, isActive: true }).subscribe({
      next: () => done(),
      error: () => { failed = true; done(); }
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
      { key: KEY_TAGLINE, value: (this.brandingTagline() || DEFAULT_TAGLINE).trim() || DEFAULT_TAGLINE, isActive: true },
      { key: KEY_SITE_TITLE, value: (this.siteTitle() || DEFAULT_SITE_TITLE).trim() || DEFAULT_SITE_TITLE, isActive: true },
      { key: KEY_META_DESC, value: (this.metaDescription() || DEFAULT_META_DESC).trim() || DEFAULT_META_DESC, isActive: true }
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

  changePassword(): void {
    const cur = this.currentPassword().trim();
    const next = this.newPassword().trim();
    const conf = this.confirmPassword().trim();

    if (!cur || !next || !conf) {
      this.toast.show('Please fill in all password fields.', 'error');
      return;
    }
    if (next !== conf) {
      this.toast.show('New password and confirmation do not match.', 'error');
      return;
    }
    if (next.length < 6) {
      this.toast.show('Password must be at least 6 characters.', 'error');
      return;
    }

    this.isChangingPassword.set(true);
    this.authService.changePassword({ currentPassword: cur, newPassword: next }).subscribe({
      next: (res) => {
        this.isChangingPassword.set(false);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.toast.show(res?.message || 'Password updated successfully.', 'success');
      },
      error: (err) => {
        this.isChangingPassword.set(false);
        this.toast.show(err?.error?.error || 'Failed to update password.', 'error');
      }
    });
  }

  saveSocialLinks(): void {
    this.isSavingSocial.set(true);
    const list = [
      { key: KEY_FACEBOOK, val: this.facebookUrl().trim() },
      { key: KEY_TWITTER, val: this.twitterUrl().trim() },
      { key: KEY_INSTAGRAM, val: this.instagramUrl().trim() },
      { key: KEY_YOUTUBE, val: this.youtubeUrl().trim() },
      { key: KEY_LINKEDIN, val: this.linkedinUrl().trim() },
      { key: KEY_WHATSAPP, val: this.whatsappUrl().trim() }
    ];

    let pending = list.length;
    let failed = false;

    list.forEach(item => {
      this.adminService.updateSetting(item.key, { value: item.val, isActive: true }).subscribe({
        next: () => {
          pending--;
          if (pending === 0) {
            this.isSavingSocial.set(false);
            if (!failed) this.toast.show('Footer social media links saved successfully', 'success');
          }
        },
        error: () => {
          failed = true;
          pending--;
          if (pending === 0) {
            this.isSavingSocial.set(false);
            this.toast.show('Some social media links failed to save', 'error');
          }
        }
      });
    });
  }
}
