import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { HomeService, PlatformBrandingDto, resolveMediaUrl } from 'eseller-shared';
import { environment } from '../../../environments/environment';
import { catchError, of, tap } from 'rxjs';

const DEFAULT_TITLE = 'EsellerGlobal';
const DEFAULT_DESCRIPTION =
  'Shop Without Borders on EsellerGlobal — multi-vendor marketplace for electronics, fashion, and more from verified merchants worldwide.';

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
              navLogoUrl: '/brand/eseller-mark.svg',
              footerLogoUrl: '/brand/eseller-mark.svg',
              tagline: 'Shop Without Borders',
              siteTitle: DEFAULT_TITLE,
              metaDescription: DEFAULT_DESCRIPTION,
              faviconUrl: '/favicon.svg'
            });
            return of(null);
          })
        )
        .subscribe({ complete: () => resolve() });
    });
  }

  apply(b: PlatformBrandingDto): void {
    const siteTitle = (b.siteTitle || DEFAULT_TITLE).trim() || DEFAULT_TITLE;
    const description =
      (b.metaDescription || DEFAULT_DESCRIPTION).trim() || DEFAULT_DESCRIPTION;
    const faviconRaw = (b.faviconUrl || b.navLogoUrl || '/favicon.svg').trim();
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

    this.setFavicon(faviconAbs);
  }

  private toAbsoluteUrl(raw: string): string {
    const resolved = resolveMediaUrl(raw) || raw;
    if (!resolved) return `${environment.customerUrl}/favicon.svg`;
    if (resolved.startsWith('http://') || resolved.startsWith('https://') || resolved.startsWith('data:')) {
      return resolved;
    }
    if (resolved.startsWith('/')) {
      // Brand assets live on the customer origin; uploads often on API host via resolveMediaUrl
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
    const head = this.doc.head;
    if (!head) return;

    const selectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]'
    ];
    for (const sel of selectors) {
      head.querySelectorAll(sel).forEach((el) => el.parentElement?.removeChild(el));
    }

    const icon = this.doc.createElement('link');
    icon.setAttribute('rel', 'icon');
    icon.setAttribute('type', href.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
    icon.setAttribute('href', `${href}${href.includes('?') ? '&' : '?'}v=${Date.now()}`);
    head.appendChild(icon);

    const apple = this.doc.createElement('link');
    apple.setAttribute('rel', 'apple-touch-icon');
    apple.setAttribute('href', href);
    head.appendChild(apple);
  }
}
