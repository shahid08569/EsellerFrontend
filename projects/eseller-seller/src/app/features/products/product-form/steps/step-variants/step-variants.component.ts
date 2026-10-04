import { Component, Output, EventEmitter, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface FormVariantAttribute {
  name: string;
  value: string;
}

export interface FormVariant {
  id?: string;
  sku: string;
  price: number;
  stockQty: number;
  lowStockThreshold: number;
  attributes: FormVariantAttribute[];
}

@Component({
  selector: 'app-step-variants',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './step-variants.component.html'
})
export class StepVariantsComponent {
  hasVariants = input<boolean>(false);
  defaultPrice = input<number | null>(null);
  baseSkuPrefix = input<string>('');
  variants = input<FormVariant[]>([]);

  @Output() hasVariantsChange = new EventEmitter<boolean>();
  @Output() variantsChange = new EventEmitter<FormVariant[]>();

  onAddFirstVariant() {
    if (this.variants().length === 0) {
      this.addEmptyVariant();
    }
  }

  addEmptyVariant() {
    const current = [...this.variants()];
    const nextIdx = current.length + 1;
    const prefix = (this.baseSkuPrefix() || 'PROD').toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 8);
    const newV: FormVariant = {
      sku: `${prefix}-VAR-${nextIdx}`,
      price: this.defaultPrice() ?? 0,
      stockQty: 10,
      lowStockThreshold: 3,
      attributes: [
        { name: 'Option', value: `Variant ${nextIdx}` }
      ]
    };
    current.push(newV);
    this.variantsChange.emit(current);
  }

  removeVariant(index: number) {
    const current = [...this.variants()];
    current.splice(index, 1);
    this.variantsChange.emit(current);
  }

  addAttribute(vIdx: number) {
    const current = [...this.variants()];
    current[vIdx].attributes.push({ name: 'Attribute', value: 'Value' });
    this.variantsChange.emit(current);
  }

  removeAttribute(vIdx: number, aIdx: number) {
    const current = [...this.variants()];
    current[vIdx].attributes.splice(aIdx, 1);
    if (current[vIdx].attributes.length === 0) {
      // Always keep at least 1 attribute row for backend validation
      current[vIdx].attributes.push({ name: 'Option', value: 'Standard' });
    }
    this.variantsChange.emit(current);
  }

  applySizesPreset() {
    const sizes = ['Small (S)', 'Medium (M)', 'Large (L)', 'Extra Large (XL)'];
    const prefix = (this.baseSkuPrefix() || 'PROD').toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 8);
    const current: FormVariant[] = [];
    
    for (const s of sizes) {
      const tag = s.split('(')[1].replace(')', '');
      current.push({
        sku: `${prefix}-${tag}`,
        price: this.defaultPrice() ?? 0,
        stockQty: 15,
        lowStockThreshold: 3,
        attributes: [
          { name: 'Size', value: s }
        ]
      });
    }
    this.variantsChange.emit(current);
  }

  applyColorsPreset() {
    const colors = ['Black', 'White', 'Navy Blue'];
    const prefix = (this.baseSkuPrefix() || 'PROD').toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 8);
    const current: FormVariant[] = [];

    for (const c of colors) {
      const tag = c.toUpperCase().slice(0, 3);
      current.push({
        sku: `${prefix}-${tag}`,
        price: this.defaultPrice() ?? 0,
        stockQty: 20,
        lowStockThreshold: 4,
        attributes: [
          { name: 'Color', value: c }
        ]
      });
    }
    this.variantsChange.emit(current);
  }
}
