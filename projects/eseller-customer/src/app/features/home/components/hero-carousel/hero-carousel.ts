import {
  Component,
  input,
  signal,
  computed,
  effect,
  OnDestroy,
  ElementRef,
  viewChild,
  afterNextRender
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { HomepageBannerDto } from 'eseller-shared';

import Swiper from 'swiper';
import { Autoplay, Navigation, Pagination } from 'swiper/modules';

@Component({
  selector: 'app-hero-carousel',
  imports: [RouterLink],
  templateUrl: './hero-carousel.html'
})
export class HeroCarousel implements OnDestroy {
  readonly banners = input<HomepageBannerDto[]>([]);

  private readonly swiperContainer =
    viewChild<ElementRef<HTMLDivElement>>('swiperContainer');

  private swiper: Swiper | null = null;

  readonly totalSlides = computed(() => this.banners().length);
  readonly hasSlides = computed(() => this.banners().length > 0);
  readonly currentIndex = signal(0);

  constructor() {
    afterNextRender(() => {
      this.initSwiper();
    });

    effect(() => {
      const count = this.banners().length;
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
      modules: [Autoplay, Navigation, Pagination],

      loop: true,
      speed: 700,
      spaceBetween: 0,
      slidesPerView: 1,
      grabCursor: true,

      autoplay: {
        delay: 4500,
        disableOnInteraction: false,
        pauseOnMouseEnter: true
      },

      navigation: {
  nextEl: container.querySelector('.hero-next'),
  prevEl: container.querySelector('.hero-prev')
},

      pagination: {
        el: container.querySelector('.swiper-pagination'),
        clickable: true
      },

      on: {
        slideChange: (swiper) => {
          this.currentIndex.set(swiper.realIndex);
        }
      }
    });
  }

  goTo(index: number): void {
    this.swiper?.slideToLoop(index);
  }
}