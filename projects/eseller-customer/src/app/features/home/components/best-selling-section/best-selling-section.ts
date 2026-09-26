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
  selector: 'app-best-selling-section',
  imports: [RouterLink, ProductCard],
  templateUrl: './best-selling-section.html'
})
export class BestSellingSection implements OnDestroy {
  readonly products = input<ProductListDto[]>([]);
  readonly title = input<string>('Best Selling');
  readonly viewAllLink = input<string>('/products?sortBy=popular');
  readonly loading = input<boolean>(false);

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
        nextEl: '.best-next',
        prevEl: '.best-prev',
        disabledClass: 'opacity-50'
      }
    });

    setTimeout(() => this.swiper?.update(), 100);
  }
}