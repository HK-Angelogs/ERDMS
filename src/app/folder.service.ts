import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Category {
    id: number;
    name: string;
}

export interface FolderNode {
    id: number;
    name: string;
    category_id: number;
    parent_folder_id: number | null;
    created_by: number;
    created_at: string;
    updated_at: string;
    created_by_username: string;
    children: FolderNode[];
}

export interface CategoryTree {
    id: number;
    name: string;
    tree: FolderNode[];
}

export interface RolePermission {
    role: string;
    can_view: number;
}

export interface UserPermission {
    user_id: number;
    can_view: number;
}

export interface FolderUser {
    id: number;
    username: string;
    role: string;
}

export interface FolderPermissionsResponse {
    role_permissions: RolePermission[];
    user_permissions: UserPermission[];
    all_users: FolderUser[];
}

export interface FolderPermissionsPayload {
    role_permissions: { role: string; can_view: number }[];
    user_permissions: { user_id: number; can_view: number }[];
}

@Injectable({
    providedIn: 'root'
})
export class FolderService {
    private apiUrl = 'http://localhost:3000';

    constructor(private http: HttpClient) { }

    private getHeaders(): HttpHeaders {
        const token = localStorage.getItem('token');
        return new HttpHeaders({ Authorization: `Bearer ${token}` });
    }

    // ─── CATEGORIES ────────────────────────────────────────────────────────────

    getCategories(): Observable<Category[]> {
        return this.http.get<Category[]>(`${this.apiUrl}/folders/categories`, {
            headers: this.getHeaders()
        });
    }

    // ─── FOLDER TREE ───────────────────────────────────────────────────────────

    getFolderTree(): Observable<CategoryTree[]> {
        return this.http.get<CategoryTree[]>(`${this.apiUrl}/folders/tree`, {
            headers: this.getHeaders()
        });
    }

    // ─── CREATE FOLDER ─────────────────────────────────────────────────────────

    createFolder(payload: {
        name: string;
        category_id: number;
        parent_folder_id: number | null;
    }): Observable<any> {
        return this.http.post(`${this.apiUrl}/folders`, payload, {
            headers: this.getHeaders()
        });
    }

    // ─── RENAME FOLDER ─────────────────────────────────────────────────────────

    renameFolder(id: number, name: string): Observable<any> {
        return this.http.put(`${this.apiUrl}/folders/${id}`, { name }, {
            headers: this.getHeaders()
        });
    }

    // ─── MOVE FOLDER ───────────────────────────────────────────────────────────

    moveFolder(id: number, parent_folder_id: number | null): Observable<any> {
        return this.http.put(`${this.apiUrl}/folders/${id}/move`, { parent_folder_id }, {
            headers: this.getHeaders()
        });
    }

    // ─── DELETE FOLDER ─────────────────────────────────────────────────────────

    deleteFolder(id: number): Observable<any> {
        return this.http.delete(`${this.apiUrl}/folders/${id}`, {
            headers: this.getHeaders()
        });
    }

    // ─── FOLDER FILES ──────────────────────────────────────────────────────────
    // Returns all documents in a folder. Backend enforces folder_permissions
    // for user role; admin/super_admin bypass automatically.

    getFolderFiles(folderId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/folders/${folderId}/files`, {
            headers: this.getHeaders()
        });
    }

    // ─── FOLDER PERMISSIONS ────────────────────────────────────────────────────

    getFolderPermissions(folderId: number): Observable<FolderPermissionsResponse> {
        return this.http.get<FolderPermissionsResponse>(
            `${this.apiUrl}/folders/${folderId}/permissions`,
            { headers: this.getHeaders() }
        );
    }

    updateFolderPermissions(folderId: number, payload: FolderPermissionsPayload): Observable<any> {
        return this.http.put(
            `${this.apiUrl}/folders/${folderId}/permissions`,
            payload,
            { headers: this.getHeaders() }
        );
    }
}