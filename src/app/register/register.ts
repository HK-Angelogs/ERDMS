import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  name = '';
  username = '';
  password = '';
  message = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  register() {
    if (!this.name || !this.username || !this.password) {
      this.message = 'Please fill out all fields';
      return;
    }

    this.authService.register({
      name: this.name,
      username: this.username,
      password: this.password
    }).subscribe({
      next: () => {
        this.message = 'Registration successful';
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.message = err.error?.message || 'Registration failed';
      }
    });
  }
}