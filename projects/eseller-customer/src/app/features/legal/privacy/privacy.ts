import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  imports: [CommonModule, RouterLink],
  templateUrl: './privacy.html',
  styleUrl: './privacy.css'
})
export class Privacy implements OnInit {
  readonly activeSection = signal<string>('collection');

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }

  scrollTo(sectionId: string): void {
    this.activeSection.set(sectionId);
    if (typeof document !== 'undefined') {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
}
