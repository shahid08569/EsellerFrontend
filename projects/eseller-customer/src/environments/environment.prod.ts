/**
 * Eseller — Customer App Environment (Production)
 */
export const environment = {
  production: true,
  apiUrl: 'https://eseller.com/api/v1',
  chatHubUrl: 'https://eseller.com/hubs/chat',
  notificationHubUrl: 'https://eseller.com/hubs/notifications',
  appName: 'Eseller',
  appRole: 'Customer' as const
};