import { Injectable, signal, computed } from '@angular/core';

/**
 * ============================================================
 * LocationService — Geolocation + Device Detection
 * ------------------------------------------------------------
 * Backend requires latitude, longitude, deviceType on every
 * register/login call. This service:
 *   - Requests browser geolocation permission.
 *   - Stores the resulting coordinates as signals.
 *   - Detects the device type from the User Agent.
 *   - Exposes permission state so guards/UI can hard-block.
 *
 * IMPORTANT: Location is MANDATORY. If the user denies
 * permission, the caller must show the hard-block UI and
 * prevent registration/login.
 * ============================================================
 */

export type LocationStatus =
  | 'idle'          // not yet requested
  | 'requesting'    // currently asking browser
  | 'granted'       // we have coordinates
  | 'denied'        // user blocked
  | 'error'         // geolocation error (timeout, unavailable)
  | 'unsupported';  // browser doesn't support geolocation

export type DeviceType = 'Desktop' | 'Tablet' | 'Mobile';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  // ============================================================
  // STATE (signals)
  // ============================================================
  private readonly _status = signal<LocationStatus>('idle');
  private readonly _coordinates = signal<Coordinates | null>(null);
  private readonly _errorMessage = signal<string | null>(null);
  private readonly _deviceType = signal<DeviceType>(this.detectDeviceType());

  // ============================================================
  // PUBLIC READ-ONLY SIGNALS
  // ============================================================
  readonly status = this._status.asReadonly();
  readonly coordinates = this._coordinates.asReadonly();
  readonly errorMessage = this._errorMessage.asReadonly();
  readonly deviceType = this._deviceType.asReadonly();

  readonly hasLocation = computed(
    () => this._status() === 'granted' && this._coordinates() !== null
  );

  readonly isRequesting = computed(() => this._status() === 'requesting');
  readonly isDenied = computed(() => this._status() === 'denied');
  readonly isUnsupported = computed(() => this._status() === 'unsupported');

  // ============================================================
  // PUBLIC API
  // ============================================================
  /**
   * Requests the user's current location.
   * Idempotent: if already granted, returns immediately.
   * Returns the coordinates on success, otherwise null.
   */
  async requestLocation(): Promise<Coordinates | null> {
    if (this._status() === 'granted' && this._coordinates()) {
      return this._coordinates();
    }

    if (!('geolocation' in navigator)) {
      this._status.set('unsupported');
      this._errorMessage.set(
        'Your browser does not support location services.'
      );
      return null;
    }

    this._status.set('requesting');
    this._errorMessage.set(null);

    return new Promise<Coordinates | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          this._coordinates.set(coords);
          this._status.set('granted');
          resolve(coords);
        },
        (error) => {
          this._coordinates.set(null);

          switch (error.code) {
            case error.PERMISSION_DENIED:
              this._status.set('denied');
              this._errorMessage.set(
                'Location permission was denied. Please enable it to continue.'
              );
              break;
            case error.POSITION_UNAVAILABLE:
              this._status.set('error');
              this._errorMessage.set(
                'Location information is unavailable. Please try again.'
              );
              break;
            case error.TIMEOUT:
              this._status.set('error');
              this._errorMessage.set(
                'Location request timed out. Please try again.'
              );
              break;
            default:
              this._status.set('error');
              this._errorMessage.set(
                'An unknown error occurred while fetching location.'
              );
          }

          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 60_000
        }
      );
    });
  }

  /**
   * Resets the state so the user can retry (e.g. after a denial).
   */
  reset(): void {
    this._status.set('idle');
    this._coordinates.set(null);
    this._errorMessage.set(null);
  }

  /**
   * Returns coordinates synchronously (throws if not available).
   * Call only after `hasLocation()` is true.
   */
  getCoordinatesOrThrow(): Coordinates {
    const coords = this._coordinates();
    if (!coords) {
      throw new Error('Location not available. Call requestLocation() first.');
    }
    return coords;
  }

  // ============================================================
  // DEVICE DETECTION
  // ============================================================
  private detectDeviceType(): DeviceType {
    const ua = navigator.userAgent.toLowerCase();

    // Tablet detection (iPad, Android tablets without "Mobile")
    const isTablet =
      /ipad/.test(ua) ||
      (/android/.test(ua) && !/mobile/.test(ua)) ||
      /tablet/.test(ua);

    if (isTablet) return 'Tablet';

    // Mobile detection
    const isMobile =
      /mobile|iphone|ipod|android.*mobile|windows phone|blackberry/.test(ua);

    if (isMobile) return 'Mobile';

    return 'Desktop';
  }
}