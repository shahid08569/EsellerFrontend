import { Component, inject, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { LocationService } from '../../services/location.service';
import { Button } from '../button/button';

/**
 * ============================================================
 * LocationRequired — Blocking UI when location is unavailable
 * ------------------------------------------------------------
 * Shown when the locationGuard redirects here. Explains why
 * location is required and provides a retry button. Once the
 * user grants permission, navigates back to the returnUrl.
 *
 * Backend requires latitude/longitude on register/login, so
 * this screen is a hard block — there is no "skip" option.
 * ============================================================
 */
@Component({
  selector: 'es-location-required',
  imports: [Button],
  templateUrl: './location-required.html'
})
export class LocationRequired {
  private readonly locationService = inject(LocationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly status = this.locationService.status;
  readonly errorMessage = this.locationService.errorMessage;
  readonly isRequesting = this.locationService.isRequesting;
  readonly isDenied = this.locationService.isDenied;
  readonly isUnsupported = this.locationService.isUnsupported;

  readonly title = computed(() => {
    if (this.isUnsupported()) return 'Browser Not Supported';
    if (this.isDenied()) return 'Location Permission Blocked';
    return 'Location Required';
  });

  readonly description = computed(() => {
    if (this.isUnsupported()) {
      return 'Your browser does not support location services. Please use a modern browser like Chrome, Edge, Firefox, or Safari.';
    }
    if (this.isDenied()) {
      return 'You blocked location access. Please enable it from your browser settings, then tap Retry. Location is mandatory for registering and logging in.';
    }
    return 'Eseller needs your location to complete registration and login. Your coordinates are used only for security and regional personalisation.';
  });

  async onRetry(): Promise<void> {
    this.locationService.reset();
    const coords = await this.locationService.requestLocation();

    if (coords) {
      this.redirectBack();
    }
  }

  private redirectBack(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
    void this.router.navigateByUrl(returnUrl);
  }
}