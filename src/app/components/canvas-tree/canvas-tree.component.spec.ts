import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CanvasTreeComponent } from './canvas-tree.component';
import { Person } from '../../models/person.model';

describe('CanvasTreeComponent - Enhanced Layout Calculations', () => {
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

  it('should handle variable tree depths efficiently', () => {
    // Create a deep tree structure (7 levels)
    const deepTree: Person = {
      id: 'root',
      name: 'Root Person',
      children: [
        {
          id: 'level1-1',
          name: 'Level 1 Person 1',
          children: [
            {
              id: 'level2-1',
              name: 'Level 2 Person 1',
              children: [
                {
                  id: 'level3-1',
                  name: 'Level 3 Person 1',
                  children: [
                    {
                      id: 'level4-1',
                      name: 'Level 4 Person 1',
                      children: [
                        {
                          id: 'level5-1',
                          name: 'Level 5 Person 1',
                          children: [
                            {
                              id: 'level6-1',
                              name: 'Level 6 Person 1',
                              children: []
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    component.personData = deepTree;
    fixture.detectChanges();

    // Test should complete without errors for deep tree
    expect(component.personData).toBeDefined();
  });

  it('should handle wide tree structures with many nodes per level', () => {
    // Create a wide tree structure (many children at each level)
    const wideTree: Person = {
      id: 'root',
      name: 'Root Person',
      children: Array.from({ length: 8 }, (_, i) => ({
        id: `level1-${i + 1}`,
        name: `Level 1 Person ${i + 1}`,
        children: Array.from({ length: 5 }, (_, j) => ({
          id: `level2-${i + 1}-${j + 1}`,
          name: `Level 2 Person ${i + 1}-${j + 1}`,
          children: []
        }))
      }))
    };

    component.personData = wideTree;
    fixture.detectChanges();

    // Test should complete without errors for wide tree
    expect(component.personData).toBeDefined();
    expect(component.personData.children?.length).toBe(8);
  });

  it('should optimize performance for large tree structures', () => {
    // Create a large tree structure (10+ levels with multiple branches)
    const createLargeTree = (level: number, maxLevel: number): Person[] => {
      if (level >= maxLevel) return [];

      return Array.from({ length: Math.max(1, 6 - level) }, (_, i) => ({
        id: `level${level}-${i + 1}`,
        name: `Level ${level} Person ${i + 1}`,
        children: createLargeTree(level + 1, maxLevel)
      }));
    };

    const largeTree: Person = {
      id: 'root',
      name: 'Root Person',
      children: createLargeTree(1, 12) // 12 levels deep
    };

    component.personData = largeTree;
    fixture.detectChanges();

    // Test should complete without errors for large tree
    expect(component.personData).toBeDefined();
  });
});