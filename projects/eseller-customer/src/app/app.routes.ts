import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layouts/main-layout/main-layout').then(m => m.MainLayout),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/home').then(m => m.Home),
        title: 'Eseller — Home'
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/products').then(m => m.Products),
        title: 'Eseller — Products'
      },
      {
        path: 'cart',
        loadComponent: () =>
          import('./features/cart/cart').then(m => m.Cart),
        title: 'Eseller — Cart'
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/orders/orders').then(m => m.Orders),
        title: 'Eseller — Orders'
      },
      {
        path: 'wishlist',
        loadComponent: () =>
          import('./features/wishlist/wishlist').then(m => m.Wishlist),
        title: 'Eseller — Wishlist'
      },
      {
        path: 'compare',
        loadComponent: () =>
          import('./features/compare/compare').then(m => m.Compare),
        title: 'Eseller — Compare'
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then(m => m.Dashboard),
        title: 'Eseller — Dashboard'
      },
      {
        path: 'chat',
        loadComponent: () =>
          import('./features/chat/chat').then(m => m.Chat),
        title: 'Eseller — Chat'
      }
    ]
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout').then(m => m.AuthLayout),
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login').then(m => m.Login),
        title: 'Eseller — Login'
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/register/register').then(m => m.Register),
        title: 'Eseller — Register'
      }
    ]
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full'
  }
];