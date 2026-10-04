import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from 'eseller-shared';
import { AdminService } from '../../../core/services/admin.service';
import { AdminPartnerDto } from '../../../core/models/admin.models';

@Component({
  selector: 'app-partner-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './partner-management.html'
})
export class PartnerManagement implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

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

  // Add Partner Modal
  readonly modalOpen = signal<boolean>(false);
  readonly formEmail = signal<string>('');
  readonly formPassword = signal<string>('');
  readonly formPermissions = signal<{ [key: string]: boolean }>({
    shops: true,
    products: true,
    orders: true,
    finance: false,
    content: true,
    settings: false
  });

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

  openAddModal(): void {
    if (!this.canAddPartner()) {
      this.toast.show('Maximum limit of 3 partners reached. You cannot add more partners.', 'error');
      return;
    }
    this.formEmail.set('');
    this.formPassword.set('');
    this.formPermissions.set({
      shops: true,
      products: true,
      orders: true,
      finance: false,
      content: true,
      settings: false
    });
    this.modalOpen.set(true);
  }

  // Deactivate Modal State
  readonly deactivateModalOpen = signal<boolean>(false);
  readonly partnerToDeactivate = signal<AdminPartnerDto | null>(null);
  readonly isDeactivating = signal<boolean>(false);

  promptDeactivatePartner(partner: AdminPartnerDto): void {
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

  closeModal(): void {
    this.modalOpen.set(false);
  }

  togglePermission(key: string): void {
    const current = { ...this.formPermissions() };
    current[key] = !current[key];
    this.formPermissions.set(current);
  }

  savePartner(): void {
    const email = this.formEmail().trim();
    const password = this.formPassword();

    if (!email || !password) {
      this.toast.show('Email and temporary password are required', 'error');
      return;
    }

    const selectedPerms = Object.keys(this.formPermissions()).filter(k => this.formPermissions()[k]);

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
        this.toast.show(err?.error?.error || 'Failed to create partner account', 'error');
      }
    });
  }
}
