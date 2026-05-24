// Imports
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
  showPassword = false;

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

  // Login-Method
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
        // ADD THIS CONSOLE LOG:
        console.log('Backend Response:', response);

        // 1. Grab the user object from the response
        const userToSave = response.user;

        // 2. Check the password the user JUST typed into the login form
        if (this.password === 'default') {
          userToSave.isdefaultPassword = true;
        } else {
          userToSave.isdefaultPassword = false;
        }

        this.authService.saveToken(response.token);
        this.authService.saveUser(response.user);

        // Check if the user needs to change their password
        if (this.authService.requiresPasswordChange()) {
          console.log('Routing to change-password');
          this.router.navigate(['/change-password']);
        } else {
          console.log('Routing to dashboard');
          this.router.navigate(['/dashboard']);
        }
      },


      error: (err) => {
        this.message = err.error?.message || 'Login failed';
      }
    });
  }
}