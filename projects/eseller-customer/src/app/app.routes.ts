import { Routes } from '@angular/router';
import { customerShopGuard } from 'eseller-shared';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layouts/main-layout/main-layout').then(m => m.MainLayout),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/home/home').then(m => m.Home),
        title: 'Eseller — Home'
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/products').then(m => m.Products),
        title: 'Eseller — Products'
      },
      {
        path: 'products/:slug',
        loadComponent: () =>
          import('./features/products/product-detail/product-detail').then(
            m => m.ProductDetail
          ),
        title: 'Eseller — Product Detail'
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/categories/categories-list/categories-list').then(
            m => m.CategoriesList
          ),
        title: 'Eseller — All Categories'
      },
      {
        path: 'categories/:slug',
        loadComponent: () =>
          import('./features/categories/category-detail/category-detail').then(
            m => m.CategoryDetail
          ),
        title: 'Eseller — Category'
      },
      {
        path: 'brands',
        loadComponent: () =>
          import('./features/brands/brands').then(m => m.Brands),
        title: 'Eseller — Brands'
      },
      {
        path: 'brands/:slug',
        loadComponent: () =>
          import('./features/brands/brand-detail/brand-detail').then(
            m => m.BrandDetail
          ),
        title: 'Eseller — Brand'
      },
      {
        path: 'blogs',
        loadComponent: () =>
          import('./features/blog/blog-list/blog-list').then(m => m.BlogList),
        title: 'Eseller — Blogs & Stories'
      },
      {
        path: 'blogs/:slug',
        loadComponent: () =>
          import('./features/blog/blog-detail/blog-detail').then(m => m.BlogDetail),
        title: 'Eseller — Story'
      },
      {
        path: 'blog',
        redirectTo: 'blogs',
        pathMatch: 'full'
      },
      {
        path: 'blog/:slug',
        redirectTo: 'blogs/:slug'
      },
      {
        path: 'flash-sales',
        loadComponent: () =>
          import('./features/flash-sales/flash-sales').then(m => m.FlashSales),
        title: 'Eseller — Flash Sale'
      },
      {
        path: 'new-arrivals',
        loadComponent: () =>
          import('./features/products/products').then(m => m.Products),
        data: {
          collection: 'new-arrivals',
          title: 'New Arrivals',
          subtitle: 'Discover the latest arrivals, freshly stocked with verified seller warranty.'
        },
        title: 'Eseller — New Arrivals'
      },
      {
        path: 'featured',
        loadComponent: () =>
          import('./features/products/products').then(m => m.Products),
        data: {
          collection: 'featured',
          title: 'Featured Products',
          subtitle: 'Handpicked premium items curated by verified top merchants.'
        },
        title: 'Eseller — Featured Products'
      },
      {
        path: 'hot-selling',
        loadComponent: () =>
          import('./features/products/products').then(m => m.Products),
        data: {
          collection: 'hot-selling',
          title: 'Hot Selling Deals',
          subtitle: 'Fast-moving products with trending customer interest and great discounts.'
        },
        title: 'Eseller — Hot Selling Deals'
      },
      {
        path: 'best-selling',
        loadComponent: () =>
          import('./features/products/products').then(m => m.Products),
        data: {
          collection: 'best-selling',
          title: 'Best Selling Collection',
          subtitle: 'Customer favorites with top ratings and highest verified order volumes.'
        },
        title: 'Eseller — Best Selling'
      },
      {
        path: 'cart',
        canActivate: [customerShopGuard],
        loadComponent: () =>
          import('./features/cart/cart').then(m => m.Cart),
        title: 'Eseller — Cart'
      },
      {
        path: 'orders',
        canActivate: [customerShopGuard],
        loadComponent: () =>
          import('./features/orders/orders').then(m => m.Orders),
        title: 'Eseller — Orders'
      },
      {
        path: 'track-order',
        redirectTo: 'orders'
      },
      {
        path: 'wishlist',
        canActivate: [customerShopGuard],
        loadComponent: () =>
          import('./features/wishlist/wishlist').then(m => m.Wishlist),
        title: 'Eseller — Wishlist'
      },
      {
        path: 'compare',
        canActivate: [customerShopGuard],
        loadComponent: () =>
          import('./features/compare/compare').then(m => m.Compare),
        title: 'Eseller — Compare'
      },
      {
        path: 'chat',
        canActivate: [customerShopGuard],
        loadComponent: () =>
          import('./features/chat/chat').then(m => m.Chat),
        title: 'Eseller — Chat'
      },
      {
        path: 'terms',
        loadComponent: () =>
          import('./features/legal/terms/terms').then(m => m.Terms),
        title: 'Eseller — Terms & Conditions'
      },
      {
        path: 'privacy',
        loadComponent: () =>
          import('./features/legal/privacy/privacy').then(m => m.Privacy),
        title: 'Eseller — Privacy Policy'
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./features/legal/about/about').then(m => m.About),
        title: 'Eseller — About Us'
      }
    ]
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then(m => m.Dashboard),
    title: 'Eseller — Customer Portal'
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
      },
      {
        path: 'seller-register',
        loadComponent: () =>
          import('./features/auth/seller-register/seller-register').then(m => m.SellerRegister),
        title: 'Eseller — Merchant Registration'
      }
    ]
  },
  {
    path: 'login',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
  {
    path: 'register',
    redirectTo: 'auth/register',
    pathMatch: 'full'
  },
  {
    path: 'seller-register',
    redirectTo: 'auth/seller-register',
    pathMatch: 'full'
  },
  {
    path: 'seller/register',
    redirectTo: 'auth/seller-register',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full'
  }
];