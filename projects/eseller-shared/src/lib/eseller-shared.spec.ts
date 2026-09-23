import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EsellerShared } from './eseller-shared';

describe('EsellerShared', () => {
  let component: EsellerShared;
  let fixture: ComponentFixture<EsellerShared>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EsellerShared],
    }).compileComponents();

    fixture = TestBed.createComponent(EsellerShared);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
