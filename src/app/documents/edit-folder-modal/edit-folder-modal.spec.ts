import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditFolderModal } from './edit-folder-modal';

describe('EditFolderModal', () => {
  let component: EditFolderModal;
  let fixture: ComponentFixture<EditFolderModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditFolderModal],
    }).compileComponents();

    fixture = TestBed.createComponent(EditFolderModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
