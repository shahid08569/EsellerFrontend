/**
 * Eseller — Seller App Environment (Production)
 * API + hubs always on api.eseller.com (single backend).
 */
export const environment = {
  production: true,
  apiUrl: 'https://api.eseller.com/api/v1',
  chatHubUrl: 'https://api.eseller.com/hubs/chat',
  notificationHubUrl: 'https://api.eseller.com/hubs/notifications',
  customerPortalUrl: 'https://eseller.com',
  appName: 'Eseller Seller',
  appRole: 'Shopkeeper' as const
};
