/**
 * ============================================================
 * Eseller — Auth Models
 * ============================================================
 * Strictly mirrors backend DTOs.
 * refreshToken is NEVER present in JSON — it lives in HttpOnly cookie.
 * ============================================================
 */

// ============================================================
// ROLE TYPE (Eseller.Domain.Enums.RoleType)
// ============================================================
export type RoleType =
  | 'User'
  | 'Shopkeeper'
  | 'SuperAdmin'
  | 'Partner'
  | 'Affiliate';

// ============================================================
// LOGIN
// ============================================================
export interface LoginCommand {
  usernameOrEmail: string;
  password: string;
  latitude: number;
  longitude: number;
  deviceType: string;
}

export interface LoginResponse {
  accountId: string;
  username: string;
  email: string;
  roleType: RoleType;
  accessToken: string;
  accessTokenExpiresAt: string;
}

// ============================================================
// REGISTER — CUSTOMER
// ============================================================
export interface RegisterCustomerCommand {
  name: string;
  email: string;
  phone: string;
  password: string;
  latitude: number;
  longitude: number;
  deviceType: string;
}

export interface RegisterCustomerResponse {
  accountId: string;
  name: string;
  email: string;
  roleType: RoleType;
}

// ============================================================
// REGISTER — SELLER
// ============================================================
export interface RegisterSellerCommand {
  name: string;
  email: string;
  phone: string;
  password: string;
  storeName: string;
  storeUrl: string;
  storeDescription?: string | null;
  address: string;
  city: string;
  country: string;
  documentType?: string | null;
  documentNumber?: string | null;
  cnicFrontUrl?: string | null;
  cnicBackUrl?: string | null;
  documentUrl?: string | null;
  latitude: number;
  longitude: number;
  deviceType: string;
  referralCode?: string | null;
}

export interface RegisterSellerResponse {
  accountId: string;
  shopkeeperId: string;
  shopId: string;
  name: string;
  email: string;
  storeName: string;
  storeUrl: string;
  status: string;
  message: string;
}

// ============================================================
// REGISTER — AFFILIATE
// ============================================================
export interface RegisterAffiliateCommand {
  name: string;
  email: string;
  password: string;
  latitude: number;
  longitude: number;
  deviceType: string;
  ipAddress?: string | null;    
  userAgent?: string | null;    
}

export type RegisterAffiliateResponse = string;

// ============================================================
// REFRESH TOKEN
// ============================================================
export interface RefreshTokenResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  accountId: string;
  username: string;
  email: string;
  roleType: RoleType;
}

// ============================================================
// CURRENT ACCOUNT (AuthStore)
// ============================================================
export interface CurrentAccount {
  accountId: string;
  username: string;
  email: string;
  roleType: RoleType;
}

// ============================================================
// EMAIL VERIFICATION
// ============================================================
export interface VerifyEmailCommand {
  email: string;
  code: string;
}

export interface ResendVerificationEmailCommand {
  email: string;
}

// ============================================================
// PHONE OTP
// ============================================================
export interface SendPhoneOtpCommand {
  /** Account email — backend looks up phone from User/Shopkeeper profile */
  email: string;
}

export interface VerifyPhoneOtpCommand {
  email: string;
  code: string;
}

// ============================================================
// PASSWORD
// ============================================================
export interface ForgotPasswordCommand {
  email: string;
}

export interface ResetPasswordCommand {
  email: string;
  code: string;
  newPassword: string;
}

export interface ChangePasswordCommand {
  currentPassword: string;
  newPassword: string;
}

// ============================================================
// API ERROR
// ============================================================
export interface ApiErrorResponse {
  error: string;
  errorCode: string;
  /** FluentValidation field map: PropertyName → messages */
  errors?: Record<string, string[]>;
}