import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { DocumentService } from '../document.service';
import { EditFolderModal } from './edit-folder-modal/edit-folder-modal';
import { AuthService } from '../auth.service';
import {
  FolderService,
  CategoryTree,
  FolderNode,
  Category,
  FolderPermissionsResponse,
  FolderPermissionsPayload
} from '../folder.service';



@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, EditFolderModal],
  templateUrl: './documents.html',
  styleUrl: './documents.css'
})
export class Documents implements OnInit, OnDestroy {
  title = '';
  description = '';
  category = '';
  selectedFile: File | null = null;

  documents: any[] = [];
  filteredDocuments: any[] = [];

  selectedCategory = 'All';

  // Search state
  searchQuery = '';
  isSearching = false;
  private searchSubject = new Subject<string>();
  private searchSubscription: Subscription | null = null;

  currentUser: any = null;
  currentRole: string | null = null;

  message = '';

  // Categories loaded from API (replaces hardcoded array)
  categories: string[] = [];

  // ─── FOLDER TREE STATE ───────────────────────────────────────────────────

  categoryTrees: CategoryTree[] = [];
  folderTreeLoading = false;
  folderTreeError = '';

  expandedCategories: Set<number> = new Set();
  expandedFolders: Set<number> = new Set();

  // ─── CREATE FOLDER MODAL ─────────────────────────────────────────────────

  showCreateFolderModal = false;
  createFolderName = '';
  createFolderCategoryId: number | null = null;
  createFolderParentId: number | null = null;
  createFolderParentLabel = '';
  createFolderError = '';
  createFolderLoading = false;

  // ─── RENAME FOLDER MODAL ─────────────────────────────────────────────────

  showRenameFolderModal = false;
  renameFolderTarget: FolderNode | null = null;
  renameFolderName = '';
  renameFolderError = '';
  renameFolderLoading = false;

  // ─── DELETE FOLDER MODAL ─────────────────────────────────────────────────

  showDeleteFolderModal = false;
  deleteFolderTarget: FolderNode | null = null;
  deleteFolderError = '';
  deleteFolderLoading = false;

  // ─── MOVE FOLDER MODAL ───────────────────────────────────────────────────

  showMoveFolderModal = false;
  moveFolderTarget: FolderNode | null = null;
  moveFolderDestinations: { label: string; id: number | null }[] = [];
  moveFolderSelectedDestination: number | null | 'root' = null;
  moveFolderError = '';
  moveFolderLoading = false;

  // ─── FOLDER POPUP ────────────────────────────────────────────────────────

  showFolderPopup = false;
  folderPopupTarget: FolderNode | null = null;
  folderPopupFiles: any[] = [];
  folderPopupLoading = false;
  folderPopupError = '';
  folderPopupForbidden = false;
  folderPopupActiveTab: 'files' | 'permissions' = 'files';

  // ─── FOLDER POPUP — PERMISSIONS TAB ──────────────────────────────────────

  folderPermissions: FolderPermissionsResponse | null = null;
  folderPermissionsLoading = false;
  folderPermissionsError = '';
  folderPermissionsSaving = false;
  // Working copies mutated by UI toggles, submitted on save
  folderPermRoleUser = false;
  folderPermUsers: { user_id: number; username: string; can_view: boolean }[] = [];

  // ─── CONTEXT MENU ────────────────────────────────────────────────────────

  showContextMenu = false;
  contextMenuX = 0;
  contextMenuY = 0;
  contextMenuDocument: any = null;

  // ─── DELETE DOCUMENT CONFIRMATION (inside popup) ──────────────────────────

  showPopupDeleteConfirm = false;
  popupDeleteTarget: any = null;
  popupDeleteLoading = false;
  popupDeleteError = '';

  // ─── MOVE DOCUMENT MODAL (inside popup) ───────────────────────────────────

  showMoveDocModal = false;
  moveDocTarget: any = null;
  moveDocSelectedFolderId: number | null = null;
  moveDocFolderOptions: { label: string; id: number }[] = [];
  moveDocLoading = false;
  moveDocError = '';

  constructor(
    private documentService: DocumentService,
    private authService: AuthService,
    private folderService: FolderService,
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

    this.initSearchDebounce();
    this.loadCategories();
    this.loadDocuments();
    this.loadFolderTree();
  }

