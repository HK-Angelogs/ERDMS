import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class MonitoringService {
    private apiUrl = 'http://localhost:3000';

    constructor(private http: HttpClient) { }

    private getAuthHeaders() {
        const token = localStorage.getItem('token');

        return {
            headers: new HttpHeaders({
                Authorization: `Bearer ${token}`
            })
        };
    }

    getActivityLogs(): Observable<any[]> {
        return this.http.get<any[]>(
            `${this.apiUrl}/activity-logs`,
            this.getAuthHeaders()
        );
    }
}