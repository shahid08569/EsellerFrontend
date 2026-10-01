import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ProductQuestionDto } from 'eseller-shared';

@Component({
  selector: 'app-product-qa',
  imports: [FormsModule, DatePipe],
  templateUrl: './product-qa.html',
  styleUrl: './product-qa.css'
})
export class ProductQa {
  // Inputs
  readonly questions = input<ProductQuestionDto[]>([]);
  readonly loading = input<boolean>(false);
  readonly isAuthenticated = input<boolean>(false);

  // Outputs
  readonly submitQuestion = output<string>();

  // State
  readonly newQuestionText = signal<string>('');
  readonly submitting = signal<boolean>(false);
  readonly submittedSuccess = signal<boolean>(false);

  onSubmit(): void {
    const text = this.newQuestionText().trim();
    if (!text) return;

    this.submitting.set(true);
    this.submitQuestion.emit(text);
    this.newQuestionText.set('');
    this.submitting.set(false);
    this.submittedSuccess.set(true);

    setTimeout(() => this.submittedSuccess.set(false), 5000);
  }
}
