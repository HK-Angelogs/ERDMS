import { Component, AfterViewInit, ElementRef, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements AfterViewInit, OnDestroy {
  username = '';
  password = '';
  message = '';

  private animationTimers: number[] = [];

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

  login() {
    if (!this.username || !this.password) {
      this.message = 'Please enter username and password';
      return;
    }

    this.authService.login({
      username: this.username,
      password: this.password
    }).subscribe({
      next: (response) => {
        this.authService.saveToken(response.token);
        this.authService.saveUser(response.user);
        this.router.navigate(['/users']);
      },
      error: (err) => {
        this.message = err.error?.message || 'Login failed';
      }
    });
  }
}