import { Component, OnInit, OnDestroy, inject, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AuthStore,
  SignalRService,
  ChatService,
  OrderService,
  SignalRIncomingMessage
} from 'eseller-shared';
import { HubConnectionState } from '@microsoft/signalr';

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'superadmin' | 'seller' | 'system';
  text: string;
  timestamp: Date;
  isOrderNotification?: boolean;
}

export interface StoredOrder {
  orderRef: string;
  createdAt: string;
  shopId: string;
  shopName: string;
  customer: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
    province: string;
    state?: string;
    country?: string;
    notes?: string;
  };
  items: Array<{
    id: string;
    productId: string;
    productSlug: string;
    name: string;
    imageUrl: string | null;
    shopId: string;
    shopName: string;
    price: number;
    quantity: number;
    variantId?: string | null;
    variantName?: string | null;
    sku?: string | null;
  }>;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  status: 'PENDING_SELLER_CONFIRMATION' | 'CONFIRMED' | 'DISPATCHED';
}

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat.html',
  styleUrl: './chat.css'
})
export class Chat implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly authStore = inject(AuthStore);
  readonly signalRService = inject(SignalRService);
  readonly chatService = inject(ChatService);
  readonly orderService = inject(OrderService);

  @ViewChild('chatFeedContainer') private chatFeedContainer?: ElementRef<HTMLDivElement>;

  // SignalR & Live State
  readonly currentOrderRequestId = signal<string | null>(null);
  readonly signalRState = computed(() => this.signalRService.chatState());
  private unsubscribeReceiveMessage?: () => void;

  // Chat conversation state
  readonly order = signal<StoredOrder | null>(null);
  readonly adminName = signal<string>('Eseller Super Admin');
  readonly adminRole = signal<string>('Official Platform Admin');
  readonly adminBadge = signal<string>('Super Admin Desk');
  readonly shopName = signal<string>('Eseller Super Admin');
  readonly shopId = signal<string>('');
  readonly orderStatus = signal<'PENDING' | 'CONFIRMED' | 'DISPATCHED'>('PENDING');
  readonly messages = signal<ChatMessage[]>([]);
  readonly messageText = signal<string>('');
  readonly isTyping = signal<boolean>(false);
  readonly feedbackMessage = signal<string | null>(null);

  // Recent order conversations from localStorage
  readonly pastOrders = signal<StoredOrder[]>([]);

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    this.initSignalR();
    this.loadPastOrders();

    this.route.queryParamMap.subscribe((params) => {
      const orderRef = params.get('orderRef');
      const shopIdParam = params.get('shopId');

      if (shopIdParam) {
        this.shopId.set(shopIdParam);
      }

      this.initConversation(orderRef, shopIdParam);
    });
  }

  ngOnDestroy(): void {
    if (this.currentOrderRequestId()) {
      this.signalRService.leaveOrderRoom(this.currentOrderRequestId()!).catch(() => {});
    }
    this.unsubscribeReceiveMessage?.();
  }

  private initSignalR(): void {
    if (this.authStore.isAuthenticated()) {
      this.signalRService.startChatConnection()
        .then(() => {
          this.unsubscribeReceiveMessage = this.signalRService.onReceiveMessage((incoming) => {
            this.handleIncomingSignalRMessage(incoming);
          });
          // Join room if orderRef was already set before connection completed
          const orderId = this.currentOrderRequestId();
          if (orderId) {
            this.signalRService.joinOrderRoom(orderId).catch(() => {});
          }
        })
        .catch((err) => {
          console.warn('SignalR chat connection warning:', err);
        });
    }
  }

  private handleIncomingSignalRMessage(incoming: SignalRIncomingMessage): void {
    const activeOrderId = this.currentOrderRequestId();
    if (activeOrderId && incoming.orderRequestId.toLowerCase() !== activeOrderId.toLowerCase()) {
      return;
    }

    // Don't duplicate self-sent messages already in the feed
    const myAccountId = this.authStore.currentAccount()?.accountId;
    if (myAccountId && incoming.senderAccountId.toLowerCase() === myAccountId.toLowerCase()) {
      return;
    }

    let senderType: 'customer' | 'superadmin' | 'seller' | 'system' = 'superadmin';
    const roleLower = (incoming.senderRole || '').toLowerCase();
    if (roleLower.includes('user') || roleLower.includes('customer')) {
      senderType = 'customer';
    } else if (roleLower.includes('seller') || roleLower.includes('shopkeeper')) {
      senderType = 'seller';
    }

    this.messages.update((list) => [
      ...list,
      {
        id: incoming.messageId,
        sender: senderType,
        text: incoming.message,
        timestamp: new Date(incoming.sentAt)
      }
    ]);
    this.scrollToBottom();
  }

  private loadPastOrders(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem('eseller_orders_history');
        if (stored) {
          this.pastOrders.set(JSON.parse(stored));
        }
      } catch {}
    }
  }

  private initConversation(orderRef: string | null, shopId: string | null): void {
    let loadedOrder: StoredOrder | null = null;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const latestStr = window.localStorage.getItem('eseller_latest_order');
        if (latestStr) {
          const latest: StoredOrder = JSON.parse(latestStr);
          if (!orderRef || latest.orderRef === orderRef) {
            loadedOrder = latest;
          }
        }

        if (!loadedOrder && orderRef) {
          const list: StoredOrder[] = this.pastOrders();
          loadedOrder = list.find((o) => o.orderRef === orderRef) || null;
        }
      } catch {}
    }

    // Set real order GUID for SignalR room + API calls
    if (orderRef) {
      this.currentOrderRequestId.set(orderRef);
      if (this.signalRService.chatState() === HubConnectionState.Connected) {
        this.signalRService.joinOrderRoom(orderRef).catch(() => {});
      }
    }

    if (loadedOrder) {
      this.order.set(loadedOrder);
      this.shopName.set(loadedOrder.shopName || 'Verified Partner Store');
      this.shopId.set(loadedOrder.shopId || '');
      this.orderStatus.set(
        loadedOrder.status === 'CONFIRMED'
          ? 'CONFIRMED'
          : loadedOrder.status === 'DISPATCHED'
          ? 'DISPATCHED'
          : 'PENDING'
      );

      // System notification: order initialized with Super Admin Desk
      const initialMessages: ChatMessage[] = [
        {
          id: 'sys-1',
          sender: 'system',
          text: `Order #${loadedOrder.orderRef} initiated via Cash on Delivery. Super Admin Desk is connected and awaiting your confirmation.`,
          timestamp: new Date(loadedOrder.createdAt || Date.now()),
          isOrderNotification: true
        }
      ];

      this.messages.set(initialMessages);

      // Load real chat history from API if we have a valid GUID
      if (orderRef && orderRef.length >= 36) {
        this.chatService.getMessages(orderRef, 1, 50).subscribe({
          next: (paged) => {
            if (paged && paged.items && paged.items.length > 0) {
              const historyMsgs: ChatMessage[] = paged.items.map((m) => ({
                id: m.id,
                sender: (m.senderRole?.toLowerCase().includes('user') || m.senderRole?.toLowerCase().includes('customer'))
                  ? 'customer'
                  : m.senderRole?.toLowerCase().includes('seller')
                  ? 'seller'
                  : 'superadmin' as 'customer' | 'superadmin' | 'seller' | 'system',
                text: m.message,
                timestamp: new Date(m.sentAt)
              }));
              this.messages.update((list) => [...list, ...historyMsgs]);
              setTimeout(() => this.scrollToBottom(), 100);
            }
          },
          error: () => {}
        });
      }

      // Pre-fill composer with order template (ready to send in 1 click)
      const itemsSummary = loadedOrder.items
        .map(
          (i) =>
            `• ${i.name}${i.variantName ? ' (' + i.variantName + ')' : ''} × ${i.quantity} — Rs. ${(i.price * i.quantity).toLocaleString()}`
        )
        .join('\n');

      const country = loadedOrder.customer.country || 'Pakistan';
      const state = loadedOrder.customer.state || loadedOrder.customer.province || '';
      const addressSummary = `${loadedOrder.customer.address}, ${loadedOrder.customer.city}${state ? ', ' + state : ''}, ${country}`;

      const prefilledTemplate = `Hello Super Admin! Please confirm my Order #${loadedOrder.orderRef}:
📦 Products:
${itemsSummary}
📍 Delivery Address:
${loadedOrder.customer.fullName} (${loadedOrder.customer.phone})
${addressSummary}${loadedOrder.customer.notes ? '\nNote: ' + loadedOrder.customer.notes : ''}
💰 Total Amount (COD): Rs. ${loadedOrder.totalAmount.toLocaleString()}

Please verify and authorize priority dispatch.`;

      this.messageText.set(prefilledTemplate);
    } else {
      // General support inquiry with Super Admin
      this.messages.set([
        {
          id: 'sys-0',
          sender: 'system',
          text: 'Connected directly to Eseller Super Admin Desk. Send a message to start chatting.',
          timestamp: new Date()
        }
      ]);
    }

    setTimeout(() => this.scrollToBottom(), 200);
  }

  sendMessage(presetText?: string): void {
    const text = (presetText || this.messageText()).trim();
    if (!text) return;

    const orderId = this.currentOrderRequestId();

    // Optimistic UI — show message immediately
    const tempId = 'cust-' + Date.now();
    const newMsg: ChatMessage = {
      id: tempId,
      sender: 'customer',
      text,
      timestamp: new Date()
    };

    this.messages.update((list) => [...list, newMsg]);
    if (!presetText) {
      this.messageText.set('');
    }
    this.scrollToBottom();

    // Send via real API (SignalR will deliver reply back automatically)
    if (orderId) {
      this.chatService.sendMessage(orderId, text).subscribe({
        error: () => this.showFeedback('Failed to send message. Please try again.')
      });
    } else {
      // Fallback: no active order — show helpful feedback
      this.showFeedback('No active order session. Please start from an order.');
    }
  }

  sendOrderConfirmationNow(): void {
    const text = this.messageText().trim();
    if (text) {
      this.sendMessage(text);
    }
  }

  onEnterKey(event: Event): void {
    const ke = event as KeyboardEvent;
    if (ke.key === 'Enter' && !ke.shiftKey) {
      ke.preventDefault();
      this.sendMessage();
    }
  }

  confirmOrderSimulated(): void {
    this.orderStatus.set('CONFIRMED');
    const ord = this.order();
    if (ord) {
      ord.status = 'CONFIRMED';
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('eseller_latest_order', JSON.stringify(ord));
      }
    }

    this.messages.update((list) => [
      ...list,
      {
        id: 'sys-conf-' + Date.now(),
        sender: 'system',
        text: `Super Admin has verified and officially authorized Order #${ord?.orderRef || ''}!`,
        timestamp: new Date()
      },
      {
        id: 'admin-conf-' + Date.now(),
        sender: 'superadmin',
        text: `Order #${ord?.orderRef || ''} has been officially verified and authorized by Super Admin! Our warehouse packaging team has begun processing and courier rider pickup has been scheduled. Thank you for shopping with Eseller!`,
        timestamp: new Date()
      }
    ]);
    this.scrollToBottom();
  }

  copyOrderRef(): void {
    const ord = this.order();
    if (!ord) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(ord.orderRef);
      this.showFeedback('Order reference copied to clipboard!');
    }
  }

  downloadInvoicePdf(): void {
    const ord = this.order();
    if (!ord) return;

    const country = ord.customer.country || 'Pakistan';
    const state = ord.customer.state || ord.customer.province || '';

    const itemsHtml = ord.items
      .map(
        (item, idx) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 8px; text-align: center; color: #6b7280; font-size: 12px;">${idx + 1}</td>
        <td style="padding: 10px 8px; font-size: 13px; color: #111827;">
          <strong>${item.name}</strong>
          ${item.variantName ? `<div style="font-size: 11px; color: #b45309; margin-top: 2px;">Variant / Size: ${item.variantName}</div>` : ''}
          <div style="font-size: 11px; color: #6b7280;">Merchant: ${item.shopName}</div>
        </td>
        <td style="padding: 10px 8px; text-align: center; font-size: 13px; font-weight: 700;">${item.quantity} pcs</td>
        <td style="padding: 10px 8px; text-align: right; font-size: 13px;">Rs. ${item.price.toLocaleString()}</td>
        <td style="padding: 10px 8px; text-align: right; font-size: 13px; font-weight: 700; color: #111827;">Rs. ${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    `
      )
      .join('');

    const invoiceHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Invoice - ${ord.orderRef}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
          body { padding: 40px; color: #1f2937; background: #fff; font-size: 13px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid #e5e7eb; }
          .brand { font-size: 26px; font-weight: 900; color: #0284c7; letter-spacing: -0.5px; }
          .badge { display: inline-block; padding: 4px 10px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 6px; }
          .meta { text-align: right; }
          .meta h2 { font-size: 18px; color: #111827; font-weight: 800; }
          .meta p { font-size: 12px; color: #4b5563; margin-top: 3px; }
          .grid { display: flex; justify-content: space-between; gap: 24px; margin: 28px 0; }
          .card { flex: 1; padding: 18px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb; }
          .card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f3f4f6; color: #374151; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 10px 8px; text-align: left; }
          .totals { margin-top: 24px; width: 320px; margin-left: auto; }
          .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #4b5563; }
          .totals-grand { display: flex; justify-content: space-between; padding: 10px 0; border-top: 2px solid #111827; font-size: 16px; font-weight: 900; color: #0284c7; }
          .footer { margin-top: 48px; padding-top: 20px; border-top: 1px dashed #d1d5db; text-align: center; font-size: 11px; color: #6b7280; }
          @media print {
            body { padding: 15mm; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
          <button onclick="window.print()" style="background: #0284c7; color: white; padding: 10px 20px; border: none; border-radius: 8px; font-size: 13px; font-weight: bold; cursor: pointer;">
            🖨️ Print / Save as PDF
          </button>
        </div>

        <div class="header">
          <div>
            <div class="brand">ESELLER</div>
            <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">Verified Direct Marketplace Platform</div>
            <span class="badge">Official Cash on Delivery Invoice</span>
          </div>
          <div class="meta">
            <h2>INVOICE #${ord.orderRef}</h2>
            <p><strong>Order Date:</strong> ${new Date(ord.createdAt).toLocaleDateString()} ${new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p><strong>Status:</strong> ${ord.status.replace(/_/g, ' ')}</p>
            <p><strong>Payment Mode:</strong> Cash on Delivery (COD)</p>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">Delivery To (Customer)</div>
            <div style="font-weight: 700; font-size: 14px; color: #111827;">${ord.customer.fullName}</div>
            <div style="color: #0284c7; font-weight: 600; margin-top: 2px;">${ord.customer.phone}</div>
            <div style="margin-top: 6px; color: #4b5563;">
              ${ord.customer.address}<br>
              ${ord.customer.city}${state ? ', ' + state : ''}, ${country}
            </div>
            ${ord.customer.notes ? `<div style="margin-top: 6px; font-style: italic; color: #b45309; font-size: 11px;">Note: ${ord.customer.notes}</div>` : ''}
          </div>

          <div class="card">
            <div class="card-title">Sold &amp; Dispatched By</div>
            <div style="font-weight: 700; font-size: 14px; color: #111827;">${ord.shopName}</div>
            <div style="color: #059669; font-size: 12px; font-weight: 600; margin-top: 2px;">✔ Verified Partner Merchant</div>
            <div style="margin-top: 6px; color: #4b5563;">
              Platform Order Verification ID: <strong>${ord.orderRef}</strong><br>
              Direct Chat &amp; Parcel Inspection Enabled
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>Product Details</th>
              <th style="width: 100px; text-align: center;">Quantity</th>
              <th style="width: 120px; text-align: right;">Unit Price</th>
              <th style="width: 120px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span>Items Subtotal:</span>
            <span style="font-weight: 600;">Rs. ${ord.subtotal.toLocaleString()}</span>
          </div>
          <div class="totals-row">
            <span>Delivery / Shipping Fee:</span>
            <span style="font-weight: 600;">${ord.shippingFee === 0 ? 'FREE' : 'Rs. ' + ord.shippingFee.toLocaleString()}</span>
          </div>
          <div class="totals-grand">
            <span>Total Payable (COD):</span>
            <span>Rs. ${ord.totalAmount.toLocaleString()}</span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for shopping on <strong>Eseller</strong>. Please inspect your parcel upon arrival before paying the courier rider.</p>
          <p style="margin-top: 4px;">For support or inquiries, connect via official Seller Chat or email support@eseller.com</p>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 400);
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(invoiceHtml);
      printWindow.document.close();
    }
  }

  private generateSuperAdminReply(userText: string): string {
    const lower = userText.toLowerCase();
    const ord = this.order();
    const ref = ord?.orderRef || '';
    const name = ord?.customer.fullName || 'Customer';

    if (
      lower.includes('confirm') ||
      lower.includes('order') ||
      lower.includes('hello') ||
      lower.includes('hi')
    ) {
      return `Hello ${name}! The Super Admin Desk has reviewed and authorized your Order #${ref}. We have instructed vendor "${ord?.shopName || 'Partner Store'}" to reserve the items and prepare secure courier packaging. Your parcel will be dispatched within 24 hours.`;
    }
    if (
      lower.includes('tracking') ||
      lower.includes('dispatch') ||
      lower.includes('time') ||
      lower.includes('when')
    ) {
      return `Order #${ref} will arrive via express courier within 2 to 4 business days. As soon as the dispatch rider scans the package, an official tracking SMS code will be sent to your registered phone number.`;
    }
    if (
      lower.includes('picture') ||
      lower.includes('photo') ||
      lower.includes('image') ||
      lower.includes('inspect')
    ) {
      return 'Certainly! Under the Super Admin Inspection Policy, our warehouse quality team inspects and verifies product authenticity before sealing the parcel.';
    }
    if (
      lower.includes('phone') ||
      lower.includes('number') ||
      lower.includes('address') ||
      lower.includes('location')
    ) {
      return `Your delivery shipping address (${ord?.customer.address}, ${ord?.customer.city}) has been verified in our system. The delivery courier rider will call you 30 minutes before arrival.`;
    }
    if (
      lower.includes('protection') ||
      lower.includes('fake') ||
      lower.includes('return') ||
      lower.includes('guarantee')
    ) {
      return `Eseller Super Admin Buyer Protection is 100% active on this order! You are entitled to open and inspect the parcel upon delivery before payment. If any issue arises, an instant free replacement or refund is fully guaranteed.`;
    }
    return `Thank you, ${name}! The Eseller Super Admin Desk is actively monitoring your request. Rest assured your order will be delivered with premium quality and safe courier handling.`;
  }

  getImageUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:')
    ) {
      return url;
    }
    const apiBase =
      typeof window !== 'undefined'
        ? ((window as any).__ESELLER_API_URL__ as string)
        : '';
    const host = apiBase
      ? apiBase.replace(/\/api\/v1\/?$/, '')
      : 'https://localhost:7127';
    const path = url.startsWith('/') ? url : `/${url}`;
    if (path.startsWith('/uploads/')) {
      return `${host}${path}`;
    }
    return `${host}/uploads${path}`;
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatFeedContainer) {
        const el = this.chatFeedContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }

  private showFeedback(msg: string): void {
    this.feedbackMessage.set(msg);
    setTimeout(() => this.feedbackMessage.set(null), 3000);
  }
}
