import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService, SkeletonLayout, AuthStore } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminPartnerDto } from '../../../core/models/admin.models';
import { 
  PLATFORM_PERMISSIONS, 
  PERMISSION_CATEGORIES, 
  PermissionDefinition 
} from '../../../core/services/admin-permission.service';

@Component({
  selector: 'app-partner-management',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
  templateUrl: './partner-management.html'
})
export class PartnerManagement implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);
  readonly authStore = inject(AuthStore);

  readonly isLoading = signal<boolean>(true);
  readonly partners = signal<AdminPartnerDto[]>([]);
  readonly isSaving = signal<boolean>(false);

  // Maximum 3 Partners constraint
  readonly maxPartners = 3;
  readonly activePartnersCount = computed(() => {
    const list = Array.isArray(this.partners()) ? this.partners() : [];
    return list.filter(p => p && p.isActive !== false).length;
  });
  readonly canAddPartner = computed(() => 
    this.activePartnersCount() < this.maxPartners
  );

  // Granular Permissions Metadata
  readonly allPermissions: PermissionDefinition[] = PLATFORM_PERMISSIONS;
  readonly categories: string[] = PERMISSION_CATEGORIES;

  // Add / Edit Partner Modal
  readonly modalOpen = signal<boolean>(false);
  readonly modalMode = signal<'create' | 'edit'>('create');
  readonly editingPartner = signal<AdminPartnerDto | null>(null);

  readonly formEmail = signal<string>('');
  readonly formPassword = signal<string>('');
  readonly formPermissions = signal<Record<string, boolean>>({});

  ngOnInit(): void {
    this.loadPartners();
  }

  loadPartners(): void {
    this.isLoading.set(true);
    this.adminService.getPartners().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : (res?.items || []);
        this.partners.set(list);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.partners.set([]);
        this.toast.show(err?.error?.error || 'Failed to load partners', 'error');
      }
    });
  }

  getCategoryPermissions(category: string): PermissionDefinition[] {
    return this.allPermissions.filter(p => p.category === category);
  }

  openAddModal(): void {
    if (!this.canAddPartner()) {
      this.toast.show('Maximum limit of 3 partners reached. You cannot add more partners.', 'error');
      return;
    }
    this.modalMode.set('create');
    this.editingPartner.set(null);
    this.formEmail.set('');
    this.formPassword.set('');

    // Default safe operations permissions
    const initPerms: Record<string, boolean> = {};
    for (const p of this.allPermissions) {
      initPerms[p.key] = !p.isConfidential;
    }
    this.formPermissions.set(initPerms);
    this.modalOpen.set(true);
  }

  openEditModal(partner: AdminPartnerDto): void {
    this.modalMode.set('edit');
    this.editingPartner.set(partner);
    this.formEmail.set(partner.email || partner.name || '');
    this.formPassword.set('');

    const assigned = this.parsePartnerPermissions(partner.permissions);
    const hasAll = assigned.includes('*') || assigned.includes('all');

    const initPerms: Record<string, boolean> = {};
    for (const p of this.allPermissions) {
      if (hasAll) {
        initPerms[p.key] = true;
      } else {
        const prefix = p.key.split(':')[0];
        initPerms[p.key] = assigned.includes(p.key) || assigned.includes(prefix);
      }
    }
    this.formPermissions.set(initPerms);
    this.modalOpen.set(true);
  }

  parsePartnerPermissions(perms: any): string[] {
    if (!perms) return [];
    if (Array.isArray(perms)) return perms.map(x => String(x).trim());
    if (typeof perms === 'string') {
      try {
        if (perms.trim().startsWith('[')) {
          const parsed = JSON.parse(perms);
          if (Array.isArray(parsed)) return parsed.map(x => String(x).trim());
        }
      } catch {}
      return perms.split(',').map(x => x.trim()).filter(Boolean);
    }
    return [];
  }

  setPreset(preset: 'all' | 'operations' | 'readonly' | 'clear'): void {
    const updated: Record<string, boolean> = {};
    for (const p of this.allPermissions) {
      if (preset === 'all') {
        updated[p.key] = true;
      } else if (preset === 'clear') {
        updated[p.key] = false;
      } else if (preset === 'readonly') {
        updated[p.key] = p.key.endsWith(':view');
      } else if (preset === 'operations') {
        // Safe operational authority, excluding confidential authorities
        updated[p.key] = !p.isConfidential;
      }
    }
    this.formPermissions.set(updated);
  }

  togglePermission(key: string): void {
    const current = { ...this.formPermissions() };
    current[key] = !current[key];
    this.formPermissions.set(current);
  }

  selectedPermissionsCount(): number {
    return Object.values(this.formPermissions()).filter(Boolean).length;
  }

  formatPermissionBadge(perm: string): string {
    const found = this.allPermissions.find(p => p.key === perm);
    return found ? found.label : perm;
  }

  isPermissionConfidential(perm: string): boolean {
    const found = this.allPermissions.find(p => p.key === perm);
    return !!found?.isConfidential;
  }

  // Deactivate Modal State
  readonly deactivateModalOpen = signal<boolean>(false);
  readonly partnerToDeactivate = signal<AdminPartnerDto | null>(null);
  readonly isDeactivating = signal<boolean>(false);

  isSelf(partner: AdminPartnerDto): boolean {
    const cur = this.authStore.currentAccount();
    if (!cur) return false;
    if (partner.accountId && cur.accountId && partner.accountId.toLowerCase() === cur.accountId.toLowerCase()) return true;
    if (partner.email && cur.email && partner.email.toLowerCase() === cur.email.toLowerCase()) return true;
    return false;
  }

  promptDeactivatePartner(partner: AdminPartnerDto): void {
    if (this.isSelf(partner)) {
      this.toast.show('You cannot deactivate your own account.', 'error');
      return;
    }
    this.partnerToDeactivate.set(partner);
    this.deactivateModalOpen.set(true);
  }

  cancelDeactivatePartner(): void {
    this.deactivateModalOpen.set(false);
    this.partnerToDeactivate.set(null);
  }

  confirmDeactivatePartner(): void {
    const partner = this.partnerToDeactivate();
    if (!partner) return;

    this.isDeactivating.set(true);
    this.adminService.deactivatePartner(partner.id).subscribe({
      next: () => {
        this.isDeactivating.set(false);
        this.deactivateModalOpen.set(false);
        this.partnerToDeactivate.set(null);
        this.toast.show(`Partner "${partner.email}" deactivated successfully.`, 'success');
        this.loadPartners();
      },
      error: (err) => {
        this.isDeactivating.set(false);
        this.toast.show(err?.error?.error || 'Failed to deactivate partner', 'error');
      }
    });
  }

  activatePartner(partner: AdminPartnerDto): void {
    if (!this.canAddPartner()) {
      this.toast.show('Maximum limit of 3 active partners reached. Deactivate an existing partner first.', 'error');
      return;
    }
    this.adminService.activatePartner(partner.id).subscribe({
      next: () => {
        this.toast.show(`Partner "${partner.email}" activated successfully.`, 'success');
        this.loadPartners();
      },
      error: (err) => {
        const msg = err?.error?.error || 'Failed to activate partner';
        this.toast.show(msg, 'error');
      }
    });
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editingPartner.set(null);
  }

  savePartner(): void {
    const selectedPerms = Object.keys(this.formPermissions()).filter(k => this.formPermissions()[k]);

    if (this.modalMode() === 'create') {
      const email = this.formEmail().trim();
      const password = this.formPassword();

      if (!email || !password) {
        this.toast.show('Email and temporary password are required', 'error');
        return;
      }

      this.isSaving.set(true);
      this.adminService.addPartner({
        email,
        password,
        permissions: selectedPerms
      }).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.toast.show(`Partner "${email}" created successfully`, 'success');
          this.closeModal();
          this.loadPartners();
        },
        error: (err) => {
          this.isSaving.set(false);
          const errMsg = err?.error?.error 
            || (err?.error?.errors ? Object.values(err.error.errors).flat().join(', ') : null)
            || err?.message 
            || 'Failed to create partner account';
          this.toast.show(errMsg, 'error');
        }
      });
    } else {
      const partner = this.editingPartner();
      if (!partner) return;

      this.isSaving.set(true);
      const newPwd = this.formPassword().trim() || undefined;
      this.adminService.updatePartner(partner.id, selectedPerms, newPwd).subscribe({
        next: () => {
          this.isSaving.set(false);
          const msg = newPwd 
            ? `Permissions and password updated for "${partner.email}"`
            : `Permissions updated for "${partner.email}"`;
          this.toast.show(msg, 'success');
          this.closeModal();
          this.loadPartners();
        },
        error: (err) => {
          this.isSaving.set(false);
          const errMsg = err?.error?.error 
            || (err?.error?.errors ? Object.values(err.error.errors).flat().join(', ') : null)
            || err?.message 
            || 'Failed to update partner permissions';
          this.toast.show(errMsg, 'error');
        }
      });
    }
  }
}
