/**
 * Eseller — Customer App Environment (Production)
 * API + hubs always on api.eseller.com (single backend).
 */
export const environment = {
  production: true,
  apiUrl: 'https://api.eseller.com/api/v1',
  chatHubUrl: 'https://api.eseller.com/hubs/chat',
  notificationHubUrl: 'https://api.eseller.com/hubs/notifications',
  sellerPortalUrl: 'https://seller.eseller.com',
  adminPortalUrl: 'https://admin.eseller.com',
  appName: 'Eseller',
  appRole: 'Customer' as const
};
