import { Component } from '@angular/core';

@Component({
  selector: 'app-terms',
  standalone: true,
  template: `
    <div class="max-w-4xl mx-auto py-12 px-4 sm:px-6">
      <h1 class="text-3xl font-black text-gray-900 mb-6">Terms and Policies</h1>
      <div class="prose prose-sm sm:prose-base prose-amber">
        <h2>Merchant Agreement</h2>
        <p>By registering as a merchant on Eseller, you agree to abide by our quality standards and dispatch timelines. You must ensure all products are authentic and match their descriptions.</p>
        
        <h2>Customer Terms of Service</h2>
        <p>Customers agree to provide accurate shipping information and to accept the package upon Cash on Delivery. Returns are subject to our 7-day return policy for defective items.</p>

        <h2>Privacy Policy</h2>
        <p>We take your privacy seriously. We only collect information necessary to process your orders and provide a seamless shopping experience. Your data is encrypted and securely stored.</p>
      </div>
    </div>
  `
})
export class TermsComponent {}
