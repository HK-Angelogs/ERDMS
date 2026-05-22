import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DocumentService } from '../document.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './documents.html',
  styleUrl: './documents.css'
})
export class Documents implements OnInit {
  title = '';
  description = '';
  category = '';
  selectedFile: File | null = null;

  documents: any[] = [];
  filteredDocuments: any[] = [];

  selectedCategory = 'All';

  currentUser: any = null;
  currentRole: string | null = null;

  message = '';

  categories = [
    'Administrative',
    'Reports',
    'Requirements',
    'Letters',
    'Forms',
    'Others'
  ];

  constructor(
    private documentService: DocumentService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    this.currentRole = this.currentUser?.role || null;

    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadDocuments();
  }

  isAdminOrSuperAdmin(): boolean {
    return this.currentRole === 'admin' || this.currentRole === 'super_admin';
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];

    if (!file) {
      this.selectedFile = null;
      return;
    }

    this.selectedFile = file;
  }

  uploadDocument() {
    if (!this.title.trim()) {
      this.message = 'Title is required';
      return;
    }

    if (!this.category.trim()) {
      this.message = 'Category is required';
      return;
    }

    if (!this.selectedFile) {
      this.message = 'Please select a document file';
      return;
    }

    const formData = new FormData();
    formData.append('title', this.title);
    formData.append('description', this.description);
    formData.append('category', this.category);
    formData.append('document', this.selectedFile);

    this.documentService.uploadDocument(formData).subscribe({
      next: (response) => {
        this.message = response.message || 'Document uploaded successfully';

        this.title = '';
        this.description = '';
        this.category = '';
        this.selectedFile = null;

        const fileInput = document.getElementById('documentFile') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }

        this.loadDocuments();
      },
      error: (err) => {
        console.error('Failed to upload document:', err);
        this.message = err.error?.message || 'Failed to upload document';

        if (err.status === 401 || err.status === 403) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  loadDocuments() {
    this.documentService.getDocuments().subscribe({
      next: (data) => {
        this.documents = data;
        this.applyCategoryFilter();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load documents:', err);
        this.message = err.error?.message || 'Failed to load documents';

        if (err.status === 401 || err.status === 403) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  applyCategoryFilter() {
    if (this.selectedCategory === 'All') {
      this.filteredDocuments = this.documents;
      return;
    }

    this.filteredDocuments = this.documents.filter(
      (document) => document.category === this.selectedCategory
    );
  }

  viewDocument(id: number) {
    const token = this.documentService.getToken();

    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    window.open(`${this.documentService.getViewUrl(id)}?token=${token}`, '_blank');
  }

  downloadDocument(id: number) {
    const token = this.documentService.getToken();

    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    window.open(`${this.documentService.getDownloadUrl(id)}?token=${token}`, '_blank');
  }

  deleteDocument(id: number) {
    if (!this.isAdminOrSuperAdmin()) {
      alert('Only admin and super admin can delete documents');
      return;
    }

    const confirmed = confirm('Are you sure you want to delete this document?');

    if (!confirmed) {
      return;
    }

    this.documentService.deleteDocument(id).subscribe({
      next: (response) => {
        this.message = response.message || 'Document deleted successfully';
        this.loadDocuments();
      },
      error: (err) => {
        console.error('Failed to delete document:', err);
        alert(err.error?.message || 'Failed to delete document');
      }
    });
  }

  formatFileSize(size: number): string {
    if (!size) {
      return '0 KB';
    }

    const kb = size / 1024;

    if (kb < 1024) {
      return `${kb.toFixed(2)} KB`;
    }

    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }

  get userRole(): string | null {
    return this.authService.getRole();
  }

}