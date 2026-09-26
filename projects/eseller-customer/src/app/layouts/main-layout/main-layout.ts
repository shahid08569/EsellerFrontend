import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AnnouncementBar } from '../../shared/components/header/announcement-bar/announcement-bar';
import { Navbar } from '../../shared/components/header/navbar/navbar';
import { Footer } from '../../shared/components/footer/footer';

@Component({
  imports: [RouterOutlet, AnnouncementBar, Navbar, Footer],

  selector: 'app-main-layout',
  styleUrl: './main-layout.css',
  templateUrl: './main-layout.html',
})
export class MainLayout {}
