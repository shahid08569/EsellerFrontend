import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService, ShopTrafficSummaryDto, ShopTrafficPointDto, ShopTrafficMonthDto } from '../../core/services/seller.service';
import { SkeletonLayout } from 'eseller-shared';

@Component({
  selector: 'app-shop-traffic',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
  templateUrl: './shop-traffic.html'
})
export class ShopTraffic implements OnInit {
  private readonly sellerService = inject(SellerService);
  readonly Math = Math;

  readonly isLoading = signal<boolean>(true);
  readonly selectedRange = signal<string>('1m');
  readonly customStartDate = signal<string>('');
  readonly customEndDate = signal<string>('');
  readonly showCustomPicker = signal<boolean>(false);
  readonly traffic = signal<ShopTrafficSummaryDto | null>(null);
  readonly activeHoverPoint = signal<ShopTrafficPointDto | null>(null);
  readonly activeTab = signal<'daily' | 'monthly'>('daily');

  // Daily Timeline sorting & pagination
  readonly timelineSort = signal<'newest' | 'oldest'>('newest');
  readonly timelinePage = signal<number>(1);
  readonly timelinePageSize = signal<number>(10);

  // Monthly Breakdown sorting & pagination
  readonly monthlySort = signal<'newest' | 'oldest'>('newest');
  readonly monthlyPage = signal<number>(1);
  readonly monthlyPageSize = signal<number>(10);

  readonly sortedTimeline = computed(() => {
    const list = [...(this.traffic()?.timeline || [])];
    if (this.timelineSort() === 'newest') {
      return list.reverse();
    }
    return list;
  });

  readonly timelineTotalPages = computed(() => {
    const total = this.sortedTimeline().length;
    return Math.max(1, Math.ceil(total / this.timelinePageSize()));
  });

  readonly paginatedTimeline = computed(() => {
    const list = this.sortedTimeline();
    const page = this.timelinePage();
    const size = this.timelinePageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  readonly sortedMonthly = computed(() => {
    const list = [...(this.traffic()?.monthlyBreakdown || [])];
    if (this.monthlySort() === 'oldest') {
      return list.reverse();
    }
    return list;
  });

  readonly monthlyTotalPages = computed(() => {
    const total = this.sortedMonthly().length;
    return Math.max(1, Math.ceil(total / this.monthlyPageSize()));
  });

  readonly paginatedMonthly = computed(() => {
    const list = this.sortedMonthly();
    const page = this.monthlyPage();
    const size = this.monthlyPageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  readonly maxVisits = computed(() => {
    const points = this.traffic()?.timeline || [];
    if (!points.length) return 10;
    const max = Math.max(...points.map(p => p.visits), 10);
    return Math.ceil(max * 1.15); // headroom
  });

  readonly chartPoints = computed(() => {
    const points = this.traffic()?.timeline || [];
    const max = this.maxVisits();
    const count = points.length;
    if (count <= 1) return [];

    const width = 800;
    const height = 240;
    const padding = 20;

    return points.map((p, i) => {
      const x = padding + (i / (count - 1)) * (width - padding * 2);
      const y = height - padding - (p.visits / max) * (height - padding * 2);
      return { ...p, x, y };
    });
  });

  readonly svgPath = computed(() => {
    const pts = this.chartPoints();
    if (!pts.length) return '';
    return pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
  });

  readonly svgAreaPath = computed(() => {
    const pts = this.chartPoints();
    if (!pts.length) return '';
    const height = 240;
    const padding = 20;
    const firstX = pts[0].x.toFixed(1);
    const lastX = pts[pts.length - 1].x.toFixed(1);
    const bottomY = (height - padding).toFixed(1);
    const linePath = this.svgPath();
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  });

  ngOnInit(): void {
    this.loadTraffic(this.selectedRange());
  }

  setRange(range: string): void {
    if (range === 'custom') {
      this.showCustomPicker.set(true);
      if (!this.customStartDate()) {
        const d = new Date();
        d.setDate(d.getDate() - 14);
        this.customStartDate.set(d.toISOString().substring(0, 10));
      }
      if (!this.customEndDate()) {
        this.customEndDate.set(new Date().toISOString().substring(0, 10));
      }
      return;
    }
    this.showCustomPicker.set(false);
    this.selectedRange.set(range);
    this.timelinePage.set(1);
    this.loadTraffic(range);
  }

  applyCustomRange(): void {
    const s = this.customStartDate();
    const e = this.customEndDate();
    if (!s || !e) return;
    this.selectedRange.set('custom');
    this.timelinePage.set(1);
    this.isLoading.set(true);
    this.sellerService.getShopTraffic('custom', s, e).subscribe({
      next: (res) => {
        this.traffic.set(res);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  setTimelineSort(sort: 'newest' | 'oldest'): void {
    this.timelineSort.set(sort);
    this.timelinePage.set(1);
  }

  setTimelinePageSize(size: number): void {
    this.timelinePageSize.set(size);
    this.timelinePage.set(1);
  }

  setTimelinePage(page: number): void {
    const max = this.timelineTotalPages();
    if (page >= 1 && page <= max) {
      this.timelinePage.set(page);
    }
  }

  setMonthlySort(sort: 'newest' | 'oldest'): void {
    this.monthlySort.set(sort);
    this.monthlyPage.set(1);
  }

  setMonthlyPageSize(size: number): void {
    this.monthlyPageSize.set(size);
    this.monthlyPage.set(1);
  }

  setMonthlyPage(page: number): void {
    const max = this.monthlyTotalPages();
    if (page >= 1 && page <= max) {
      this.monthlyPage.set(page);
    }
  }

  loadTraffic(range: string): void {
    this.isLoading.set(true);
    this.sellerService.getShopTraffic(range, this.customStartDate() || undefined, this.customEndDate() || undefined).subscribe({
      next: (res) => {
        this.traffic.set(res);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  hoverPoint(point: ShopTrafficPointDto | null): void {
    this.activeHoverPoint.set(point);
  }
}
