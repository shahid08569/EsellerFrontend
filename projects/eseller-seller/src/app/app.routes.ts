import { Routes } from '@angular/router';
import { MainLayout } from './layouts/main-layout/main-layout';
import { Dashboard } from './features/dashboard/dashboard';
import { sellerGuard } from './core/guards/seller.guard';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    canActivate: [sellerGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      {
        path: 'products',
        children: [
          { path: '', loadComponent: () => import('./features/products/product-list/product-list').then(m => m.ProductList) },
          { path: 'new', loadComponent: () => import('./features/products/product-form/product-form').then(m => m.ProductForm) },
          { path: 'edit/:id', loadComponent: () => import('./features/products/product-form/product-form').then(m => m.ProductForm) }
        ]
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/orders/order-list/order-list').then(m => m.OrderList)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings').then(m => m.Settings)
      }
    ]
  },
  // Fallback
  { path: '**', redirectTo: '' }
];
