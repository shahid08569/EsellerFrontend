/**
 * Eseller — Admin App Environment (Production)
 */
export const environment = {
  production: true,
  apiUrl: 'https://admin.eseller.com/api/v1',
  chatHubUrl: 'https://admin.eseller.com/hubs/chat',
  notificationHubUrl: 'https://admin.eseller.com/hubs/notifications',
  appName: 'Eseller Admin',
  appRole: 'SuperAdmin' as const
};