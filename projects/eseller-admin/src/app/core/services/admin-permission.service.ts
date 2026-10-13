import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  readonly isSuperAdmin = computed(() => {
    const role = this.authStore.currentAccount()?.roleType;
    return role === 'SuperAdmin';
  });

  loadPermissions(): void {
    if (this.isSuperAdmin()) {
      this.permissions.set(['*']);
      this.isLoaded.set(true);
      return;
    }

    this.http.get<any>(`${environment.apiUrl}/api/v1/auth/me`).subscribe({
      next: (res) => {
        let perms: string[] = [];
        if (res?.permissions) {
          try {
            const parsed = typeof res.permissions === 'string' ? JSON.parse(res.permissions) : res.permissions;
            perms = Array.isArray(parsed) ? parsed : (typeof res.permissions === 'string' ? res.permissions.split(',') : []);
          } catch {
            perms = typeof res.permissions === 'string' ? res.permissions.split(',') : [];
          }
        }
        this.permissions.set(perms.map(p => p.trim()).filter(Boolean));
        this.isLoaded.set(true);
      },
      error: () => {
        this.isLoaded.set(true);
      }
    });
  }

  has(permission: string): boolean {
    if (this.isSuperAdmin()) return true;
    const list = this.permissions();
    if (list.includes('*') || list.includes('all')) return true;
    if (list.includes(permission)) return true;

    // Check prefix match (e.g. 'orders' grants 'orders:view' and 'orders:manage')
    const prefix = permission.split(':')[0];
    if (list.includes(prefix)) return true;

    return false;
  }

  hasAny(perms: string[]): boolean {
    return perms.some(p => this.has(p));
  }
}
