/**
 * Eseller — Seller App Environment (Development)
 */
export const environment = {
  production: false,
  apiUrl: 'https://localhost:7127/api/v1',
  chatHubUrl: 'https://localhost:7127/hubs/chat',
  notificationHubUrl: 'https://localhost:7127/hubs/notifications',
  appName: 'Eseller Seller',
  appRole: 'Shopkeeper' as const
};