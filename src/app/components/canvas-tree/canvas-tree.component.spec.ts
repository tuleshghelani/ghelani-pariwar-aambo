import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CanvasTreeComponent } from './canvas-tree.component';

describe('CanvasTreeComponent', () => {
  let component: CanvasTreeComponent;
  let fixture: ComponentFixture<CanvasTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CanvasTreeComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CanvasTreeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
