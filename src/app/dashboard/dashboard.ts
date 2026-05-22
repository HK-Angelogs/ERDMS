import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { DashboardService, DashboardStats } from '../dashboard.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  loading = true;
  error = '';

  currentUser: any = null;

  constructor(
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef,   // add this
    private authService: AuthService,
    private router: Router

  ) { }

  ngOnInit(): void {
    this.dashboardService.getStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
        this.cdr.detectChanges();   // add this
        this.currentUser = this.authService.getUser();
      },
      error: (err) => {
        this.error = 'Failed to load dashboard.';
        this.loading = false;
        this.cdr.detectChanges();   // add this
      }
    });
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    // Clears the local storage token
    this.authService.logout();
    // Redirects the user (change '/login' if your route is named differently)
    this.router.navigate(['/login']);
  }

  get userRole(): string | null {
    return this.authService.getRole();
  }

  get userName(): string {
    const user = this.authService.getUser();
    return user ? user.username : 'User';
  }
}
