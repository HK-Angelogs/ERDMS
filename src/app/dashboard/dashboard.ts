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

  recentActivitiesFiltered: any[] = [];

  constructor(
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef,   // add this
    private authService: AuthService,
    private router: Router

  ) { }



  ngOnInit(): void {
    this.currentUser = this.authService.getUser();
    console.log('Current User:', this.currentUser);

    this.dashboardService.getStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.filterRecentActivities();
        this.loading = false;
        this.cdr.detectChanges();

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

  filterRecentActivities(): void {
    if (!this.stats?.recentActivities) {
      this.recentActivitiesFiltered = [];
      return;
    }

    const role = this.currentUser?.role?.toLowerCase();

    console.log('Current Role:', role);

    // SUPER ADMIN -> SEE EVERYTHING
    if (role === 'super_admin') {
      this.recentActivitiesFiltered = [...this.stats.recentActivities];
      return;
    }

    // ADMIN -> HIDE SUPER ADMIN LOGS
    if (role === 'admin') {
      this.recentActivitiesFiltered =
        this.stats.recentActivities.filter(
          activity => activity.role !== 'super_admin'
        );
      return;
    }

    // USER -> ONLY USER LOGS
    this.recentActivitiesFiltered =
      this.stats.recentActivities.filter(
        activity => activity.role === 'user'
      );
  }

}
