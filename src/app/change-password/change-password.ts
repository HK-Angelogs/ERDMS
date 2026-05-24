import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './change-password.html',
  styleUrl: '../login/login.css' // Reusing your existing login styles!
})
export class changePassword {
  newPassword = '';
  confirmPassword = '';
  message = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  onSubmit() {
    if (!this.newPassword || !this.confirmPassword) {
      this.message = 'Please fill in both fields.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.message = 'Passwords do not match.';
      return;
    }

    // Call the service to update the password in the backend
    this.authService.changePassword({ newPassword: this.newPassword }).subscribe({
      next: (response) => {
        // 1. Clear the local storage so the old session is completely removed
        this.authService.logout();

        // 2. Route them back to the login screen
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.message = err.error?.message || 'Failed to update password. Please try again.';
      }
    });
  }
}