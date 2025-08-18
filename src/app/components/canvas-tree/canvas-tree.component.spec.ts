import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CanvasTreeComponent } from './canvas-tree.component';
import { Person } from '../../models/person.model';

describe('CanvasTreeComponent - Enhanced calculateTreeDimensions', () => {
  let component: CanvasTreeComponent;
  let fixture: ComponentFixture<CanvasTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CanvasTreeComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CanvasTreeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate adaptive spacing for different tree levels', () => {
    // Create test data with multiple levels
    const testPerson: Person = {
      id: 'P001',
      name: 'Root Person',
      children: [
        {
          id: 'P002',
          name: 'Child 1',
          children: [
            { id: 'P003', name: 'Grandchild 1' },
            { id: 'P004', name: 'Grandchild 2' },
            { id: 'P005', name: 'Grandchild 3' },
            { id: 'P006', name: 'Grandchild 4' }
          ]
        },
        {
          id: 'P007',
          name: 'Child 2',
          children: [
            { id: 'P008', name: 'Grandchild 5' },
            { id: 'P009', name: 'Grandchild 6' }
          ]
        }
      ]
    };

    component.personData = testPerson;
    fixture.detectChanges();

    // Access private method for testing
    const calculateTreeDimensions = (component as any).calculateTreeDimensions.bind(component);
    const dimensions = calculateTreeDimensions(testPerson);

    // Verify that dimensions are calculated
    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
    expect(dimensions.levelWidths.size).toBeGreaterThan(0);

    // Verify that level widths account for adaptive spacing
    expect(dimensions.levelWidths.get(0)).toBeDefined(); // Root level
    expect(dimensions.levelWidths.get(1)).toBeDefined(); // Children level
    expect(dimensions.levelWidths.get(2)).toBeDefined(); // Grandchildren level

    // Level 2 should have the widest width due to 6 grandchildren
    const level2Width = dimensions.levelWidths.get(2)!;
    expect(level2Width).toBeGreaterThan(dimensions.levelWidths.get(0)!);
    expect(level2Width).toBeGreaterThan(dimensions.levelWidths.get(1)!);
  });

  it('should prevent overlapping by ensuring minimum spacing requirements', () => {
    // Create test data with many nodes at the same level
    const manyChildren: Person[] = [];
    for (let i = 0; i < 10; i++) {
      manyChildren.push({
        id: `P${i + 100}`,
        name: `Child ${i + 1}`
      });
    }

    const testPerson: Person = {
      id: 'P001',
      name: 'Root Person',
      children: manyChildren
    };

    component.personData = testPerson;
    fixture.detectChanges();

    // Access private methods for testing
    const calculateTreeDimensions = (component as any).calculateTreeDimensions.bind(component);
    const calculateAdaptiveSpacing = (component as any).calculateAdaptiveSpacing.bind(component);
    
    const dimensions = calculateTreeDimensions(testPerson);
    const adaptiveSpacing = calculateAdaptiveSpacing(1, 10); // Level 1 with 10 nodes

    // Verify minimum spacing is maintained
    const minHorizontalSpacing = (component as any).minHorizontalSpacing;
    expect(adaptiveSpacing).toBeGreaterThanOrEqual(minHorizontalSpacing);

    // Verify level width accounts for all nodes with proper spacing
    const level1Width = dimensions.levelWidths.get(1)!;
    const nodeWidth = (component as any).nodeWidth;
    const expectedMinWidth = 10 * nodeWidth + 9 * minHorizontalSpacing;
    expect(level1Width).toBeGreaterThanOrEqual(expectedMinWidth);
  });
});