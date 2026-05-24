import { ComponentFixture, TestBed } from '@angular/core/testing';

import { changePassword } from './change-password';

describe('changePassword', () => {
  let component: changePassword;
  let fixture: ComponentFixture<changePassword>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [changePassword],
    }).compileComponents();

    fixture = TestBed.createComponent(changePassword);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
