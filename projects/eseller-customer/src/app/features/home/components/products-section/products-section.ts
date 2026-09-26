import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProductListDto, ProductCard } from 'eseller-shared';

@Component({
  selector: 'app-products-section',
  imports: [RouterLink, ProductCard],
  templateUrl: './products-section.html'
})
export class ProductsSection {
  readonly products = input<ProductListDto[]>([]);
  readonly title = input<string>('New Products');
  readonly viewAllLink = input<string>('/products');
  readonly loading = input<boolean>(false);
}