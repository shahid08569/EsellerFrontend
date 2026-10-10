import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AuthActionService,
  HomeService,
  PaymentShowcaseLogoDto,
  resolveMediaUrl
} from 'eseller-shared';

const DEFAULT_FOOTER_LOGO = '/brand/eseller-global-logo.png?v=orange3';

export interface SocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  youtube?: string;
  linkedin?: string;
  whatsapp?: string;
}

@Component({
  imports: [RouterLink],
  selector: 'app-footer',
  styleUrl: './footer.css',
  templateUrl: './footer.html',
})
export class Footer implements OnInit {
  private readonly authAction = inject(AuthActionService);
  private readonly homeService = inject(HomeService);

  readonly footerLogoSrc = signal<string>(DEFAULT_FOOTER_LOGO);
  readonly currentYear = signal<number>(new Date().getFullYear());
  readonly paymentLogos = signal<PaymentShowcaseLogoDto[]>([]);
  readonly topCategories = signal<{ name: string; slug: string }[]>([]);
  readonly socialLinks = signal<SocialLinks>({
    facebook: 'https://facebook.com',
    twitter: 'https://x.com',
    instagram: 'https://instagram.com',
    youtube: 'https://youtube.com',
    linkedin: 'https://linkedin.com',
    whatsapp: ''
  });

  readonly canShop = () => this.authAction.canShop();

  ngOnInit(): void {
    // 1. Branding & Social Links from SuperAdmin Platform Settings
    this.homeService.getPlatformBranding().subscribe({
      next: (b) => {
        const raw = (b.footerLogoUrl || DEFAULT_FOOTER_LOGO).trim();
        let resolved = raw.startsWith('/brand/') ? raw : (resolveMediaUrl(raw) || DEFAULT_FOOTER_LOGO);
        if (resolved.startsWith('/brand/') && !resolved.includes('?')) {
          resolved = `${resolved}?v=orange3`;
        }
        this.footerLogoSrc.set(resolved);

        this.socialLinks.set({
          facebook: b.facebookUrl || 'https://facebook.com',
          twitter: b.twitterUrl || 'https://x.com',
          instagram: b.instagramUrl || 'https://instagram.com',
          youtube: b.youtubeUrl || 'https://youtube.com',
          linkedin: b.linkedinUrl || 'https://linkedin.com',
          whatsapp: b.whatsappUrl || ''
        });
      }
    });

    // 2. Dynamic Payment Showcase Logos uploaded by SuperAdmin
    this.homeService.getPaymentShowcaseLogos().subscribe({
      next: (logos) => {
        const active = (logos || [])
          .filter((l) => l.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        this.paymentLogos.set(active);
      }
    });

    // 3. Dynamic Categories for Column 1
    this.homeService.getCategories().subscribe({
      next: (cats) => {
        if (cats && cats.length > 0) {
          const list = cats.slice(0, 6).map((c) => ({
            name: c.name,
            slug: c.slug
          }));
          this.topCategories.set(list);
        } else {
          this.setFallbackCategories();
        }
      },
      error: () => {
        this.setFallbackCategories();
      }
    });
  }

  private setFallbackCategories(): void {
    this.topCategories.set([
      { name: 'Elektronik & Bilgisayar', slug: 'electronics' },
      { name: 'Moda & Giyim', slug: 'fashion' },
      { name: 'Ayakkabı & Çanta', slug: 'shoes-bags' },
      { name: 'Saat & Takı', slug: 'jewelry-watches' },
      { name: 'Ev & Yaşam', slug: 'home-living' },
      { name: 'Kozmetik & Kişisel Bakım', slug: 'beauty-health' }
    ]);
  }

  resolveMedia(url?: string | null): string {
    return resolveMediaUrl(url || '') || '';
  }

  onFooterLogoError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img && !img.src.endsWith(DEFAULT_FOOTER_LOGO)) {
      img.src = DEFAULT_FOOTER_LOGO;
    }
  }

  onProtectedNav(event: Event, path: string, actionLabel: string): void {
    if (this.authAction.canShop()) return;
    event.preventDefault();
    this.authAction.requireLoginFor(path, actionLabel);
  }
}
