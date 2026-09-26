import {
  Component,
  input,
  ElementRef,
  viewChild,
  afterNextRender,
  effect,
  OnDestroy
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProductListDto, ProductCard } from 'eseller-shared';

import Swiper from 'swiper';
import { Navigation } from 'swiper/modules';

@Component({
  selector: 'app-flash-sale-section',
  imports: [RouterLink, ProductCard],
  templateUrl: './flash-sale-section.html'
})
export class FlashSaleSection implements OnDestroy {
  readonly products = input<ProductListDto[]>([]);
  readonly loading = input<boolean>(false);
  readonly viewAllLink = input<string>('/products');

  private readonly swiperContainer =
    viewChild<ElementRef<HTMLDivElement>>('swiperContainer');

  private swiper: Swiper | null = null;

  constructor() {
    afterNextRender(() => {
      this.initSwiper();
    });

    effect(() => {
      const count = this.products().length;
      if (count > 0) {
        setTimeout(() => this.initSwiper(), 0);
      }
    });
  }

  ngOnDestroy(): void {
    this.swiper?.destroy(true, true);
    this.swiper = null;
  }

  hasFlashSale(): boolean {
    return this.products().length > 0;
  }

  /**
   * Extract flash sale end date for a product.
   */
getCountdown(product: ProductListDto): Date | null {
  const end = product.badges?.flashSaleEndDate;
  if (!end) return null;

  // ✅ Backend UTC date bhej raha (bina Z) — browser ko batao
  const utcDate = end.endsWith('Z') ? end : `${end}Z`;
  return new Date(utcDate);
}
  private initSwiper(): void {
    const container = this.swiperContainer()?.nativeElement;
    if (!container) return;

    this.swiper?.destroy(true, true);

    this.swiper = new Swiper(container, {
      modules: [Navigation],

      loop: this.products().length > 4,
      speed: 500,
      spaceBetween: 20,
      slidesPerView: 1,
      grabCursor: true,
      watchSlidesProgress: true,

      breakpoints: {
        640: { slidesPerView: 2, spaceBetween: 16 },
        1024: { slidesPerView: 3, spaceBetween: 20 },
        1280: { slidesPerView: 4, spaceBetween: 20 }
      },

      navigation: {
        nextEl: '.flash-next',
        prevEl: '.flash-prev',
        disabledClass: 'opacity-50'
      }
    });

    setTimeout(() => this.swiper?.update(), 100);
  }
}