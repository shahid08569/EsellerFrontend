import {
  Component,
  signal,
  inject,
  computed,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  HostListener,
  ElementRef,
  viewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import {
  HomeService,
  CategoryTreeDto,
  BrandDto,
  CartService,
  WishlistService,
  CompareService,
  AuthStore,
  AuthService,
  ToastService,
  AuthActionService,
  resolveMediaUrl
} from 'eseller-shared';
import { environment } from '../../../../../environments/environment';
import { isCuratedBrand } from '../../../../features/home/components/catalog-media';

const DEFAULT_NAV_LOGO = '/brand/eseller-global-nav.png?v=orange3';
const DEFAULT_TAGLINE = 'Shop Without Borders';
/** Max items shown in mega menus; rest via View All. */
const MEGA_MENU_MAX_ITEMS = 24;
/** Items per column inside mega menus. */
const MEGA_MENU_PER_COL = 8;

@Component({
  imports: [RouterLink],
  selector: 'app-navbar',
  styleUrl: './navbar.css',
  templateUrl: './navbar.html',
})
export class Navbar implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly homeService = inject(HomeService);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  readonly cartService = inject(CartService);
  readonly wishlistService = inject(WishlistService);
  readonly compareService = inject(CompareService);
  readonly authStore = inject(AuthStore);
  private readonly toastService = inject(ToastService);
  private readonly authAction = inject(AuthActionService);
  readonly sellerUrl = environment.sellerUrl;
  readonly adminUrl = environment.adminUrl;

  /** Signed-in customer — used to show Orders and allow commerce pages. */
  readonly canShop = () => this.authAction.canShop();

  readonly mobileMenuOpen = signal(false);
  /** Desktop: pin nav strip to viewport after chrome scrolls away. */
  readonly navPinned = signal(false);
  readonly navStripHeight = signal(48);
  readonly categories = signal<CategoryTreeDto[]>([]);
  readonly isCategoriesDropdownOpen = signal<boolean>(false);
  readonly brands = signal<BrandDto[]>([]);
  readonly isBrandsDropdownOpen = signal<boolean>(false);
  readonly currentUrl = signal<string>(this.router.url);
  readonly navLogoSrc = signal<string>(DEFAULT_NAV_LOGO);
  readonly brandingTagline = signal<string>(DEFAULT_TAGLINE);

  private readonly desktopChrome = viewChild<ElementRef<HTMLElement>>('desktopChrome');
  private readonly desktopNav = viewChild<ElementRef<HTMLElement>>('desktopNav');
  private routerSub: Subscription | null = null;
  private pinningRaf = 0;

  readonly isCategoriesActive = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/categories');
  });

  readonly isBrandsActive = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/brands');
  });

  readonly isBlogsActive = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/blogs');
  });

  readonly isAllProductsActive = computed(() => {
    const url = this.currentUrl();
    return url === '/products' || (url.startsWith('/products') && !this.isCategoriesActive());
  });

  readonly categoryPreview = computed(() => this.categories().slice(0, MEGA_MENU_MAX_ITEMS));
  readonly brandPreview = computed(() => this.brands().slice(0, MEGA_MENU_MAX_ITEMS));
  readonly categoriesHaveMore = computed(() => this.categories().length > MEGA_MENU_MAX_ITEMS);
  readonly brandsHaveMore = computed(() => this.brands().length > MEGA_MENU_MAX_ITEMS);

  readonly categoryColumns = computed(() => this.chunkColumns(this.categoryPreview(), MEGA_MENU_PER_COL));
  readonly brandColumns = computed(() => this.chunkColumns(this.brandPreview(), MEGA_MENU_PER_COL));

  private chunkColumns<T>(list: T[], chunkSize: number): T[][] {
    const cols: T[][] = [];
    for (let i = 0; i < list.length; i += chunkSize) {
      cols.push(list.slice(i, i + chunkSize));
    }
    return cols;
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.pinningRaf) cancelAnimationFrame(this.pinningRaf);
    this.pinningRaf = requestAnimationFrame(() => this.updateNavPin());
  }

  private updateNavPin(): void {
    const chrome = this.desktopChrome()?.nativeElement;
    const nav = this.desktopNav()?.nativeElement;
    if (!chrome || !nav || window.innerWidth < 768) {
      this.navPinned.set(false);
      return;
    }
    const h = nav.offsetHeight || 48;
    if (h > 0) this.navStripHeight.set(h);
    // Pin when desktop chrome has scrolled fully above the viewport
    this.navPinned.set(chrome.getBoundingClientRect().bottom <= 0);
  }

  ngOnInit(): void {
    this.homeService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats)
    });

    this.homeService.getBrands().subscribe({
      next: (bList) => this.brands.set((bList || []).filter((b) => isCuratedBrand(b.name, b.slug, b.logoUrl)))
    });

    this.homeService.getPlatformBranding().subscribe({
      next: (b) => {
        const raw = (b.navLogoUrl || DEFAULT_NAV_LOGO).trim();
        let resolved = raw.startsWith('/brand/') ? raw : (resolveMediaUrl(raw) || DEFAULT_NAV_LOGO);
        // Cache-bust local brand assets so orange logo updates show immediately
        if (resolved.startsWith('/brand/') && !resolved.includes('?')) {
          resolved = `${resolved}?v=orange3`;
        }
        this.navLogoSrc.set(resolved);
        this.brandingTagline.set((b.tagline || DEFAULT_TAGLINE).trim() || DEFAULT_TAGLINE);
      }
    });

    this.routerSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.currentUrl.set(this.router.url);
        this.closeCategoriesDropdown();
        this.closeBrandsDropdown();
        this.closeMobileMenu();
        queueMicrotask(() => this.updateNavPin());
      });

    queueMicrotask(() => this.updateNavPin());
  }

  onNavLogoError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img && img.src !== DEFAULT_NAV_LOGO && !img.src.endsWith(DEFAULT_NAV_LOGO)) {
      img.src = DEFAULT_NAV_LOGO;
    }
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    if (this.pinningRaf) cancelAnimationFrame(this.pinningRaf);
  }

  openCategoriesDropdown(): void {
    this.isCategoriesDropdownOpen.set(true);
  }

  closeCategoriesDropdown(): void {
    this.isCategoriesDropdownOpen.set(false);
  }

  openBrandsDropdown(): void {
    this.isBrandsDropdownOpen.set(true);
  }

  closeBrandsDropdown(): void {
    this.isBrandsDropdownOpen.set(false);
  }

  readonly isUserMenuOpen = signal<boolean>(false);

  readonly userInitial = computed(() => {
    const acc = this.authStore.currentAccount();
    if (!acc?.username) return 'U';
    return acc.username.charAt(0).toUpperCase();
  });

  toggleUserMenu(): void {
    this.isUserMenuOpen.update((v) => !v);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  readonly logoutModalOpen = signal(false);

  openLogoutModal(): void {
    this.closeUserMenu();
    this.closeMobileMenu();
    this.logoutModalOpen.set(true);
  }

  cancelLogout(): void {
    this.logoutModalOpen.set(false);
  }

  /** Opens confirm popup — actual sign-out runs from confirmLogout(). */
  onLogout(): void {
    this.openLogoutModal();
  }

  confirmLogout(): void {
    this.logoutModalOpen.set(false);
    this.authService.logout().subscribe({
      next: () => {
        this.authStore.clearAuth();
        this.toastService.show('You have been signed out successfully.', 'info');
        this.router.navigate(['/auth/login'], { queryParams: { logout: 'true' } });
      },
      error: () => {
        this.authStore.clearAuth();
        this.toastService.show('You have been signed out successfully.', 'info');
        this.router.navigate(['/auth/login'], { queryParams: { logout: 'true' } });
      }
    });
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  onSearch(query: string): void {
    const trimmed = query.trim();
    if (trimmed) {
      this.closeMobileMenu();
      this.router.navigate(['/products'], { queryParams: { search: trimmed } });
    }
  }

  /**
   * Compare / Wishlist / Cart: visible to visitors, but click → login
   * with returnUrl set to the destination page.
   */
  onProtectedNav(event: Event, path: string, actionLabel: string): void {
    this.closeMobileMenu();
    if (this.authAction.canShop()) return;
    event.preventDefault();
    this.authAction.requireLoginFor(path, actionLabel);
  }
}
