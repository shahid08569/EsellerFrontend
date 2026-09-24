/**
 * Eseller — Seller App Environment (Production)
 */
export const environment = {
  production: true,
  apiUrl: 'https://seller.eseller.com/api/v1',
  chatHubUrl: 'https://seller.eseller.com/hubs/chat',
  notificationHubUrl: 'https://seller.eseller.com/hubs/notifications',
  appName: 'Eseller Seller',
  appRole: 'Shopkeeper' as const
};