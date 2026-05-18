import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  name = '';
  editingId: number | null = null;

  apiUrl = 'http://localhost:3000';

  users: any[] = [];

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.http.get<any[]>(`${this.apiUrl}/users`).subscribe({
      next: (data) => {
        this.users = data;
      },
      error: (err) => {
        console.error('Failed to load users:', err);
      }
    });
  }

  addUser() {
    if (this.name.trim() === '') {
      return;
    }

    this.http.post(`${this.apiUrl}/add-user`, {
      name: this.name
    }).subscribe({
      next: () => {
        this.name = '';
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
    this.name = user.name;
  }

  updateUser() {
    if (this.name.trim() === '' || this.editingId === null) {
      return;
    }

    this.http.put(`${this.apiUrl}/update-user/${this.editingId}`, {
      name: this.name
    }).subscribe({
      next: () => {
        this.name = '';
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
      this.name = '';
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
    this.name = '';
    this.editingId = null;
  }
}