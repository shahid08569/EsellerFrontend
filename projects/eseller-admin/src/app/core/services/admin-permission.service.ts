import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap, map, catchError, shareReplay } from 'rxjs';
import { AuthStore } from 'eseller-shared';
import { environment } from '../../../environments/environment';

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: string;
  isConfidential?: boolean;
}

export const PLATFORM_PERMISSIONS: PermissionDefinition[] = [
  // 1. Orders Management
  {
    key: 'orders:view',
    label: 'View Orders',
    description: 'Access platform orders directory and customer order details',
    category: 'Orders & Fulfillment'
  },
  {
    key: 'orders:manage',
    label: 'Manage & Dispatch Orders',
    description: 'Update order statuses, dispatch, mark delivered, or cancel orders',
    category: 'Orders & Fulfillment'
  },
  {
    key: 'orders:place',
    label: 'Place Orders to Merchant',
    description: 'Manually inject/place orders directly to merchant shops (Confidential authority)',
    category: 'Orders & Fulfillment',
    isConfidential: true
  },

  // 2. Traffic & Analytics
  {
    key: 'traffic:view',
    label: 'View Traffic Analytics',
    description: 'View merchant store visits, traffic timelines, and organic statistics',
    category: 'Traffic & Visitor Analytics'
  },
  {
    key: 'traffic:manage',
    label: 'Adjust & Distribute Traffic',
    description: 'Manually allocate daily/monthly visitors and adjust traffic counts (Confidential authority)',
    category: 'Traffic & Visitor Analytics',
    isConfidential: true
  },

  // 3. Products & Catalog
  {
    key: 'products:view',
    label: 'View Products Catalog',
    description: 'Browse warehouse master inventory and merchant listing catalog',
    category: 'Catalog & Inventory'
  },
  {
    key: 'products:manage',
    label: 'Approve & Moderate Products',
    description: 'Approve, reject, edit, and toggle hot-selling/featured status',
    category: 'Catalog & Inventory'
  },
  {
    key: 'catalog:manage',
    label: 'Manage Categories & Brands',
    description: 'Create and update marketplace categories, brands, and banners',
    category: 'Catalog & Inventory'
  },

  // 4. Shops & Merchants
  {
    key: 'shops:view',
    label: 'View Merchants Directory',
    description: 'Browse seller directories, store profiles, and tier memberships',
    category: 'Shops & Merchants'
  },
  {
    key: 'shops:manage',
    label: 'Approve & Suspend Merchants',
    description: 'Approve/reject seller registrations and toggle store active/suspended states',
    category: 'Shops & Merchants'
  },

  // 5. Finance & Payouts
  {
    key: 'finance:view',
    label: 'View Wallets & Statements',
    description: 'View seller wallet balances, commissions, and revenue analytics',
    category: 'Finance & Payouts'
  },
  {
    key: 'finance:manage',
    label: 'Approve & Process Payouts',
    description: 'Authorize and execute seller withdrawal and payout transfers (Confidential authority)',
    category: 'Finance & Payouts',
    isConfidential: true
  },

  // 6. Customers & Affiliates
  {
    key: 'customers:manage',
    label: 'Manage Customers & Reviews',
    description: 'View customer accounts, moderate reviews, and respond to product queries',
    category: 'Customers & Referrals'
  },
  {
    key: 'affiliates:manage',
    label: 'Affiliates & Referrals',
    description: 'Track referral codes, affiliate commissions, and network statistics',
    category: 'Customers & Referrals'
  },

  // 7. System Administration
  {
    key: 'settings:manage',
    label: 'System & Platform Settings',
    description: 'Configure core payment gateways, SMTP, and platform configurations (Confidential authority)',
    category: 'Platform Administration',
    isConfidential: true
  }
];

export const PERMISSION_CATEGORIES = Array.from(
  new Set(PLATFORM_PERMISSIONS.map(p => p.category))
);

@Injectable({ providedIn: 'root' })
export class AdminPermissionService {
  private readonly http = inject(HttpClient);
  readonly authStore = inject(AuthStore);

