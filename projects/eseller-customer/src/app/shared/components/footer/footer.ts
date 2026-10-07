import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthActionService, HomeService, resolveMediaUrl } from 'eseller-shared';

const DEFAULT_FOOTER_LOGO = '/brand/eseller-global-logo.png';

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
  readonly canShop = () => this.authAction.canShop();

  ngOnInit(): void {
    this.homeService.getPlatformBranding().subscribe({
      next: (b) => {
        const raw = (b.footerLogoUrl || DEFAULT_FOOTER_LOGO).trim();
        const resolved = raw.startsWith('/brand/') ? raw : (resolveMediaUrl(raw) || DEFAULT_FOOTER_LOGO);
        this.footerLogoSrc.set(resolved);
      }
    });
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
