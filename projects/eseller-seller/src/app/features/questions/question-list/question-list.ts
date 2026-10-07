import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerService, QuestionDto, ShopDto } from '../../../core/services/seller.service';
import { ToastService, SkeletonLayout } from 'eseller-shared';

@Component({
  selector: 'app-question-list',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonLayout],
  templateUrl: './question-list.html'
})
export class QuestionList implements OnInit {
  private readonly sellerSvc = inject(SellerService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(true);
  readonly shop = signal<ShopDto | null>(null);
  readonly questions = signal<QuestionDto[]>([]);
  readonly activeTab = signal<'all' | 'unanswered' | 'answered'>('all');
  readonly searchTerm = signal<string>('');

  // Answer modal
  readonly answerModalOpen = signal<boolean>(false);
  readonly selectedQuestion = signal<QuestionDto | null>(null);
  readonly answerText = signal<string>('');
  readonly isSubmitting = signal<boolean>(false);

  ngOnInit(): void {
    this.loadQuestions();
  }

  loadQuestions(): void {
    this.isLoading.set(true);
    this.sellerSvc.getMyShop().subscribe({
      next: (s) => {
        this.shop.set(s);
        if (s?.id) {
          this.sellerSvc.getMyProducts(1, 20, undefined, s.id).subscribe({
            next: (pRes: any) => {
              const products = pRes?.items || [];
              if (!products.length) {
                this.isLoading.set(false);
                return;
              }

              const allQuestions: QuestionDto[] = [];
              let completed = 0;

              products.forEach((p: any) => {
                this.sellerSvc.getProductQuestions(p.id).subscribe({
                  next: (qRes: any) => {
                    const list = Array.isArray(qRes) ? qRes : (qRes?.items || []);
                    list.forEach((q: any) => {
                      allQuestions.push({
                        id: q.id,
                        productId: p.id,
                        productName: p.name,
                        question: q.question,
                        customerName: q.customerName || 'Shopper',
                        answer: q.answer,
                        answeredAt: q.answeredAt,
                        createdAt: q.createdAt || new Date().toISOString(),
                        isApproved: q.isApproved ?? true
                      });
                    });
                    completed++;
                    if (completed >= products.length) {
                      this.questions.set(allQuestions);
                      this.isLoading.set(false);
                    }
                  },
                  error: () => {
                    completed++;
                    if (completed >= products.length) {
                      this.questions.set(allQuestions);
                      this.isLoading.set(false);
                    }
                  }
                });
              });
            },
            error: () => this.isLoading.set(false)
          });
        } else {
          this.isLoading.set(false);
        }
      },
      error: () => this.isLoading.set(false)
    });
  }

  readonly filteredQuestions = computed(() => {
    let list = this.questions();
    const tab = this.activeTab();
    const term = this.searchTerm().trim().toLowerCase();

    if (tab === 'unanswered') {
      list = list.filter(q => !q.answer);
    } else if (tab === 'answered') {
      list = list.filter(q => !!q.answer);
    }

    if (term) {
      list = list.filter(q =>
        q.question.toLowerCase().includes(term) ||
        (q.productName && q.productName.toLowerCase().includes(term))
      );
    }

    return list;
  });

  readonly countAll = computed(() => this.questions().length);
  readonly countUnanswered = computed(() => this.questions().filter(q => !q.answer).length);
  readonly countAnswered = computed(() => this.questions().filter(q => !!q.answer).length);

  openAnswerModal(q: QuestionDto): void {
    this.selectedQuestion.set(q);
    this.answerText.set(q.answer || '');
    this.answerModalOpen.set(true);
  }

  closeAnswerModal(): void {
    this.answerModalOpen.set(false);
    this.selectedQuestion.set(null);
  }

  submitAnswer(): void {
    const q = this.selectedQuestion();
    const text = this.answerText().trim();
    if (!q || !text) {
      this.toast.show('Please write an answer before submitting.', 'error');
      return;
    }

    this.isSubmitting.set(true);
    this.sellerSvc.answerQuestion(q.id, text).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        q.answer = text;
        q.answeredAt = new Date().toISOString();
        this.questions.update(list => [...list]);
        this.toast.show('Answer submitted successfully!', 'success');
        this.closeAnswerModal();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.toast.show(err?.error?.error || 'Failed to submit answer.', 'error');
      }
    });
  }
}
