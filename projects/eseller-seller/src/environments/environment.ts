/**
 * Eseller — Seller App Environment (Development)
 */
export const environment = {
  production: false,
  apiUrl: 'https://localhost:7127/api/v1',
  chatHubUrl: 'https://localhost:7127/hubs/chat',
  notificationHubUrl: 'https://localhost:7127/hubs/notifications',
  customerUrl: 'http://localhost:4200',
  customerPortalUrl: 'http://localhost:4200',
  adminUrl: 'http://localhost:4201',
  adminPortalUrl: 'http://localhost:4201',
  sellerUrl: 'http://localhost:54007',
  sellerPortalUrl: 'http://localhost:54007',
  affiliateUrl: 'http://localhost:4203',
  appName: 'Eseller Seller',
  appRole: 'Shopkeeper' as const
};
