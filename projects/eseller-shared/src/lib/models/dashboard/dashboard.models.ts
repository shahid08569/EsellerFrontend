export interface DashboardSummaryDto {
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  wishlistCount: number;
  compareCount: number;
  addressCount: number;
  unreadNotifications: number;
  unreadChatMessages: number;
  totalSpent: number;
}

export interface UserProfileDto {
  accountId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Pending | Approved | Rejected — SuperAdmin gate */
  approvalStatus?: string;
}

export interface UpdateProfileRequest {
  name: string;
  phone?: string | null;
}

export interface AddressDto {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  country: string;
  postalCode?: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateAddressRequest {
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  country: string;
  postalCode?: string | null;
  isDefault: boolean;
}

export interface UpdateAddressRequest {
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  country: string;
  postalCode?: string | null;
  isDefault: boolean;
}

export interface DashboardNotificationDto {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  type?: string;
  createdAt: string;
}
