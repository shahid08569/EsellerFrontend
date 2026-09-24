/**
 * Eseller — Affiliate App Environment (Production)
 */
export const environment = {
  production: true,
  apiUrl: 'https://affiliate.eseller.com/api/v1',
  chatHubUrl: 'https://affiliate.eseller.com/hubs/chat',
  notificationHubUrl: 'https://affiliate.eseller.com/hubs/notifications',
  appName: 'Eseller Affiliate',
  appRole: 'Affiliate' as const
};