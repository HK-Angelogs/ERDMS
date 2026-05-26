import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { EditUserModal } from './edit-user-modal/edit-user-modal';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, EditUserModal],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  username = '';
  selectedUser: any = null;
  lastCreatedPassword: string | null = null;

  apiUrl = 'http://localhost:3000';

  users: any[] = [];

  currentRole: string | null = null;
  currentUser: any = null;
  currentUserId: number | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    this.currentRole = this.currentUser?.role || null;
    this.currentUserId = this.currentUser?.id || null;

    console.log('Current user:', this.currentUser);
    console.log('Current role:', this.currentRole);
    console.log('Current user ID:', this.currentUserId);
    this.loadUsers();
  }

  getAuthHeaders() {
    const token = localStorage.getItem('token');

    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  canManageUsers(): boolean {
    return this.currentRole === 'admin' || this.currentRole === 'super_admin';
  }

  isSuperAdmin(): boolean {
    return this.currentRole === 'super_admin';
  }

  isOwnAccount(user: any): boolean {
    return Number(this.currentUserId) === Number(user.id);
  }

  canModifyUser(user: any): boolean {
    if (this.currentRole === 'super_admin') {
      return true;
    }

    if (this.currentRole === 'admin') {
      return user.role === 'user';
    }

    if (this.currentRole === 'user') {
      return this.isOwnAccount(user);
    }

    return false;
  }
  loadUsers() {
    console.log('loadUsers() called');

    this.http.get<any[]>(`${this.apiUrl}/users`, this.getAuthHeaders()).subscribe({
      next: (data) => {
        this.users = data;
        this.cdr.detectChanges();
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

    this.http.post<any>(`${this.apiUrl}/users/add-user`, {
      username: this.username
    }, this.getAuthHeaders()).subscribe({
      next: (response) => {
        this.lastCreatedPassword = response.temporaryPassword || null;
        this.username = '';
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to add user:', err);
        alert(err.error?.message || 'Failed to add user');
      }
    });
  }

  openUserModal(user: any) {
    this.selectedUser = user;
    this.cdr.detectChanges();
  }

  closeUserModal() {
    this.selectedUser = null;
    this.cdr.detectChanges();
  }

  updateUserFromModal(data: { id: number; username: string; password: string }) {
    if (data.username.trim() === '') {
      return;
    }

    this.http.put(`${this.apiUrl}/users/update-user/${data.id}`, {
      username: data.username,
      password: data.password
    }, this.getAuthHeaders()).subscribe({
      next: () => {
        this.selectedUser = null;
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to update user:', err);
        alert(err.error?.message || 'Failed to update user');
      }
    });
  }

  disableUser(id: number) {
    this.http.put(`${this.apiUrl}/users/disable-user/${id}`, {}, this.getAuthHeaders()).subscribe({
      next: () => {
        this.selectedUser = null;
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to disable user:', err);
        alert(err.error?.message || 'Failed to disable user');
      }
    });
  }

  enableUser(id: number) {
    this.http.put(`${this.apiUrl}/users/enable-user/${id}`, {}, this.getAuthHeaders()).subscribe({
      next: () => {
        this.selectedUser = null;
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to enable user:', err);
        alert(err.error?.message || 'Failed to enable user');
      }
    });
  }

  changeRole(id: number, role: string) {
    this.http.put(
      `${this.apiUrl}/users/${id}/role`,
      { role },
      this.getAuthHeaders()
    ).subscribe({
      next: () => {
        this.selectedUser = null;
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to change role:', err);
        alert(err.error?.message || 'Failed to change role');
      }
    });
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}