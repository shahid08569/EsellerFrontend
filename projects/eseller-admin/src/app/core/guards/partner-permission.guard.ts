import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthStore, ToastService } from 'eseller-shared';
import { AdminPermissionService } from '../services/admin-permission.service';

export const partnerPermissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authStore = inject(AuthStore);
  const permissionService = inject(AdminPermissionService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const role = authStore.currentAccount()?.roleType;
  if (role === 'SuperAdmin') {
    return true;
  }

  const requiredPerm = route.data?.['requiredPermission'] as string | string[] | undefined;
  if (!requiredPerm) {
    return true;
  }

  const checkAccess = () => {
    return Array.isArray(requiredPerm)
      ? requiredPerm.some(p => permissionService.has(p))
      : permissionService.has(requiredPerm);
  };

  if (permissionService.isLoaded()) {
    if (checkAccess()) {
      return true;
    }
    toast.show('Access restricted: You do not have permission for this section.', 'warning');
    router.navigate(['/dashboard']);
    return false;
  }

  return permissionService.ensureLoaded().pipe(
    map(() => {
      if (checkAccess()) {
        return true;
      }
      toast.show('Access restricted: You do not have permission for this section.', 'warning');
      router.navigate(['/dashboard']);
      return false;
    })
  );
};

export const superAdminOnlyGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const toast = inject(ToastService);

  if (authStore.currentAccount()?.roleType === 'SuperAdmin') {
    return true;
  }

  toast.show('Platform Partner Management is restricted to SuperAdmin.', 'warning');
  router.navigate(['/dashboard']);
  return false;
};
