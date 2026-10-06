import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { AdminLayout } from './layouts/admin-layout/admin-layout';

export const routes: Routes = [
  {
    path: '',
    component: AdminLayout,
    canActivate: [adminGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'shops',
        loadComponent: () => import('./features/shops/shop-management/shop-management').then(m => m.ShopManagement)
      },
      {
        path: 'products',
        loadComponent: () => import('./features/products/product-approval/product-approval').then(m => m.ProductApproval)
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/categories/category-management/category-management').then(m => m.CategoryManagement)
      },
      {
        path: 'brands',
        loadComponent: () => import('./features/brands/brand-management/brand-management').then(m => m.BrandManagement)
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/orders/order-management/order-management').then(m => m.OrderManagement)
      },
      {
        path: 'reviews',
        loadComponent: () => import('./features/reviews/review-management/review-management').then(m => m.ReviewManagement)
      },
      {
        path: 'chat',
        loadComponent: () => import('./features/chat-inbox/admin-chat/admin-chat').then(m => m.AdminChat)
      },
      {
        path: 'customers',
        loadComponent: () => import('./features/users/customer-management/customer-management').then(m => m.CustomerManagement)
      },
      {
        path: 'sellers',
        loadComponent: () => import('./features/users/seller-management/seller-management').then(m => m.SellerManagement)
      },
      {
        path: 'users',
        redirectTo: 'customers'
      },
      {
        path: 'partners',
        loadComponent: () => import('./features/partners/partner-management/partner-management').then(m => m.PartnerManagement)
      },
      {
        path: 'finance',
        loadComponent: () => import('./features/finance/finance-manager/finance-manager').then(m => m.FinanceManager)
      },
      {
        path: 'promotions',
        loadComponent: () => import('./features/promotions/promotions-manager/promotions-manager').then(m => m.PromotionsManager)
      },
      {
        path: 'homepage',
        loadComponent: () => import('./features/homepage/homepage-merchandising').then(m => m.HomepageMerchandising)
      },
      {
        path: 'content',
        loadComponent: () => import('./features/content/content-manager/content-manager').then(m => m.ContentManager)
      },
      {
        path: 'blog',
        redirectTo: 'content'
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports-view/reports-view').then(m => m.ReportsView)
      },
      {
        path: 'affiliates',
        loadComponent: () => import('./features/affiliates/affiliate-management/affiliate-management').then(m => m.AffiliateManagement)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/platform-settings/platform-settings').then(m => m.PlatformSettings)
      },
      {
        path: 'audit-logs',
        loadComponent: () => import('./features/audit-logs/audit-logs-view/audit-logs-view').then(m => m.AuditLogsView)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
