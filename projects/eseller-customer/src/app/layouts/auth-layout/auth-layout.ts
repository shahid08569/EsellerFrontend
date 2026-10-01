import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-auth-layout',
  styleUrl: './auth-layout.css',
  templateUrl: './auth-layout.html',
})
export class AuthLayout {}
