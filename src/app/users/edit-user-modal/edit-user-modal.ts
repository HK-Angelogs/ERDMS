import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-user-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './edit-user-modal.html',
  styleUrl: './edit-user-modal.css'
})
export class EditUserModal implements OnChanges {
  @Input() user: any = null;
  @Input() canModify = false;
  @Input() canChangeRole = false;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{ id: number; username: string; password: string }>();
  @Output() disable = new EventEmitter<number>();
  @Output() enable = new EventEmitter<number>();
  @Output() changeRole = new EventEmitter<{ id: number; role: string }>();

  username = '';
  password = '';

  ngOnChanges() {
    if (this.user) {
      this.username = this.user.username;
      this.password = '';
    }
  }

  submitUpdate() {
    if (!this.user || this.username.trim() === '') {
      return;
    }

    this.save.emit({
      id: this.user.id,
      username: this.username,
      password: this.password
    });
  }

  closeModal() {
    this.close.emit();
  }

  disableUser() {
    this.disable.emit(this.user.id);
  }

  enableUser() {
    this.enable.emit(this.user.id);
  }

  makeUser() {
    this.changeRole.emit({
      id: this.user.id,
      role: 'user'
    });
  }

  makeAdmin() {
    this.changeRole.emit({
      id: this.user.id,
      role: 'admin'
    });
  }
}