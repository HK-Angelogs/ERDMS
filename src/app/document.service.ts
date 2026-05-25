import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class DocumentService {
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

    uploadDocument(formData: FormData): Observable<any> {
        return this.http.post(
            `${this.apiUrl}/documents/upload`,
            formData,
            this.getAuthHeaders()
        );
    }

    getDocuments(): Observable<any[]> {
        return this.http.get<any[]>(
            `${this.apiUrl}/documents`,
            this.getAuthHeaders()
        );
    }

    searchDocuments(query: string): Observable<any[]> {
        const params = new HttpParams().set('q', query);
        const token = localStorage.getItem('token');

        return this.http.get<any[]>(
            `${this.apiUrl}/documents/search`,
            {
                headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
                params
            }
        );
    }

    deleteDocument(id: number): Observable<any> {
        return this.http.delete(
            `${this.apiUrl}/documents/${id}`,
            this.getAuthHeaders()
        );
    }

    getViewUrl(id: number): string {
        return `${this.apiUrl}/documents/${id}/view`;
    }

    getDownloadUrl(id: number): string {
        return `${this.apiUrl}/documents/${id}/download`;
    }

    getToken(): string | null {
        return localStorage.getItem('token');
    }
}