import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface Activity {
    id: number;
    username: string;
    role: string;
    action: string;
    module: string;
    details: string;
    created_at: string;
}

export interface DashboardStats {
    totalUsers: number;
    totalDocuments: number;
    recentActivities: Activity[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
    private apiUrl = 'http://localhost:3000/api/dashboard';

    constructor(private http: HttpClient, private authService: AuthService) { }

    private getHeaders(): HttpHeaders {
        return new HttpHeaders({
            Authorization: `Bearer ${this.authService.getToken()}`
        });
    }

    getStats(): Observable<DashboardStats> {
        return this.http.get<DashboardStats>(`${this.apiUrl}/stats`, {
            headers: this.getHeaders()
        });
    }
}