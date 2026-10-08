import { Routes } from '@angular/router';
import { MainLayout } from './layouts/main-layout/main-layout';
import { sellerGuard } from './core/guards/seller.guard';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    canActivate: [sellerGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // SECTION 1: OVERVIEW
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'analytics',
        loadComponent: () => import('./features/analytics/analytics').then(m => m.Analytics)
      },

      // SECTION 2: CATALOG LISTINGS
      {
        path: 'products',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/products/product-list/product-list').then(m => m.ProductList)
          },
          {
            path: 'catalog',
            loadComponent: () =>
              import('./features/products/marketplace-catalog/marketplace-catalog').then(
                m => m.MarketplaceCatalog
              )
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./features/products/product-form/product-form').then(m => m.ProductForm)
          },
          {
            path: ':id/edit',
            loadComponent: () =>
              import('./features/products/product-form/product-form').then(m => m.ProductForm)
          },
          { path: ':productId/variants', redirectTo: '/products', pathMatch: 'full' }
        ]
      },
      { path: 'variants', redirectTo: 'products', pathMatch: 'full' },
      { path: 'categories', redirectTo: 'products/catalog', pathMatch: 'full' },
      { path: 'brands', redirectTo: 'products/catalog', pathMatch: 'full' },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/inventory/inventory-manager').then(m => m.InventoryManager)
      },

      // SECTION 3: SALES & COMMISSIONS
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/orders/order-list/order-list').then(m => m.OrderList)
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./features/customers/customer-list/customer-list').then(m => m.CustomerList)
      },
      {
        path: 'chat',
        loadComponent: () => import('./features/chat/seller-chat').then(m => m.SellerChat)
      },

      // SECTION 4: ENGAGEMENT
      {
        path: 'reviews',
        loadComponent: () =>
          import('./features/reviews/review-list/review-list').then(m => m.ReviewList)
      },
      {
        path: 'questions',
        loadComponent: () =>
          import('./features/questions/question-list/question-list').then(m => m.QuestionList)
      },

      // SECTION 5: PROMOTIONS
      {
        path: 'discounts',
        loadComponent: () =>
          import('./features/discounts/discount-list/discount-list').then(m => m.DiscountList)
      },
      {
        path: 'coupons',
        loadComponent: () =>
          import('./features/coupons/coupon-list/coupon-list').then(m => m.CouponList)
      },

      // SECTION 6: FINANCE
      {
        path: 'earnings',
        loadComponent: () =>
          import('./features/earnings/earnings-overview').then(m => m.EarningsOverview)
      },
      {
        path: 'withdrawals',
        loadComponent: () =>
          import('./features/withdrawals/withdrawal-list/withdrawal-list').then(
            m => m.WithdrawalList
          )
      },
      {
        path: 'referrals',
        loadComponent: () =>
          import('./features/referrals/referral-center').then(m => m.ReferralCenter)
      },

      // SECTION 7: SETTINGS
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings').then(m => m.Settings)
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/seller-profile').then(m => m.SellerProfile)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
