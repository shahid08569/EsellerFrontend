import { Component, signal, inject, computed, OnInit, OnDestroy } from '@angular/core';
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
  AuthActionService
} from 'eseller-shared';
import { environment } from '../../../../../environments/environment';

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
  readonly categories = signal<CategoryTreeDto[]>([]);
  readonly isCategoriesDropdownOpen = signal<boolean>(false);
  readonly brands = signal<BrandDto[]>([]);
  readonly isBrandsDropdownOpen = signal<boolean>(false);
  readonly currentUrl = signal<string>(this.router.url);

  private routerSub: Subscription | null = null;

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

  // Group categories into columns with max 10 per column
  readonly categoryColumns = computed(() => {
    const list = this.categories();
    const chunkSize = 10;
    const cols: CategoryTreeDto[][] = [];
    for (let i = 0; i < list.length; i += chunkSize) {
      cols.push(list.slice(i, i + chunkSize));
    }
    return cols;
  });

  // Group brands into columns with max 10 per column
  readonly brandColumns = computed(() => {
    const list = this.brands();
    const chunkSize = 10;
    const cols: BrandDto[][] = [];
    for (let i = 0; i < list.length; i += chunkSize) {
      cols.push(list.slice(i, i + chunkSize));
    }
    return cols;
  });

  ngOnInit(): void {
    this.homeService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats)
    });

    this.homeService.getBrands().subscribe({
      next: (bList) => this.brands.set(bList)
    });

    this.routerSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.currentUrl.set(this.router.url);
        this.closeCategoriesDropdown();
        this.closeBrandsDropdown();
        this.closeMobileMenu();
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
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
