import { Directive, Input, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';

@Directive({
  selector: 'img[appFallback]',
  standalone: true
})
export class ImgFallbackDirective {
  @Input() appFallback: string = '';
  @Output() fallbackTriggered = new EventEmitter<void>();

  constructor(private readonly el: ElementRef<HTMLImageElement>) {}

  @HostListener('error')
  onError(): void {
    const img = this.el.nativeElement;
    if (this.appFallback && img.src !== this.appFallback) {
      img.src = this.appFallback;
    } else {
      img.style.display = 'none';
    }
    this.fallbackTriggered.emit();
  }
}
