/**
 * Eseller — Admin App Environment (Production)
 */
export const environment = {
  production: true,
  apiUrl: 'https://api.esellerglobal.com/api/v1',
  chatHubUrl: 'https://api.esellerglobal.com/hubs/chat',
  notificationHubUrl: 'https://api.esellerglobal.com/hubs/notifications',
  customerUrl: 'https://www.esellerglobal.com',
  customerPortalUrl: 'https://www.esellerglobal.com',
  adminUrl: 'https://admin.esellerglobal.com',
  adminPortalUrl: 'https://admin.esellerglobal.com',
  sellerUrl: 'https://seller.esellerglobal.com',
  sellerPortalUrl: 'https://seller.esellerglobal.com',
  affiliateUrl: 'https://affiliate.esellerglobal.com',
  appName: 'Eseller Admin',
  appRole: 'SuperAdmin' as const
};
