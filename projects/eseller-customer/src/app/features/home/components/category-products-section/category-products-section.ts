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

import { ProductListDto } from 'eseller-shared';

import { CategoryProductCard } from '../../../../shared/components/category-product-card/category-product-card';

import Swiper from 'swiper';
import { Navigation } from 'swiper/modules';

@Component({
  selector: 'app-category-products-section',
  imports: [RouterLink, CategoryProductCard],
  templateUrl: './category-products-section.html'
})
export class CategoryProductsSection implements OnDestroy {
  readonly categoryName = input<string>('');
  readonly products = input<ProductListDto[]>([]);
  readonly viewMoreLink = input<string>('/products');
  readonly loading = input<boolean>(false);

  /** Unique ID for this section's swiper — prevents conflicts */
  readonly sectionId = `cat-section-${Math.random().toString(36).substring(2, 9)}`;

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

  private initSwiper(): void {
    const container = this.swiperContainer()?.nativeElement;
    if (!container) return;

    this.swiper?.destroy(true, true);

    // ✅ Scoped selectors — find ONLY within this component's container
    const nextBtn = container.parentElement?.querySelector('.cat-next');
    const prevBtn = container.parentElement?.querySelector('.cat-prev');

    this.swiper = new Swiper(container, {
      modules: [Navigation],

      loop: this.products().length > 5,
      speed: 500,
      spaceBetween: 16,
      slidesPerView: 1.5,
      grabCursor: true,
      watchSlidesProgress: true,

      breakpoints: {
        640: { slidesPerView: 1, spaceBetween: 16 },
        768: { slidesPerView: 2, spaceBetween: 16 },
        1024: { slidesPerView: 4, spaceBetween: 16 },
        1280: { slidesPerView: 5, spaceBetween: 16 }
      },

      navigation: {
        nextEl: nextBtn as HTMLElement,
        prevEl: prevBtn as HTMLElement,
        disabledClass: 'opacity-50'
      }
    });

    setTimeout(() => this.swiper?.update(), 100);
  }
}