import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { HomeService, PlatformBrandingDto, resolveMediaUrl } from 'eseller-shared';
import { environment } from '../../../environments/environment';
import { catchError, of, tap } from 'rxjs';

const DEFAULT_TITLE = 'eSeller Global — Shop Without Borders | Multi-Vendor Marketplace';
const DEFAULT_DESCRIPTION =
  'Shop Without Borders on eSeller Global — premier multi-vendor marketplace for electronics, fashion, lifestyle, and home products from verified merchants worldwide.';

/**
 * Applies SuperAdmin branding (site title, meta description, favicon from nav logo)
 * so Google/social previews match the live storefront.
 */
@Injectable({ providedIn: 'root' })
export class SeoBrandingService {
  private readonly doc = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly home = inject(HomeService);

  /** Load branding once and write &lt;title&gt;, meta, favicon. */
  bootstrap(): Promise<void> {
    return new Promise((resolve) => {
      this.home
        .getPlatformBranding(true)
        .pipe(
          tap((b) => this.apply(b)),
          catchError(() => {
            this.apply({
              navLogoUrl: '/brand/eseller-global-nav.png',
              footerLogoUrl: '/brand/eseller-global-logo.png',
              tagline: 'Shop Without Borders',
              siteTitle: DEFAULT_TITLE,
              metaDescription: DEFAULT_DESCRIPTION,
              faviconUrl: '/favicon.ico'
            });
            return of(null);
          })
        )
        .subscribe({ complete: () => resolve() });
    });
  }

  apply(b: PlatformBrandingDto): void {
    const rawTitle = (b.siteTitle || '').trim();
    const siteTitle = (!rawTitle || rawTitle === 'EsellerGlobal' || rawTitle === 'Eseller — Home')
      ? DEFAULT_TITLE
      : rawTitle;
    const description =
      (b.metaDescription || DEFAULT_DESCRIPTION).trim() || DEFAULT_DESCRIPTION;
    const faviconRaw = (b.faviconUrl || b.navLogoUrl || '/favicon.ico').trim();
    const faviconAbs = this.toAbsoluteUrl(faviconRaw);
    const logoAbs = this.toAbsoluteUrl(b.navLogoUrl || faviconRaw);
    const pageUrl = environment.customerUrl || (typeof window !== 'undefined' ? window.location.origin : '');

    this.title.setTitle(siteTitle);

    this.upsertMeta('name', 'description', description);
    this.upsertMeta('name', 'application-name', siteTitle);
    this.upsertMeta('property', 'og:type', 'website');
    this.upsertMeta('property', 'og:site_name', siteTitle);
    this.upsertMeta('property', 'og:title', siteTitle);
    this.upsertMeta('property', 'og:description', description);
    this.upsertMeta('property', 'og:url', pageUrl);
    this.upsertMeta('property', 'og:image', logoAbs);
    this.upsertMeta('name', 'twitter:card', 'summary');
    this.upsertMeta('name', 'twitter:title', siteTitle);
    this.upsertMeta('name', 'twitter:description', description);
    this.upsertMeta('name', 'twitter:image', logoAbs);

    // Only override static index.html favicons if a distinct, dedicated square favicon URL is configured
    if (b.faviconUrl && b.faviconUrl.trim() && !b.faviconUrl.includes('eseller-global-nav')) {
      const faviconAbs = this.toAbsoluteUrl(b.faviconUrl.trim());
      this.setFavicon(faviconAbs);
    }
  }

  private toAbsoluteUrl(raw: string): string {
    const resolved = resolveMediaUrl(raw) || raw;
    if (!resolved) return `${environment.customerUrl}/favicon.ico`;
    if (resolved.startsWith('http://') || resolved.startsWith('https://') || resolved.startsWith('data:')) {
      return resolved;
    }
    if (resolved.startsWith('/')) {
      if (resolved.startsWith('/brand/') || resolved.startsWith('/favicon')) {
        return `${environment.customerUrl.replace(/\/$/, '')}${resolved}`;
      }
      return `${environment.customerUrl.replace(/\/$/, '')}${resolved}`;
    }
    return resolved;
  }

  private upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
    const selector = attr === 'name' ? `name="${key}"` : `property="${key}"`;
    if (this.meta.getTag(selector)) {
      this.meta.updateTag({ [attr]: key, content });
    } else {
      this.meta.addTag({ [attr]: key, content });
    }
  }

  private setFavicon(href: string): void {
    if (
      !href ||
      href.includes('eseller-global-nav') ||
      href.includes('eseller-mark.svg') ||
      href.endsWith('/favicon.ico') ||
      href === '/favicon.ico'
    ) {
      return;
    }
    const head = this.doc.head;
    if (!head) return;

    // Gracefully update existing link element without deleting other sizes or adding timestamp jitter
    const icon = head.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (icon) {
      icon.href = href;
    }
  }
}
