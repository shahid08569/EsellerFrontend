import { Component, computed, input } from '@angular/core';
import { PaymentShowcaseLogoDto, resolveMediaUrl } from 'eseller-shared';

@Component({
  selector: 'app-payment-logos-rail',
  standalone: true,
  templateUrl: './payment-logos-rail.html',
  styleUrl: './payment-logos-rail.css'
})
export class PaymentLogosRail {
  readonly logos = input<PaymentShowcaseLogoDto[]>([]);

  readonly visible = computed(() =>
    (this.logos() || []).filter((l) => !!l.imageUrl && l.isActive !== false)
  );

  /** Duplicate track for seamless CSS infinite scroll. */
  readonly loopLogos = computed(() => {
    const list = this.visible();
    if (list.length === 0) return [];
    let base = [...list];
    while (base.length < 8) {
      base = [...base, ...list];
    }
    return [...base, ...base];
  });

  mediaUrl(url: string | null | undefined): string | null {
    return resolveMediaUrl(url);
  }
}
