import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import {
  validatePassword,
  getPasswordRequirements,
  PasswordRequirement,
} from '../utils/password-validator';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './change-password.html',
  styleUrl: '../login/login.css'
})
export class changePassword {
  newPassword = '';
  confirmPassword = '';

  /** Validation errors displayed below the form (backend or frontend). */
  errors: string[] = [];

  /** Live per-requirement checklist rendered in the template. */
  passwordRequirements: PasswordRequirement[] = [];

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  /** Called on every keystroke in the new password field to update the live checklist. */
  onPasswordChange(): void {
    this.passwordRequirements = this.newPassword
      ? getPasswordRequirements(this.newPassword)
      : [];
  }

  /** Returns true when all password requirements are met — used to disable the submit button. */
  get isPasswordValid(): boolean {
    return this.passwordRequirements.length > 0 &&
      this.passwordRequirements.every(r => r.met);
  }

  onSubmit(): void {
    this.errors = [];

    if (!this.newPassword || !this.confirmPassword) {
      this.errors = ['Please fill in both fields.'];
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errors = ['Passwords do not match.'];
      return;
    }

    // Frontend validation guard — backend remains authoritative
    const { isValid, errors } = validatePassword(this.newPassword);
    if (!isValid) {
      this.errors = errors;
      return;
    }

    this.authService.changePassword({ newPassword: this.newPassword }).subscribe({
      next: () => {
        // Clear session and redirect to login on success
        this.authService.logout();
        this.router.navigate(['/login']);
      },
      error: (err) => {
        // Prefer structured errors array from backend; fall back to single message
        this.errors = err.error?.errors?.length
          ? err.error.errors
          : [err.error?.message || 'Failed to update password. Please try again.'];
      }
    });
  }

  get unmetRequirements() {
    return this.passwordRequirements.filter(req => !req.met);
  }

}