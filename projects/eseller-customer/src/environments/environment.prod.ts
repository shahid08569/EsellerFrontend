/**
 * Eseller — Customer App Environment (Production)
 */
export const environment = {
  production: true,
  apiUrl: 'https://api.esellerglobal.com/api/v1',
  chatHubUrl: 'https://api.esellerglobal.com/hubs/chat',
  notificationHubUrl: 'https://api.esellerglobal.com/hubs/notifications',
  appName: 'Eseller',
  appRole: 'Customer' as const
};
