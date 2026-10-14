import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { partnerPermissionGuard, superAdminOnlyGuard } from './core/guards/partner-permission.guard';
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
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: ['shops:view', 'shops:manage'] },
        loadComponent: () => import('./features/shops/shop-management/shop-management').then(m => m.ShopManagement)
      },
      {
        path: 'products',
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: ['products:view', 'products:manage'] },
        loadComponent: () => import('./features/products/product-approval/product-approval').then(m => m.ProductApproval)
      },
      {
        path: 'categories',
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: 'catalog:manage' },
        loadComponent: () => import('./features/categories/category-management/category-management').then(m => m.CategoryManagement)
      },
      {
        path: 'brands',
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: 'catalog:manage' },
        loadComponent: () => import('./features/brands/brand-management/brand-management').then(m => m.BrandManagement)
      },
      {
        path: 'orders',
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: ['orders:view', 'orders:manage'] },
        loadComponent: () => import('./features/orders/order-management/order-management').then(m => m.OrderManagement)
      },
      {
        path: 'reviews',
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: 'customers:manage' },
        loadComponent: () => import('./features/reviews/review-management/review-management').then(m => m.ReviewManagement)
      },
      {
        path: 'chat',
        loadComponent: () => import('./features/chat-inbox/admin-chat/admin-chat').then(m => m.AdminChat)
      },
      {
        path: 'customers',
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: 'customers:manage' },
        loadComponent: () => import('./features/users/customer-management/customer-management').then(m => m.CustomerManagement)
      },
      {
        path: 'sellers',
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: ['shops:view', 'shops:manage'] },
        loadComponent: () => import('./features/users/seller-management/seller-management').then(m => m.SellerManagement)
      },
      {
        path: 'users',
        redirectTo: 'customers'
      },
      {
        path: 'partners',
        canActivate: [superAdminOnlyGuard],
        loadComponent: () => import('./features/partners/partner-management/partner-management').then(m => m.PartnerManagement)
      },
      {
        path: 'finance',
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: ['finance:view', 'finance:manage'] },
        loadComponent: () => import('./features/finance/finance-manager/finance-manager').then(m => m.FinanceManager)
      },
      {
        path: 'promotions',
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: 'catalog:manage' },
        loadComponent: () => import('./features/promotions/promotions-manager/promotions-manager').then(m => m.PromotionsManager)
      },
      {
        path: 'homepage',
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: 'catalog:manage' },
        loadComponent: () => import('./features/homepage/homepage-merchandising').then(m => m.HomepageMerchandising)
      },
      {
        path: 'content',
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: 'catalog:manage' },
        loadComponent: () => import('./features/content/content-manager/content-manager').then(m => m.ContentManager)
      },
      {
        path: 'blog',
        redirectTo: 'content'
      },
      {
        path: 'reports',
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: ['traffic:view', 'traffic:manage', 'finance:view', 'finance:manage'] },
        loadComponent: () => import('./features/reports/reports-view/reports-view').then(m => m.ReportsView)
      },
      {
        path: 'affiliates',
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: 'affiliates:manage' },
        loadComponent: () => import('./features/affiliates/affiliate-management/affiliate-management').then(m => m.AffiliateManagement)
      },
      {
        path: 'settings',
        canActivate: [partnerPermissionGuard],
        data: { requiredPermission: 'settings:manage' },
        loadComponent: () => import('./features/settings/platform-settings/platform-settings').then(m => m.PlatformSettings)
      },
      {
        path: 'manage-password',
        loadComponent: () => import('./features/profile/manage-password/manage-password').then(m => m.ManagePassword)
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/manage-password/manage-password').then(m => m.ManagePassword)
      },
      {
        path: 'audit-logs',
        canActivate: [superAdminOnlyGuard],
        loadComponent: () => import('./features/audit-logs/audit-logs-view/audit-logs-view').then(m => m.AuditLogsView)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
