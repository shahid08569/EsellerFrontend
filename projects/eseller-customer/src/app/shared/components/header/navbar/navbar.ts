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
  ToastService
} from 'eseller-shared';

@Component({
  imports: [RouterLink],
  selector: 'app-navbar',
  styleUrl: './navbar.css',
  templateUrl: './navbar.html',
})
export class Navbar implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly homeService = inject(HomeService);
  readonly cartService = inject(CartService);
  readonly wishlistService = inject(WishlistService);
  readonly compareService = inject(CompareService);
  readonly authStore = inject(AuthStore);
  private readonly toastService = inject(ToastService);

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

  onLogout(): void {
    this.authStore.clearAuth();
    this.closeUserMenu();
    this.toastService.show('You have been signed out successfully.', 'info');
    this.router.navigateByUrl('/');
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
}
