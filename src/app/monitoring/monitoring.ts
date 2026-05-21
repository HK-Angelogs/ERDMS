import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MonitoringService } from '../monitoring.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-monitoring',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './monitoring.html',
  styleUrl: './monitoring.css'
})
export class Monitoring implements OnInit {
  logs: any[] = [];
  filteredLogs: any[] = [];

  currentUser: any = null;
  currentRole: string | null = null;

  selectedModule = 'All';
  selectedAction = 'All';
  searchUsername = '';

  message = '';

  modules: string[] = [];
  actions: string[] = [];

  constructor(
    private monitoringService: MonitoringService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    this.currentRole = this.currentUser?.role || null;

    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    if (!this.canViewMonitoring()) {
      this.router.navigate(['/users']);
      return;
    }

    this.loadActivityLogs();
  }

  canViewMonitoring(): boolean {
    return this.currentRole === 'admin' || this.currentRole === 'super_admin';
  }

  loadActivityLogs() {
    this.monitoringService.getActivityLogs().subscribe({
      next: (data) => {
        this.logs = data;
        this.filteredLogs = data;

        this.modules = [
          ...new Set(
            data
              .map((log) => log.module)
              .filter((module) => module)
          )
        ];

        this.actions = [
          ...new Set(
            data
              .map((log) => log.action)
              .filter((action) => action)
          )
        ];

        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load activity logs:', err);
        this.message = err.error?.message || 'Failed to load activity logs';

        if (err.status === 401 || err.status === 403) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  applyFilters() {
    this.filteredLogs = this.logs.filter((log) => {
      const matchesModule =
        this.selectedModule === 'All' || log.module === this.selectedModule;

      const matchesAction =
        this.selectedAction === 'All' || log.action === this.selectedAction;

      const matchesUsername =
        this.searchUsername.trim() === '' ||
        log.username?.toLowerCase().includes(this.searchUsername.toLowerCase());

      return matchesModule && matchesAction && matchesUsername;
    });
  }

  resetFilters() {
    this.selectedModule = 'All';
    this.selectedAction = 'All';
    this.searchUsername = '';
    this.applyFilters();
  }

  formatDate(dateValue: string): string {
    if (!dateValue) {
      return 'N/A';
    }

    return new Date(dateValue).toLocaleString();
  }

  goToUsers() {
    this.router.navigate(['/users']);
  }

  goToDocuments() {
    this.router.navigate(['/documents']);
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }
}