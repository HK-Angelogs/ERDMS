import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  username = '';
  editingId: number | null = null;

  apiUrl = 'http://localhost:3000';

  users: any[] = [];

  constructor(
    private http: HttpClient,
    private router: Router
  ) { }

  getAuthHeaders() {
    const token = localStorage.getItem('token');

    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }



  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.http.get<any[]>(`${this.apiUrl}/users`, this.getAuthHeaders()).subscribe({
      next: (data) => {
        this.users = data;
      },
      error: (err) => {
        console.error('Failed to load users:', err);

        if (err.status === 401 || err.status === 403) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  addUser() {
    if (this.username.trim() === '') {
      return;
    }

    this.http.post(`${this.apiUrl}/add-user`, {
      username: this.username
    }).subscribe({
      next: () => {
        this.username = '';
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to add user:', err);
      }
    });
  }

  editUser(user: any) {
    if (user.disabled) {
      return;
    }

    this.editingId = user.id;
    this.username = user.username;
  }

  updateUser() {
    if (this.username.trim() === '' || this.editingId === null) {
      return;
    }

    this.http.put(`${this.apiUrl}/update-user/${this.editingId}`, {
      username: this.username
    }).subscribe({
      next: () => {
        this.username = '';
        this.editingId = null;
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to update user:', err);
      }
    });
  }

  disableUser(id: number) {
    this.http.put(`${this.apiUrl}/disable-user/${id}`, {}).subscribe({
      next: () => {
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to disable user:', err);
      }
    });

    if (this.editingId === id) {
      this.username = '';
      this.editingId = null;
    }
  }

  enableUser(id: number) {
    this.http.put(`${this.apiUrl}/enable-user/${id}`, {}).subscribe({
      next: () => {
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to enable user:', err);
      }
    });
  }

  cancelEdit() {
    this.username = '';
    this.editingId = null;
  }

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  changeRole(id: number, role: string) {
    this.http.put(
      `${this.apiUrl}/users/${id}/role`,
      { role },
      this.getAuthHeaders()
    ).subscribe({
      next: () => {
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to change role:', err);
        alert(err.error?.message || 'Failed to change role');
      }
    });
  }
}