  ngOnDestroy() {
    this.searchSubscription?.unsubscribe();
  }

  // ─── GLOBAL KEYBOARD / CLICK LISTENERS ───────────────────────────────────

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showContextMenu) {
      this.closeContextMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeContextMenu();
    if (this.showPopupDeleteConfirm) {
      this.closePopupDeleteConfirm();
    } else if (this.showMoveDocModal) {
      this.closeMoveDocModal();
    } else if (this.showFolderPopup) {
      this.closeFolderPopup();
    }
    this.cdr.detectChanges();
  }

  // ─── CATEGORIES ──────────────────────────────────────────────────────────

  loadCategories() {
    this.folderService.getCategories().subscribe({
      next: (data: Category[]) => {
        this.categories = data.map(c => c.name);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.categories = [
          'Administrative', 'Reports', 'Requirements', 'Letters', 'Forms', 'Others'
        ];
        console.error('Failed to load categories from API, using fallback:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // ─── FOLDER TREE ─────────────────────────────────────────────────────────

  loadFolderTree() {
    this.folderTreeLoading = true;
    this.folderTreeError = '';

    this.folderService.getFolderTree().subscribe({
      next: (data: CategoryTree[]) => {
        this.categoryTrees = data;
        this.folderTreeLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.folderTreeError = err.error?.message || 'Failed to load folder tree';
        this.folderTreeLoading = false;

        if (err.status === 401 || err.status === 403) {
          this.router.navigate(['/login']);
        }

        this.cdr.detectChanges();
      }
    });
  }

  toggleCategory(categoryId: number) {
    if (this.expandedCategories.has(categoryId)) {
      // Clicking an already-open category collapses it
      this.expandedCategories.delete(categoryId);
    } else {
      // Collapse all other root categories before expanding the new one
      this.expandedCategories.clear();
      this.expandedCategories.add(categoryId);
    }
    this.cdr.detectChanges();
  }

  isCategoryExpanded(categoryId: number): boolean {
    return this.expandedCategories.has(categoryId);
  }

  toggleFolder(folderId: number) {
    if (this.expandedFolders.has(folderId)) {
      this.expandedFolders.delete(folderId);
    } else {
      this.expandedFolders.add(folderId);
    }
    this.cdr.detectChanges();
  }

  isFolderExpanded(folderId: number): boolean {
    return this.expandedFolders.has(folderId);
  }

  // ─── FOLDER POPUP ────────────────────────────────────────────────────────

  openFolderPopup(folder: FolderNode): void {
    this.folderPopupTarget = folder;
    this.folderPopupFiles = [];
    this.folderPopupError = '';
    this.folderPopupForbidden = false;
    this.folderPopupActiveTab = 'files';
    this.folderPermissions = null;
    this.folderPermissionsError = '';
    this.showFolderPopup = true;
    this.loadFolderFiles(folder.id);
    this.cdr.detectChanges();
  }

  closeFolderPopup(): void {
    this.showFolderPopup = false;
    this.folderPopupTarget = null;
    this.folderPopupFiles = [];
    this.showContextMenu = false;
    this.cdr.detectChanges();
  }

  setFolderPopupTab(tab: 'files' | 'permissions'): void {
    this.folderPopupActiveTab = tab;

    if (tab === 'permissions' && !this.folderPermissions && this.folderPopupTarget) {
      this.loadFolderPermissions(this.folderPopupTarget.id);
    }

    this.cdr.detectChanges();
  }

  loadFolderFiles(folderId: number): void {
    this.folderPopupLoading = true;
    this.folderPopupError = '';
    this.folderPopupForbidden = false;

    this.folderService.getFolderFiles(folderId).subscribe({
      next: (files: any[]) => {
        this.folderPopupFiles = files;
        this.folderPopupLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.folderPopupLoading = false;

        if (err.status === 403) {
          this.folderPopupForbidden = true;
        } else {
          this.folderPopupError = err.error?.message || 'Failed to load folder files';
        }

        this.cdr.detectChanges();
      }
    });
  }

  reloadFolderPopup(): void {
    if (this.folderPopupTarget) {
      this.loadFolderFiles(this.folderPopupTarget.id);
    }
  }

  // ─── FOLDER PERMISSIONS ───────────────────────────────────────────────────

  loadFolderPermissions(folderId: number): void {
    this.folderPermissionsLoading = true;
    this.folderPermissionsError = '';

    this.folderService.getFolderPermissions(folderId).subscribe({
      next: (data: FolderPermissionsResponse) => {
        this.folderPermissions = data;
        this.folderPermissionsLoading = false;
        this.buildPermissionWorkingCopies();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.folderPermissionsError = err.error?.message || 'Failed to load permissions';
        this.folderPermissionsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private buildPermissionWorkingCopies(): void {
    if (!this.folderPermissions) return;

    const roleRow = this.folderPermissions.role_permissions.find(r => r.role === 'user');
    this.folderPermRoleUser = roleRow ? roleRow.can_view === 1 : false;

    this.folderPermUsers = this.folderPermissions.all_users.map(u => {
      const perm = this.folderPermissions!.user_permissions.find(p => p.user_id === u.id);
      return {
        user_id: u.id,
        username: u.username,
        can_view: perm ? perm.can_view === 1 : false
      };
    });
  }

  submitFolderPermissions(): void {
    if (!this.folderPopupTarget) return;

    this.folderPermissionsSaving = true;
    this.folderPermissionsError = '';

    const payload: FolderPermissionsPayload = {
      role_permissions: [{ role: 'user', can_view: this.folderPermRoleUser ? 1 : 0 }],
      user_permissions: this.folderPermUsers.map(u => ({
        user_id: u.user_id,
        can_view: u.can_view ? 1 : 0
      }))
    };

    this.folderService.updateFolderPermissions(this.folderPopupTarget.id, payload).subscribe({
      next: () => {
        this.folderPermissionsSaving = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.folderPermissionsError = err.error?.message || 'Failed to save permissions';
        this.folderPermissionsSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ─── CONTEXT MENU ────────────────────────────────────────────────────────

  onFileRightClick(event: MouseEvent, doc: any): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuDocument = doc;
    this.contextMenuX = event.clientX;
    this.contextMenuY = event.clientY;
    this.showContextMenu = true;
    this.cdr.detectChanges();
  }

  closeContextMenu(): void {
    this.showContextMenu = false;
    this.contextMenuDocument = null;
    this.cdr.detectChanges();
  }

  onModalFileRightClick(payload: { event: MouseEvent; doc: any }): void {
    this.onFileRightClick(payload.event, payload.doc);
  }

  // ─── DELETE FROM POPUP ────────────────────────────────────────────────────

  openPopupDeleteConfirm(doc: any): void {
    this.popupDeleteTarget = doc;
    this.popupDeleteError = '';
    this.popupDeleteLoading = false;
    this.showPopupDeleteConfirm = true;
    this.showContextMenu = false;
    this.cdr.detectChanges();
  }

  closePopupDeleteConfirm(): void {
    this.showPopupDeleteConfirm = false;
    this.popupDeleteTarget = null;
    this.cdr.detectChanges();
  }

  confirmPopupDelete(): void {
    if (!this.popupDeleteTarget) return;

    this.popupDeleteLoading = true;
    this.popupDeleteError = '';

    this.documentService.deleteDocument(this.popupDeleteTarget.id).subscribe({
      next: () => {
        this.popupDeleteLoading = false;
        this.showPopupDeleteConfirm = false;
        this.popupDeleteTarget = null;
        this.reloadFolderPopup();
        this.loadDocuments();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.popupDeleteError = err.error?.message || 'Failed to delete document';
        this.popupDeleteLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ─── MOVE DOCUMENT ────────────────────────────────────────────────────────

  openMoveDocModal(doc: any): void {
    this.moveDocTarget = doc;
    this.moveDocSelectedFolderId = null;
    this.moveDocError = '';
    this.moveDocLoading = false;
    this.buildMoveDocFolderOptions();
    this.showMoveDocModal = true;
    this.showContextMenu = false;
    this.cdr.detectChanges();
  }

  closeMoveDocModal(): void {
    this.showMoveDocModal = false;
    this.moveDocTarget = null;
    this.cdr.detectChanges();
  }

  private buildMoveDocFolderOptions(): void {
    if (!this.moveDocTarget) return;

    const categoryTree = this.categoryTrees.find(ct => ct.name === this.moveDocTarget.category);
    const options: { label: string; id: number }[] = [];

    if (categoryTree) {
      this.collectFolderOptions(categoryTree.tree, '', options);
    }

    this.moveDocFolderOptions = options;
  }

  private collectFolderOptions(
    nodes: FolderNode[],
    prefix: string,
    options: { label: string; id: number }[]
  ): void {
    for (const node of nodes) {
      options.push({ label: prefix + node.name, id: node.id });
      if (node.children.length > 0) {
        this.collectFolderOptions(node.children, prefix + node.name + ' / ', options);
      }
    }
  }

  submitMoveDoc(): void {
    if (!this.moveDocTarget) return;

    if (this.moveDocSelectedFolderId === null) {
      this.moveDocError = 'Please select a destination folder';
      return;
    }

    this.moveDocLoading = true;
    this.moveDocError = '';

    this.documentService.moveDocumentToFolder(this.moveDocTarget.id, this.moveDocSelectedFolderId).subscribe({
      next: () => {
        this.moveDocLoading = false;
        this.showMoveDocModal = false;
        this.moveDocTarget = null;
        this.reloadFolderPopup();
        this.loadDocuments();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.moveDocError = err.error?.message || 'Failed to move document';
        this.moveDocLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ─── CREATE FOLDER ───────────────────────────────────────────────────────

  openCreateFolderModal(categoryId: number, parentFolder: FolderNode | null) {
    this.createFolderCategoryId = categoryId;
    this.createFolderParentId = parentFolder ? parentFolder.id : null;
    this.createFolderParentLabel = parentFolder
      ? parentFolder.name
      : this.getCategoryName(categoryId);
    this.createFolderName = '';
    this.createFolderError = '';
    this.createFolderLoading = false;
    this.showCreateFolderModal = true;
    this.cdr.detectChanges();
  }

  closeCreateFolderModal() {
    this.showCreateFolderModal = false;
    this.cdr.detectChanges();
  }

  submitCreateFolder() {
    if (!this.createFolderName.trim()) {
      this.createFolderError = 'Folder name is required';
      return;
    }

    if (!this.createFolderCategoryId) {
      this.createFolderError = 'Category is missing';
      return;
    }

    this.createFolderLoading = true;
    this.createFolderError = '';

    this.folderService.createFolder({
      name: this.createFolderName.trim(),
      category_id: this.createFolderCategoryId,
      parent_folder_id: this.createFolderParentId
    }).subscribe({
      next: () => {
        this.createFolderLoading = false;
        this.showCreateFolderModal = false;
        this.loadFolderTree();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.createFolderError = err.error?.message || 'Failed to create folder';
        this.createFolderLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ─── RENAME FOLDER ───────────────────────────────────────────────────────

  openRenameFolderModal(folder: FolderNode) {
    this.renameFolderTarget = folder;
    this.renameFolderName = folder.name;
    this.renameFolderError = '';
    this.renameFolderLoading = false;
    this.showRenameFolderModal = true;
    this.cdr.detectChanges();
  }

  closeRenameFolderModal() {
    this.showRenameFolderModal = false;
    this.cdr.detectChanges();
  }

  submitRenameFolder() {
    if (!this.renameFolderName.trim()) {
      this.renameFolderError = 'Folder name is required';
      return;
    }

    if (!this.renameFolderTarget) {
      return;
    }

    this.renameFolderLoading = true;
    this.renameFolderError = '';

    this.folderService.renameFolder(this.renameFolderTarget.id, this.renameFolderName.trim()).subscribe({
      next: () => {
        this.renameFolderLoading = false;
        this.showRenameFolderModal = false;
        this.loadFolderTree();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.renameFolderError = err.error?.message || 'Failed to rename folder';
        this.renameFolderLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ─── DELETE FOLDER ───────────────────────────────────────────────────────

  openDeleteFolderModal(folder: FolderNode) {
    this.deleteFolderTarget = folder;
    this.deleteFolderError = '';
    this.deleteFolderLoading = false;
    this.showDeleteFolderModal = true;
    this.cdr.detectChanges();
  }

  closeDeleteFolderModal() {
    this.showDeleteFolderModal = false;
    this.cdr.detectChanges();
  }

  submitDeleteFolder() {
    if (!this.deleteFolderTarget) {
      return;
    }

    this.deleteFolderLoading = true;
    this.deleteFolderError = '';

    this.folderService.deleteFolder(this.deleteFolderTarget.id).subscribe({
      next: () => {
        this.deleteFolderLoading = false;
        this.showDeleteFolderModal = false;
        this.expandedFolders.delete(this.deleteFolderTarget!.id);
        this.loadFolderTree();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.deleteFolderError = err.error?.message || 'Failed to delete folder';
        this.deleteFolderLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ─── MOVE FOLDER ─────────────────────────────────────────────────────────

  openMoveFolderModal(folder: FolderNode) {
    this.moveFolderTarget = folder;
    this.moveFolderError = '';
    this.moveFolderLoading = false;
    this.moveFolderSelectedDestination = null;

    const categoryTree = this.categoryTrees.find(ct => ct.id === folder.category_id);
    const destinations: { label: string; id: number | null }[] = [
      { label: '(Root of category)', id: null }
    ];

    if (categoryTree) {
      this.collectMoveDestinations(categoryTree.tree, folder.id, '', destinations);
    }

    this.moveFolderDestinations = destinations;
    this.showMoveFolderModal = true;
    this.cdr.detectChanges();
  }

  private collectMoveDestinations(
    nodes: FolderNode[],
    excludeId: number,
    prefix: string,
    destinations: { label: string; id: number | null }[]
  ) {
    for (const node of nodes) {
      if (node.id === excludeId) {
        continue;
      }
      destinations.push({ label: prefix + node.name, id: node.id });
      if (node.children.length > 0) {
        this.collectMoveDestinations(node.children, excludeId, prefix + node.name + ' / ', destinations);
      }
    }
  }

  closeMoveFolderModal() {
    this.showMoveFolderModal = false;
    this.cdr.detectChanges();
  }

  submitMoveFolder() {
    if (!this.moveFolderTarget) {
      return;
    }

    if (this.moveFolderSelectedDestination === null) {
      this.moveFolderError = 'Please select a destination';
      return;
    }

    const newParentId: number | null =
      this.moveFolderSelectedDestination === 'root' || this.moveFolderSelectedDestination === null
        ? null
        : Number(this.moveFolderSelectedDestination);

    this.moveFolderLoading = true;
    this.moveFolderError = '';

    this.folderService.moveFolder(this.moveFolderTarget.id, newParentId).subscribe({
      next: () => {
        this.moveFolderLoading = false;
        this.showMoveFolderModal = false;
        this.loadFolderTree();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.moveFolderError = err.error?.message || 'Failed to move folder';
        this.moveFolderLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ─── UTILITIES ───────────────────────────────────────────────────────────

  getCategoryName(categoryId: number): string {
    const cat = this.categoryTrees.find(ct => ct.id === categoryId);
    return cat ? cat.name : 'Unknown';
  }

  // ─── EXISTING METHODS (unchanged) ────────────────────────────────────────

  private initSearchDebounce() {
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap((query) => {
        const trimmed = query.trim();

        if (!trimmed) {
          this.isSearching = false;
          this.applyCategoryFilter();
          this.cdr.detectChanges();
          return [];
        }

        this.isSearching = true;
        return this.documentService.searchDocuments(trimmed);
      })
    ).subscribe({
      next: (results: any[]) => {
        if (this.isSearching) {
          this.filteredDocuments = results;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Search failed:', err);
        this.message = err.error?.message || 'Search failed';
        this.isSearching = false;

        if (err.status === 401 || err.status === 403) {
          this.router.navigate(['/login']);
        }

        this.cdr.detectChanges();
      }
    });
  }

  onSearchInput() {
    this.searchSubject.next(this.searchQuery);
  }

  clearSearch() {
    this.searchQuery = '';
    this.isSearching = false;
    this.applyCategoryFilter();
    this.cdr.detectChanges();
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
        this.loadFolderTree();
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

        if (!this.isSearching) {
          this.applyCategoryFilter();
        }

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

  onCategoryChange() {
    if (this.searchQuery) {
      this.clearSearch();
    } else {
      this.applyCategoryFilter();
    }
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
        this.clearSearch();
        this.loadDocuments();
        this.loadFolderTree();
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