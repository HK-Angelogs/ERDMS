import { Component, AfterViewInit, ElementRef, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router, RouterLink } from '@angular/router';
import {
  validatePassword,
  getPasswordRequirements,
  PasswordRequirement,
} from '../utils/password-validator';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: '../login/login.css'
})
export class Register {
  username = '';
  password = '';

  /** Validation errors displayed below the form (backend or frontend). */
  errors: string[] = [];

  private animationTimers: number[] = [];

  /** Live per-requirement checklist rendered in the template. */
  passwordRequirements: PasswordRequirement[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private elementRef: ElementRef
  ) { }

  ngAfterViewInit() {
    this.addEntranceAnimation();
    this.staggerInputs();
  }

  ngOnDestroy() {
    this.animationTimers.forEach((timer) => clearTimeout(timer));
  }

  addEntranceAnimation() {
    const loginCard = this.elementRef.nativeElement.querySelector('.login-card');

    if (!loginCard) {
      return;
    }

    loginCard.style.opacity = '0';
    loginCard.style.transform = 'translateY(20px)';
    loginCard.style.transition = 'all 0.5s ease';

    const timer = window.setTimeout(() => {
      loginCard.style.opacity = '1';
      loginCard.style.transform = 'translateY(0)';
    }, 100);

    this.animationTimers.push(timer);
  }

  staggerInputs() {
    const inputs = this.elementRef.nativeElement.querySelectorAll('.login-form input');

    inputs.forEach((input: HTMLInputElement, index: number) => {
      input.style.opacity = '0';
      input.style.transform = 'translateY(10px)';

      const timer = window.setTimeout(() => {
        input.style.transition = 'all 0.4s ease';
        input.style.opacity = '1';
        input.style.transform = 'translateY(0)';
      }, 200 + index * 150);

      this.animationTimers.push(timer);
    });
  }

  /** Called on every keystroke in the password field to update the live checklist. */
  onPasswordChange(): void {
    this.passwordRequirements = this.password
      ? getPasswordRequirements(this.password)
      : [];
  }

  /** Returns true when all password requirements are met — used to disable the submit button. */
  get isPasswordValid(): boolean {
    return this.passwordRequirements.length > 0 &&
      this.passwordRequirements.every(r => r.met);
  }

  register(): void {
    this.errors = [];

    if (!this.username || !this.password) {
      this.errors = ['Please fill out all fields.'];
      return;
    }

    // Frontend validation guard — backend remains authoritative
    const { isValid, errors } = validatePassword(this.password);
    if (!isValid) {
      this.errors = errors;
      return;
    }

    this.authService.register({
      username: this.username,
      password: this.password
    }).subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (err) => {
        // Prefer structured errors array from backend; fall back to single message
        this.errors = err.error?.errors?.length
          ? err.error.errors
          : [err.error?.message || 'Registration failed. Please try again.'];
      }
    });
  }

  get unmetRequirements() {
    return this.passwordRequirements.filter(req => !req.met);
  }
}