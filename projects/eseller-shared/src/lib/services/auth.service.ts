import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap, map } from 'rxjs';

import { ApiService } from './api.service';
import { LocationService, DeviceType } from './location.service';

import {
  LoginCommand,
  LoginResponse,
  RegisterCustomerCommand,
  RegisterCustomerResponse,
  RegisterSellerCommand,
  RegisterSellerResponse,
  RegisterAffiliateCommand,
  RegisterAffiliateResponse,
  RefreshTokenResponse,
  VerifyEmailCommand,
  ResendVerificationEmailCommand,
  SendPhoneOtpCommand,
  VerifyPhoneOtpCommand,
  ForgotPasswordCommand,
  ResetPasswordCommand,
  ChangePasswordCommand
} from '../models/auth/auth.models';

/**
 * ============================================================
 * AuthService — All authentication endpoints
 * ------------------------------------------------------------
 * Every register/login call automatically attaches:
 *   - latitude
 *   - longitude
 *   - deviceType
 *
 * These are MANDATORY on the backend. The LocationService is
 * used to fetch them — callers do NOT need to pass them.
 *
 * refreshToken never appears here: it lives in the HttpOnly
 * cookie set by the backend.
 * ============================================================
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly location = inject(LocationService);

  // ============================================================
  // LOGIN
  // ============================================================
  login(payload: { usernameOrEmail: string; password: string }): Observable<LoginResponse> {
    return this.withLocation((loc) =>
      this.api.post<LoginResponse>('/Auth/login', {
        usernameOrEmail: payload.usernameOrEmail,
        password: payload.password,
        latitude: loc.latitude,
        longitude: loc.longitude,
        deviceType: loc.deviceType
      } satisfies LoginCommand)
    );
  }

  // ============================================================
  // REGISTER — CUSTOMER
  // ============================================================
  registerCustomer(payload: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }): Observable<RegisterCustomerResponse> {
    return this.withLocation((loc) =>
      this.api.post<RegisterCustomerResponse>('/Auth/register/customer', {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        password: payload.password,
        latitude: loc.latitude,
        longitude: loc.longitude,
        deviceType: loc.deviceType
      } satisfies RegisterCustomerCommand)
    );
  }

  // ============================================================
  // REGISTER — SELLER
  // ============================================================
  registerSeller(payload: {
    name: string;
    email: string;
    phone: string;
    password: string;
    storeName: string;
    storeUrl: string;
    storeDescription: string;
    address: string;
    city: string;
    country: string;
  }): Observable<RegisterSellerResponse> {
    return this.withLocation((loc) =>
      this.api.post<RegisterSellerResponse>('/Auth/register/seller', {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        password: payload.password,
        storeName: payload.storeName,
        storeUrl: payload.storeUrl,
        storeDescription: payload.storeDescription,
        address: payload.address,
        city: payload.city,
        country: payload.country,
        latitude: loc.latitude,
        longitude: loc.longitude,
        deviceType: loc.deviceType
      } satisfies RegisterSellerCommand)
    );
  }

  // ============================================================
  // REGISTER — AFFILIATE
  // ============================================================
  registerAffiliate(payload: {
    name: string;
    email: string;
    password: string;
  }): Observable<RegisterAffiliateResponse> {
    return this.withLocation((loc) =>
      this.api.post<RegisterAffiliateResponse>('/Affiliate/register', {
        name: payload.name,
        email: payload.email,
        password: payload.password,
        latitude: loc.latitude,
        longitude: loc.longitude,
        deviceType: loc.deviceType,
        ipAddress: null, // optional — backend can fill from request
        userAgent: navigator.userAgent
      } satisfies RegisterAffiliateCommand)
    );
  }

  // ============================================================
  // REFRESH TOKEN (cookie-based, no body)
  // ============================================================
  refreshToken(): Observable<RefreshTokenResponse> {
    return this.api.post<RefreshTokenResponse>('/Auth/refresh-token', {});
  }

  // ============================================================
  // LOGOUT
  // ============================================================
  logout(): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/Auth/logout', {});
  }

  // ============================================================
  // EMAIL VERIFICATION
  // ============================================================
  verifyEmail(payload: VerifyEmailCommand): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/Auth/verify-email', payload);
  }

  resendVerificationEmail(
    payload: ResendVerificationEmailCommand
  ): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(
      '/Auth/resend-verification-email',
      payload
    );
  }

  // ============================================================
  // PHONE OTP
  // ============================================================
  sendPhoneOtp(payload: SendPhoneOtpCommand): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/Auth/send-phone-otp', payload);
  }

  verifyPhoneOtp(payload: VerifyPhoneOtpCommand): Observable<{ message: string }> {
    return this.api.post<{ message: string }>(
      '/Auth/verify-phone-otp',
      payload
    );
  }

  // ============================================================
  // PASSWORD
  // ============================================================
  forgotPassword(payload: ForgotPasswordCommand): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/Auth/forgot-password', payload);
  }

  resetPassword(payload: ResetPasswordCommand): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/Auth/reset-password', payload);
  }

  changePassword(payload: ChangePasswordCommand): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/Auth/change-password', payload);
  }

  // ============================================================
  // PRIVATE HELPER — Attach location to any request
  // ------------------------------------------------------------
  // Ensures location is granted before firing the request.
  // If not granted, requests it. If still not available,
  // throws (guard should have prevented reaching here).
  // ============================================================
  private withLocation<T>(
    fn: (loc: { latitude: number; longitude: number; deviceType: DeviceType }) => Observable<T>
  ): Observable<T> {
    return from(this.location.requestLocation()).pipe(
      switchMap((coords) => {
        if (!coords) {
          throw new Error(
            'Location is required but not available. Guard should have blocked this route.'
          );
        }
        return fn({
          latitude: coords.latitude,
          longitude: coords.longitude,
          deviceType: this.location.deviceType()
        });
      })
    );
  }
}