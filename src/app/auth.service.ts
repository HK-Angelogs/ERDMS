// Imports
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';


@Injectable({
    providedIn: 'root'
})
//export class
export class AuthService {
    private apiUrl = 'http://localhost:3000';

    constructor(private http: HttpClient) { }

    register(userData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/register`, userData);
    }

    login(loginData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/login`, loginData);
    }

    saveToken(token: string): void {
        localStorage.setItem('token', token);
    }

    getToken(): string | null {
        return localStorage.getItem('token');
    }

    isLoggedIn(): boolean {
        return !!this.getToken();
    }

    logout(): void {
        localStorage.removeItem('token');
    }
    saveUser(user: any): void {
        localStorage.setItem('user', JSON.stringify(user));
    }

    getUser(): any {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    getRole(): string | null {
        return this.getUser()?.role || null;
    }

    //PASSWORD CHANGE 
    requiresPasswordChange(): boolean {
        const user = this.getUser();
        // Adjust 'isDefaultPassword' to match the exact property name your backend sends
        return user?.isdefaultPassword === true;
    }

    changePassword(passwordData: { newPassword: string }): Observable<any> {
        // We pass the token in headers to authenticate the request (if your backend requires it)
        const headers = { Authorization: `Bearer ${this.getToken()}` };
        return this.http.post(`${this.apiUrl}/change-password`, passwordData, { headers });
    }
}