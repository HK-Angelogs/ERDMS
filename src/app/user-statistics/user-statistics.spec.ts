import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserStatistics } from './user-statistics';

describe('UserStatistics', () => {
  let component: UserStatistics;
  let fixture: ComponentFixture<UserStatistics>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserStatistics],
    }).compileComponents();

    fixture = TestBed.createComponent(UserStatistics);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
