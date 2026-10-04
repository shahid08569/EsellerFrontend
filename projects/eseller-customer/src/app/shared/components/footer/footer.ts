import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthActionService } from 'eseller-shared';

@Component({
  imports: [RouterLink],
  selector: 'app-footer',
  styleUrl: './footer.css',
  templateUrl: './footer.html',
})
export class Footer {
  private readonly authAction = inject(AuthActionService);

  readonly canShop = () => this.authAction.canShop();

  onProtectedNav(event: Event, path: string, actionLabel: string): void {
    if (this.authAction.canShop()) return;
    event.preventDefault();
    this.authAction.requireLoginFor(path, actionLabel);
  }
}
