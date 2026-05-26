import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewEncapsulation,
  HostListener
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FolderNode,
  FolderPermissionsResponse
} from '../../folder.service';

@Component({
  selector: 'app-edit-folder-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './edit-folder-modal.html',
  styleUrl: './edit-folder-modal.css',
  encapsulation: ViewEncapsulation.None
})
export class EditFolderModal {

  // ─── DATA INPUTS ─────────────────────────────────────────────────────────

  @Input() folder: FolderNode | null = null;
  @Input() files: any[] = [];
  @Input() loading = false;
  @Input() error = '';
  @Input() forbidden = false;
  @Input() activeTab: 'files' | 'permissions' = 'files';
  @Input() categoryName = '';

  // ─── PERMISSIONS INPUTS ───────────────────────────────────────────────────

  @Input() permissions: FolderPermissionsResponse | null = null;
  @Input() permissionsLoading = false;
  @Input() permissionsError = '';
  @Input() permissionsSaving = false;
  @Input() permRoleUser = false;
  @Input() permUsers: { user_id: number; username: string; can_view: boolean }[] = [];

  // ─── ROLE INPUT ───────────────────────────────────────────────────────────

  @Input() isAdmin = false;

  // ─── OUTPUTS ─────────────────────────────────────────────────────────────

  @Output() closeModal = new EventEmitter<void>();
  @Output() tabChange = new EventEmitter<'files' | 'permissions'>();
  @Output() openMoveDoc = new EventEmitter<any>();
  @Output() fileRightClick = new EventEmitter<{ event: MouseEvent; doc: any }>();
  @Output() permRoleUserChange = new EventEmitter<boolean>();
  @Output() savePermissions = new EventEmitter<void>();

  // ─── INTERNAL HANDLERS ───────────────────────────────────────────────────

  onFileRightClick(event: MouseEvent, doc: any): void {
    event.preventDefault();
    event.stopPropagation();
    this.fileRightClick.emit({ event, doc });
  }

  @Output() popupCardClick = new EventEmitter<void>();

  onPopupCardClick(event: MouseEvent): void {
    event.stopPropagation();
    this.popupCardClick.emit();
  }

  // ─── UTILITY ─────────────────────────────────────────────────────────────

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
}