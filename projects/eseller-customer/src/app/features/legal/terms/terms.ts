import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export type TermsTab = 'all' | 'customer' | 'seller';

@Component({
  selector: 'app-terms',
  imports: [CommonModule, RouterLink],
  templateUrl: './terms.html',
  styleUrl: './terms.css'
})
export class Terms implements OnInit {
  readonly activeTab = signal<TermsTab>('all');

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }

  setTab(tab: TermsTab): void {
    this.activeTab.set(tab);
  }
}
