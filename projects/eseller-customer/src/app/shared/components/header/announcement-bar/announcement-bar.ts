import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthActionService } from 'eseller-shared';

@Component({
  imports: [RouterLink],
  selector: 'app-announcement-bar',
  styleUrl: './announcement-bar.css',
  templateUrl: './announcement-bar.html',
})
export class AnnouncementBar {
  private readonly authAction = inject(AuthActionService);

  readonly canShop = () => this.authAction.canShop();
}
