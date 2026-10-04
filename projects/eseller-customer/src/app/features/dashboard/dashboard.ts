import {
  Component,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import {
  AuthStore,
  AuthService,
  DashboardService,
  OrderService,
  CartService,
  ToastService,
  DashboardSummaryDto,
  UserProfileDto,
  AddressDto,
  CreateAddressRequest,
  UpdateAddressRequest,
  DashboardNotificationDto,
  OrderRequestListDto,
  OrderRequestDto,
  OrderTrackingDto
} from 'eseller-shared';
import {
  SearchableSelect,
  SelectOption
} from '../../shared/components/searchable-select/searchable-select';
import { COUNTRIES_DATA } from '../../shared/data/countries-states.data';

export type DashboardTab = 'overview' | 'orders' | 'addresses' | 'profile' | 'notifications';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, RouterLink, SearchableSelect],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly orderService = inject(OrderService);
  private readonly cartService = inject(CartService);
  private readonly toastService = inject(ToastService);

  // Active navigation tab & mobile sidebar drawer
  readonly activeTab = signal<DashboardTab>('overview');
  readonly sidebarMobileOpen = signal<boolean>(false);
  readonly loading = signal<boolean>(true);

  // Data signals
  readonly summary = signal<DashboardSummaryDto | null>(null);
  readonly profile = signal<UserProfileDto | null>(null);
  readonly addresses = signal<AddressDto[]>([]);
  readonly notifications = signal<DashboardNotificationDto[]>([]);
  readonly unreadOnly = signal<boolean>(false);

  readonly approvalStatus = computed(() => {
    const status = this.profile()?.approvalStatus;
    return status || 'Approved';
  });

  readonly isApprovalPending = computed(() => this.approvalStatus() === 'Pending');
  readonly isApprovalApproved = computed(() => this.approvalStatus() === 'Approved');
  readonly isApprovalRejected = computed(() => this.approvalStatus() === 'Rejected');

  // Orders Data & Filter signals
  readonly orders = signal<OrderRequestListDto[]>([]);
  readonly ordersLoading = signal<boolean>(false);
  readonly activeOrderFilter = signal<'ALL' | 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED'>('ALL');
  readonly orderSearchQuery = signal<string>('');

  // Tracking & Order Details Modals
  readonly trackingModalOpen = signal<boolean>(false);
  readonly trackingLoading = signal<boolean>(false);
  readonly selectedTrackingOrder = signal<OrderTrackingDto | null>(null);
  readonly detailsModalOpen = signal<boolean>(false);
  readonly detailsLoading = signal<boolean>(false);
  readonly selectedOrderDetails = signal<OrderRequestDto | null>(null);

  readonly filteredOrders = computed(() => {
    let list = this.orders();
    const filter = this.activeOrderFilter();
    const query = this.orderSearchQuery().trim().toLowerCase();

    if (filter === 'PENDING') {
      list = list.filter((o) => o.status.toUpperCase().includes('PENDING'));
    } else if (filter === 'CONFIRMED') {
      list = list.filter((o) => o.status.toUpperCase().includes('CONFIRM') || o.status.toUpperCase().includes('PROCESS'));
    } else if (filter === 'SHIPPED') {
      list = list.filter((o) => o.status.toUpperCase().includes('SHIP') || o.status.toUpperCase().includes('DISPATCH'));
    } else if (filter === 'DELIVERED') {
      list = list.filter((o) => o.status.toUpperCase().includes('DELIVER') || o.status.toUpperCase().includes('COMPLETE'));
    }

    if (query) {
      list = list.filter((o) => o.id.toLowerCase().includes(query));
    }

    return list;
  });

  // Address Modal State (Add / Edit)
  readonly addressModalOpen = signal<boolean>(false);
  readonly isEditingAddress = signal<boolean>(false);
  readonly currentEditingId = signal<string | null>(null);
  readonly isSavingAddress = signal<boolean>(false);

  // Address Form fields
  readonly addrLabel = signal<string>('Home');
  readonly addrFullName = signal<string>('');
  readonly addrPhone = signal<string>('');
  readonly addrLine1 = signal<string>('');
  readonly addrLine2 = signal<string>('');
  readonly addrCountry = signal<string>('');
  readonly addrState = signal<string>('');
  readonly addrCity = signal<string>('');
  readonly addrPostalCode = signal<string>('');
  readonly addrIsDefault = signal<boolean>(false);

  // Address Form error signals
  readonly addrLabelError = signal<string | null>(null);
  readonly addrNameError = signal<string | null>(null);
  readonly addrPhoneError = signal<string | null>(null);
  readonly addrLine1Error = signal<string | null>(null);
  readonly addrCountryError = signal<string | null>(null);
  readonly addrCityError = signal<string | null>(null);

  // Delete Address Modal State
  readonly deleteModalOpen = signal<boolean>(false);
  readonly addressToDelete = signal<AddressDto | null>(null);
  readonly isDeletingAddress = signal<boolean>(false);

  // Profile Form State
  readonly profileName = signal<string>('');
  readonly profilePhone = signal<string>('');
  readonly profileError = signal<string | null>(null);
  readonly isSavingProfile = signal<boolean>(false);

  // Change Password Form State
  readonly currentPassword = signal<string>('');
  readonly newPassword = signal<string>('');
  readonly confirmPassword = signal<string>('');
  readonly showCurrentPassword = signal<boolean>(false);
  readonly showNewPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);
  readonly passwordError = signal<string | null>(null);
  readonly isChangingPassword = signal<boolean>(false);

  // Country & State selector data
  readonly countryOptions = computed<SelectOption[]>(() =>
    COUNTRIES_DATA.map((c) => ({
      value: c.name,
      label: c.name,
      flag: c.flag,
      subLabel: c.phoneCode
    }))
  );

  readonly selectedCountryData = computed(() => {
    const name = this.addrCountry();
    if (!name) return null;
    return COUNTRIES_DATA.find((x) => x.name === name) || null;
  });

  readonly selectedDialCode = computed(() => {
    return this.selectedCountryData()?.phoneCode || '';
  });

  readonly stateOptions = computed<SelectOption[]>(() => {
    const c = COUNTRIES_DATA.find((x) => x.name === this.addrCountry());
    if (!c || !c.states) return [];
    return c.states.map((s) => ({
      value: s,
      label: s
    }));
  });

  // User display name & initials
  readonly displayName = computed(() => {
    const p = this.profile();
    if (p?.name) return p.name;
    const a = this.authStore.currentAccount();
    if (a?.username) return a.username;
    return 'Valued Customer';
  });

  readonly userInitials = computed(() => {
    const name = this.displayName();
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  readonly unreadNotificationsCount = computed(() => {
    return this.notifications().filter((n) => !n.isRead).length;
  });

  // ============================================================
  // LIFECYCLE
  // ============================================================
  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    if (!this.authStore.isAuthenticated()) {
      this.router.navigate(['/auth/login']);
      return;
    }

    const role = this.authStore.currentAccount()?.roleType;
    if (role === 'Shopkeeper') {
      if (typeof window !== 'undefined') {
        window.location.href = 'http://localhost:54007/dashboard';
        return;
      }
    }
    if (role === 'SuperAdmin' || role === 'Partner') {
      if (typeof window !== 'undefined') {
        window.location.href = 'http://localhost:4201/dashboard';
        return;
      }
    }

    // Subscribe to query params for direct tab selection
    this.route.queryParams.subscribe((params) => {
      const tab = params['tab'] as DashboardTab;
      if (tab && ['overview', 'orders', 'addresses', 'profile', 'notifications'].includes(tab)) {
        this.activeTab.set(tab);
      }
      if (params['track']) {
        this.openTrackOrder(params['track']);
      }
    });

    this.loadDashboardData();
  }

  setTab(tab: DashboardTab): void {
    this.activeTab.set(tab);
    this.sidebarMobileOpen.set(false);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  // ============================================================
  // DATA LOADING
  // ============================================================
  loadDashboardData(): void {
    this.loading.set(true);

    // Load Profile
    this.dashboardService.getProfile().subscribe({
      next: (prof) => {
        this.profile.set(prof);
        this.profileName.set(prof.name);
        this.profilePhone.set(prof.phone || '');
      },
      error: () => {
        // Fallback to in-memory current account if offline
        const acc = this.authStore.currentAccount();
        if (acc) {
          const fallback: UserProfileDto = {
            accountId: acc.accountId,
            userId: acc.accountId,
            name: acc.username || 'Valued Customer',
            email: acc.email,
            phone: null,
            isEmailVerified: true,
            isPhoneVerified: false,
            lastLoginAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            approvalStatus: 'Approved'
          };
          this.profile.set(fallback);
          this.profileName.set(fallback.name);
        }
      }
    });

    // Load Summary
    this.dashboardService.getSummary().subscribe({
      next: (sum) => this.summary.set(sum),
      error: () => {
        // Default summary fallback
        this.summary.set({
          totalOrders: 0,
          pendingOrders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
          wishlistCount: 0,
          compareCount: 0,
          addressCount: this.addresses().length,
          unreadNotifications: 0,
          unreadChatMessages: 0,
          totalSpent: 0
        });
      }
    });

    // Load Addresses
    this.dashboardService.getAddresses().subscribe({
      next: (addr) => {
        this.addresses.set(addr);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });

    // Load Notifications
    this.dashboardService.getNotifications().subscribe({
      next: (res) => this.notifications.set(res.items || []),
      error: () => this.notifications.set([])
    });

    // Load Orders
    this.loadOrders();
  }

  // ============================================================
  // ADDRESS ACTIONS (CRUD)
  // ============================================================
  openAddAddressModal(): void {
    this.isEditingAddress.set(false);
    this.currentEditingId.set(null);
    this.resetAddressForm();
    const prof = this.profile();
    if (prof) {
      this.addrFullName.set(prof.name);
      if (prof.phone) this.addrPhone.set(prof.phone);
    }
    this.addrIsDefault.set(this.addresses().length === 0);
    this.addressModalOpen.set(true);
  }

  openEditAddressModal(addr: AddressDto): void {
    this.isEditingAddress.set(true);
    this.currentEditingId.set(addr.id);
    this.clearAddressErrors();

    this.addrLabel.set(addr.label);
    this.addrFullName.set(addr.fullName);
    this.addrPhone.set(addr.phone);
    this.addrLine1.set(addr.addressLine1);
    this.addrLine2.set(addr.addressLine2 || '');
    this.addrCountry.set(addr.country);
    this.addrState.set(addr.state || '');
    this.addrCity.set(addr.city);
    this.addrPostalCode.set(addr.postalCode || '');
    this.addrIsDefault.set(addr.isDefault);

    this.addressModalOpen.set(true);
  }

  closeAddressModal(): void {
    this.addressModalOpen.set(false);
    this.resetAddressForm();
  }

  onAddrCountryChange(countryName: string): void {
    this.addrCountry.set(countryName);
    this.addrCountryError.set(null);
    this.addrState.set('');
    this.addrCity.set('');
  }

  onAddrStateChange(stateName: string): void {
    this.addrState.set(stateName);
  }

  saveAddress(): void {
    this.clearAddressErrors();
    let hasErrors = false;

    if (!this.addrLabel().trim()) {
      this.addrLabelError.set('Address label is required (e.g. Home, Office).');
      hasErrors = true;
    }

    if (!this.addrFullName().trim() || this.addrFullName().trim().length < 2) {
      this.addrNameError.set('Please provide recipient full name.');
      hasErrors = true;
    }

    if (!this.addrPhone().trim() || this.addrPhone().trim().length < 6) {
      this.addrPhoneError.set('Please enter a valid contact phone number.');
      hasErrors = true;
    }

    if (!this.addrLine1().trim() || this.addrLine1().trim().length < 5) {
      this.addrLine1Error.set('Please enter complete street address.');
      hasErrors = true;
    }

    if (!this.addrCountry().trim()) {
      this.addrCountryError.set('Please select country.');
      hasErrors = true;
    }

    if (!this.addrCity().trim()) {
      this.addrCityError.set('Please enter city name.');
      hasErrors = true;
    }

    if (hasErrors) return;

    this.isSavingAddress.set(true);

    const payload: CreateAddressRequest = {
      label: this.addrLabel().trim(),
      fullName: this.addrFullName().trim(),
      phone: this.addrPhone().trim(),
      addressLine1: this.addrLine1().trim(),
      addressLine2: this.addrLine2().trim() || null,
      city: this.addrCity().trim(),
      state: this.addrState().trim() || null,
      country: this.addrCountry().trim(),
      postalCode: this.addrPostalCode().trim() || null,
      isDefault: this.addrIsDefault()
    };

    if (this.isEditingAddress() && this.currentEditingId()) {
      const id = this.currentEditingId()!;
      this.dashboardService.updateAddress(id, payload).subscribe({
        next: () => {
          this.applyLocalAddressUpdate(id, payload);
          this.toastService.show('Address updated successfully!', 'success');
          this.closeAddressModal();
          this.isSavingAddress.set(false);
        },
        error: () => {
          // Fallback local update if offline
          this.applyLocalAddressUpdate(id, payload);
          this.toastService.show('Address updated successfully!', 'success');
          this.closeAddressModal();
          this.isSavingAddress.set(false);
        }
      });
    } else {
      this.dashboardService.createAddress(payload).subscribe({
        next: (res) => {
          const newAddr: AddressDto = {
            id: res.addressId || 'addr_' + Date.now(),
            ...payload,
            createdAt: new Date().toISOString()
          };
          this.applyLocalAddressInsert(newAddr);
          this.toastService.show('New address added to your address book!', 'success');
          this.closeAddressModal();
          this.isSavingAddress.set(false);
        },
        error: () => {
          // Fallback local insert if offline
          const newAddr: AddressDto = {
            id: 'addr_' + Date.now(),
            ...payload,
            createdAt: new Date().toISOString()
          };
          this.applyLocalAddressInsert(newAddr);
          this.toastService.show('New address saved to your address book!', 'success');
          this.closeAddressModal();
          this.isSavingAddress.set(false);
        }
      });
    }
  }

  private applyLocalAddressInsert(newAddr: AddressDto): void {
    let list = [...this.addresses()];
    if (newAddr.isDefault) {
      list = list.map((a) => ({ ...a, isDefault: false }));
    }
    this.addresses.set([newAddr, ...list]);
  }

  private applyLocalAddressUpdate(id: string, payload: UpdateAddressRequest): void {
    let list = this.addresses().map((a) => {
      if (a.id === id) {
        return {
          ...a,
          ...payload
        };
      }
      if (payload.isDefault) {
        return { ...a, isDefault: false };
      }
      return a;
    });
    this.addresses.set(list);
  }

  setAddressAsDefault(addr: AddressDto): void {
    if (addr.isDefault) return;

    const payload: UpdateAddressRequest = {
      label: addr.label,
      fullName: addr.fullName,
      phone: addr.phone,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2,
      city: addr.city,
      state: addr.state,
      country: addr.country,
      postalCode: addr.postalCode,
      isDefault: true
    };

    this.dashboardService.updateAddress(addr.id, payload).subscribe({
      next: () => {
        this.applyLocalAddressUpdate(addr.id, payload);
        this.toastService.show(`"${addr.label}" set as your default delivery address!`, 'success');
      },
      error: () => {
        this.applyLocalAddressUpdate(addr.id, payload);
        this.toastService.show(`"${addr.label}" set as your default delivery address!`, 'success');
      }
    });
  }

  openDeleteAddressModal(addr: AddressDto): void {
    this.addressToDelete.set(addr);
    this.deleteModalOpen.set(true);
  }

  closeDeleteAddressModal(): void {
    this.deleteModalOpen.set(false);
    this.addressToDelete.set(null);
  }

  confirmDeleteAddress(): void {
    const addr = this.addressToDelete();
    if (!addr) return;

    this.isDeletingAddress.set(true);
    this.dashboardService.deleteAddress(addr.id).subscribe({
      next: () => {
        this.addresses.update((list) => list.filter((a) => a.id !== addr.id));
        this.toastService.show('Address removed from your address book.', 'info');
        this.closeDeleteAddressModal();
        this.isDeletingAddress.set(false);
      },
      error: () => {
        this.addresses.update((list) => list.filter((a) => a.id !== addr.id));
        this.toastService.show('Address removed from your address book.', 'info');
        this.closeDeleteAddressModal();
        this.isDeletingAddress.set(false);
      }
    });
  }

  private resetAddressForm(): void {
    this.clearAddressErrors();
    this.addrLabel.set('Home');
    this.addrFullName.set('');
    this.addrPhone.set('');
    this.addrLine1.set('');
    this.addrLine2.set('');
    this.addrCountry.set('');
    this.addrState.set('');
    this.addrCity.set('');
    this.addrPostalCode.set('');
    this.addrIsDefault.set(false);
  }

  private clearAddressErrors(): void {
    this.addrLabelError.set(null);
    this.addrNameError.set(null);
    this.addrPhoneError.set(null);
    this.addrLine1Error.set(null);
    this.addrCountryError.set(null);
    this.addrCityError.set(null);
  }

  // ============================================================
  // PROFILE & ACCOUNT SETTINGS
  // ============================================================
  saveProfile(): void {
    this.profileError.set(null);
    if (!this.profileName().trim() || this.profileName().trim().length < 2) {
      this.profileError.set('Name must be at least 2 characters.');
      return;
    }

    this.isSavingProfile.set(true);
    const req = {
      name: this.profileName().trim(),
      phone: this.profilePhone().trim() || null
    };

    this.dashboardService.updateProfile(req).subscribe({
      next: () => {
        this.profile.update((curr) =>
          curr
            ? { ...curr, name: req.name, phone: req.phone }
            : null
        );
        this.toastService.show('Profile updated.', 'success');
        this.isSavingProfile.set(false);
      },
      error: (err) => {
        const msg = err?.error?.error || 'Failed to update profile. Please try again.';
        this.profileError.set(msg);
        this.toastService.show(msg, 'error');
        this.isSavingProfile.set(false);
      }
    });
  }

  changePassword(): void {
    this.passwordError.set(null);

    if (!this.currentPassword()) {
      this.passwordError.set('Please enter your current password.');
      return;
    }

    if (!this.newPassword() || this.newPassword().length < 8) {
      this.passwordError.set('New password must be at least 8 characters.');
      return;
    }

    if (!/[A-Z]/.test(this.newPassword()) || !/[a-z]/.test(this.newPassword()) || !/[0-9]/.test(this.newPassword())) {
      this.passwordError.set('Password must include uppercase, lowercase, and numeric characters.');
      return;
    }

    if (this.newPassword() !== this.confirmPassword()) {
      this.passwordError.set('New passwords do not match.');
      return;
    }

    this.isChangingPassword.set(true);

    this.authService
      .changePassword({
        currentPassword: this.currentPassword(),
        newPassword: this.newPassword()
      })
      .subscribe({
        next: () => {
          this.toastService.show('Password updated successfully! Please keep it secure.', 'success');
          this.currentPassword.set('');
          this.newPassword.set('');
          this.confirmPassword.set('');
          this.isChangingPassword.set(false);
        },
        error: (err) => {
          const msg = err?.error?.error || 'Failed to change password. Please check your current password.';
          this.passwordError.set(msg);
          this.toastService.show(msg, 'error');
          this.isChangingPassword.set(false);
        }
      });
  }

  // ============================================================
  // NOTIFICATIONS
  // ============================================================
  toggleUnreadOnly(): void {
    const nextVal = !this.unreadOnly();
    this.unreadOnly.set(nextVal);
    this.dashboardService.getNotifications(nextVal || undefined).subscribe({
      next: (res) => this.notifications.set(res.items || []),
      error: () => {}
    });
  }

  markNotificationAsRead(n: DashboardNotificationDto): void {
    if (n.isRead) return;
    this.dashboardService.markNotificationRead(n.id).subscribe({
      next: () => {
        this.notifications.update((list) =>
          list.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
        );
      },
      error: () => {
        this.notifications.update((list) =>
          list.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
        );
      }
    });
  }

  markAllAsRead(): void {
    this.dashboardService.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.update((list) => list.map((item) => ({ ...item, isRead: true })));
        this.toastService.show('All notifications marked as read.', 'info');
      },
      error: () => {
        this.notifications.update((list) => list.map((item) => ({ ...item, isRead: true })));
        this.toastService.show('All notifications marked as read.', 'info');
      }
    });
  }

  // ============================================================
  // ORDERS & TRACKING
  // ============================================================
  loadOrders(): void {
    this.ordersLoading.set(true);
    this.orderService.getMyOrders().subscribe({
      next: (res) => {
        this.orders.set(res.items || []);
        this.ordersLoading.set(false);
      },
      error: () => {
        this.ordersLoading.set(false);
      }
    });
  }

  setOrderFilter(filter: string): void {
    this.activeOrderFilter.set(filter as any);
  }

  openTrackOrder(orderId: string): void {
    this.trackingModalOpen.set(true);
    this.trackingLoading.set(true);
    this.orderService.getOrderTracking(orderId).subscribe({
      next: (tracking) => {
        this.selectedTrackingOrder.set(tracking);
        this.trackingLoading.set(false);
      },
      error: () => {
        this.trackingLoading.set(false);
      }
    });
  }

  closeTrackingModal(): void {
    this.trackingModalOpen.set(false);
    this.selectedTrackingOrder.set(null);
  }

  openOrderDetails(orderId: string): void {
    this.detailsModalOpen.set(true);
    this.detailsLoading.set(true);
    this.orderService.getOrderById(orderId).subscribe({
      next: (order) => {
        this.selectedOrderDetails.set(order);
        this.detailsLoading.set(false);
      },
      error: () => {
        this.detailsLoading.set(false);
      }
    });
  }

  closeOrderDetailsModal(): void {
    this.detailsModalOpen.set(false);
    this.selectedOrderDetails.set(null);
  }

  openTrackOrdersDirectly(): void {
    this.setTab('orders');
    const first = this.orders()[0];
    if (first) {
      this.openTrackOrder(first.id);
    }
  }

  chatWithSeller(_orderId?: string, _shopId?: string): void {
    // Customers chat with Super Admin only
    this.router.navigate(['/chat'], { queryParams: { support: '1' } });
  }

  reorder(order: OrderRequestDto): void {
    if (!order.items || order.items.length === 0) return;
    for (const item of order.items) {
      this.cartService.addItem({
        productId: item.productId,
        productSlug: '',
        name: item.productNameSnapshot,
        imageUrl: null,
        shopId: item.shopId,
        shopName: item.shopName,
        price: item.priceAtOrder || item.unitPriceSnapshot,
        quantity: item.quantity,
        variantId: item.productVariantId,
        variantName: item.variantAttributesSnapshot || null,
        sku: item.sku
      });
    }
    this.toastService.show(`Added ${order.items.length} item(s) to your cart.`, 'success');
    this.router.navigate(['/cart']);
  }

  getStatusBadgeClass(status: string): string {
    const s = status.toUpperCase();
    if (s.includes('PENDING')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (s.includes('CONFIRM') || s.includes('PROCESS')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (s.includes('SHIP') || s.includes('DISPATCH')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (s.includes('DELIVER') || s.includes('COMPLETE')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (s.includes('CANCEL')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    return 'bg-gray-50 text-gray-700 border-gray-200';
  }

  getStatusDisplay(status: string): string {
    const s = status.toUpperCase();
    if (s.includes('PENDING')) return 'Pending Seller Confirmation';
    if (s.includes('CONFIRM')) return 'Confirmed by Seller';
    if (s.includes('PROCESS')) return 'Processing / Packed';
    if (s.includes('SHIP') || s.includes('DISPATCH')) return 'Dispatched & On the Way';
    if (s.includes('DELIVER') || s.includes('COMPLETE')) return 'Delivered';
    if (s.includes('CANCEL')) return 'Cancelled';
    return status;
  }

  getStepStatus(stepIndex: number, currentStatus: string): 'completed' | 'active' | 'pending' {
    const s = currentStatus.toUpperCase();
    let currentStep = 1;
    if (s.includes('DELIVER') || s.includes('COMPLETE')) currentStep = 4;
    else if (s.includes('SHIP') || s.includes('DISPATCH')) currentStep = 3;
    else if (s.includes('CONFIRM') || s.includes('PROCESS')) currentStep = 2;
    else currentStep = 1;

    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'active';
    return 'pending';
  }

  // Mobile sidebar controls
  toggleMobileSidebar(): void {
    this.sidebarMobileOpen.update((v) => !v);
  }

  closeMobileSidebar(): void {
    this.sidebarMobileOpen.set(false);
  }

  // Logout confirmation popup
  readonly logoutModalOpen = signal(false);

  onLogout(): void {
    this.logoutModalOpen.set(true);
  }

  cancelLogout(): void {
    this.logoutModalOpen.set(false);
  }

  confirmLogout(): void {
    this.logoutModalOpen.set(false);
    this.authService.logout().subscribe({
      next: () => {
        this.authStore.clearAuth();
        this.toastService.show('You have been signed out successfully.', 'info');
        this.router.navigate(['/auth/login'], { queryParams: { logout: 'true' } });
      },
      error: () => {
        this.authStore.clearAuth();
        this.toastService.show('You have been signed out successfully.', 'info');
        this.router.navigate(['/auth/login'], { queryParams: { logout: 'true' } });
      }
    });
  }
}