  readonly permissions = signal<string[]>([]);
  readonly isLoaded = signal<boolean>(false);
  private inFlightRequest$: Observable<string[]> | null = null;

  readonly isSuperAdmin = computed(() => {
    const role = this.authStore.currentAccount()?.roleType;
    return role === 'SuperAdmin';
  });

  constructor() {
    this.hydrateFromCache();
  }

  hydrateFromCache(): void {
    if (this.isSuperAdmin()) {
      this.permissions.set(['*']);
      this.isLoaded.set(true);
      return;
    }

    // 1. Try from CurrentAccount in AuthStore
    const account = this.authStore.currentAccount();
    if (account?.permissions) {
      const parsed = this.parseRawPermissions(account.permissions);
      if (parsed.length > 0) {
        this.permissions.set(parsed);
        this.isLoaded.set(true);
        return;
      }
    }

    const roleLower = String(account?.roleType || '').toLowerCase();
    if (roleLower === 'partner') {
      this.permissions.set(PLATFORM_PERMISSIONS.map(p => p.key));
      this.isLoaded.set(true);
      return;
    }

    // 2. Try from sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const cached = window.sessionStorage.getItem('eseller_partner_permissions');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.permissions.set(parsed);
            this.isLoaded.set(true);
          }
        }
      } catch {}
    }
  }

  private getMeUrl(): string {
    const base = (environment.apiUrl || '').replace(/\/api\/v1\/?$/, '');
    return `${base}/api/v1/auth/me`;
  }

  ensureLoaded(): Observable<string[]> {
    if (this.isSuperAdmin()) {
      this.permissions.set(['*']);
      this.isLoaded.set(true);
      return of(['*']);
    }

    if (this.isLoaded() && this.permissions().length > 0) {
      return of(this.permissions());
    }

    if (this.inFlightRequest$) {
      return this.inFlightRequest$;
    }

    this.inFlightRequest$ = this.http.get<any>(this.getMeUrl()).pipe(
      map(res => {
        let perms: string[] = [];
        if (res?.permissions) {
          perms = this.parseRawPermissions(res.permissions);
        }
        return perms;
      }),
      tap(perms => {
        this.permissions.set(perms);
        this.isLoaded.set(true);
        this.inFlightRequest$ = null;
        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            window.sessionStorage.setItem('eseller_partner_permissions', JSON.stringify(perms));
          } catch {}
        }
      }),
      catchError(() => {
        this.isLoaded.set(true);
        this.inFlightRequest$ = null;
        return of(this.permissions());
      }),
      shareReplay(1)
    );

    return this.inFlightRequest$;
  }

  reloadPermissions(): Observable<string[]> {
    this.inFlightRequest$ = null;
    return this.http.get<any>(this.getMeUrl()).pipe(
      map(res => {
        let perms: string[] = [];
        if (res?.permissions) {
          perms = this.parseRawPermissions(res.permissions);
        }
        return perms;
      }),
      tap(perms => {
        this.permissions.set(perms);
        this.isLoaded.set(true);
        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            window.sessionStorage.setItem('eseller_partner_permissions', JSON.stringify(perms));
          } catch {}
        }
      }),
      catchError(() => {
        return of(this.permissions());
      })
    );
  }

  loadPermissions(): void {
    this.ensureLoaded().subscribe();
  }

  parseRawPermissions(raw: any): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(p => String(p).trim()).filter(Boolean);
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.map(p => String(p).trim()).filter(Boolean);
          }
        } catch {}
      }
      return trimmed.split(',').map(p => p.trim()).filter(Boolean);
    }
    return [];
  }

  has(permission: string): boolean {
    if (this.isSuperAdmin()) return true;
    const list = this.permissions();
    if (list.includes('*') || list.includes('all')) return true;
    const role = String(this.authStore.currentAccount()?.roleType || '').toLowerCase();
    if (role === 'partner' && list.length === 0) {
      return true;
    }
    return list.includes(permission);
  }

  hasAny(perms: string[]): boolean {
    return perms.some(p => this.has(p));
  }
}
