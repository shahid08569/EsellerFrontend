export type NotificationType =
  | 'NewCustomer'
  | 'NewSeller'
  | 'NewOrder'
  | 'NewMessage'
  | 'ProductListingRequest'
  | 'ProductOutOfStock'
  | 'TierUpdated'
  | 'OrderDelivered'
  | 'PaymentCompleted'
  | 'CommissionEarned'
  | 'TierBadgeRequestUpdated'
  | 'ProductListingRequestUpdated'
  | 'NewProduct'
  | string;

export interface AppNotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  navigationUrl?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  /** @deprecated use navigationUrl */
  linkPath?: string | null;
  /** @deprecated use entityId */
  relatedEntityId?: string | null;
}
