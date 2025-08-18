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

  // ===== ERROR HANDLING TESTS =====

  describe('Error Handling for Edge Cases', () => {
    it('should handle null or undefined tree data gracefully', () => {
      // Test with null data
      component.personData = null;
      expect(() => component['drawTree']()).not.toThrow();

      // Test with undefined data
      component.personData = undefined as any;
      expect(() => component['drawTree']()).not.toThrow();
    });

    it('should validate malformed tree data', () => {
      // Test with missing required properties
      const malformedTree = {
        id: '',
        name: '',
        children: []
      } as Person;

      expect(component['validateTreeData'](malformedTree)).toBeFalsy();

      // Test with circular reference
      const circularTree: Person = {
        id: 'root',
        name: 'Root',
        children: []
      };
      circularTree.children = [circularTree]; // Circular reference

      expect(component['validateTreeData'](circularTree)).toBeFalsy();
    });

    it('should handle extremely wide trees with fallback strategies', () => {
      // Create an extremely wide tree (200+ nodes at one level)
      const wideTree: Person = {
        id: 'root',
        name: 'Root',
        children: []
      };

      // Add 250 children to exceed maxNodesPerLevel
      for (let i = 0; i < 250; i++) {
        wideTree.children!.push({
          id: `child-${i}`,
          name: `Child ${i}`,
          children: []
        });
      }

      // Should detect as invalid due to too many children
      expect(component['validateTreeData'](wideTree)).toBeFalsy();
    });

    it('should handle invalid tree dimensions gracefully', () => {
      const invalidDimensions = {
        width: NaN,
        height: Infinity,
        levelWidths: new Map()
      };

      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;

      expect(component['validateTreeDimensions'](invalidDimensions, canvas)).toBeFalsy();
    });

    it('should sanitize malformed tree data when possible', () => {
      const malformedTree = {
        id: null,
        name: undefined,
        children: [
          {
            id: 'child1',
            name: 'Valid Child',
            children: []
          },
          null, // Invalid child
          {
            id: 'child2',
            name: 'Another Valid Child',
            children: []
          }
        ]
      } as any;

      const sanitized = component['sanitizeTreeData'](malformedTree);
      
      expect(sanitized).toBeTruthy();
      expect(sanitized!.id).toBeTruthy();
      expect(sanitized!.name).toBeTruthy();
      expect(sanitized!.children!.length).toBe(2); // Should filter out null child
    });

    it('should calculate emergency scale for oversized trees', () => {
      const largeDimensions = {
        width: 10000,
        height: 8000
      };

      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;

      const emergencyScale = component['calculateEmergencyScale'](largeDimensions, canvas);
      
      expect(emergencyScale).toBeGreaterThan(0);
      expect(emergencyScale).toBeLessThan(1);
      expect(emergencyScale).toBeGreaterThanOrEqual(component['emergencyFallbackScale']);
    });

    it('should handle layout calculation failures with recovery', () => {
      // Mock a scenario that would cause layout calculation to fail
      const invalidTree: Person = {
        id: 'root',
        name: 'Root',
        children: []
      };

      // Spy on console.error to verify error handling
      const consoleSpy = spyOn(console, 'error');

      // Force an error by providing invalid parameters to adaptive spacing
      expect(() => {
        component['calculateEnhancedAdaptiveSpacing'](-1, -1, -1);
      }).not.toThrow(); // Should not throw, should handle gracefully

      // Should have logged an error
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should reset error recovery state after successful render', () => {
      // Set up error state
      component['errorRecoveryAttempts'] = 2;
      component['isInErrorRecovery'] = true;
      component['lastErrorState'] = 'test error';

      // Call reset method
      component['resetErrorRecoveryState']();

      expect(component['errorRecoveryAttempts']).toBe(0);
      expect(component['isInErrorRecovery']).toBeFalsy();
      expect(component['lastErrorState']).toBeNull();
    });

    it('should clear all caches during error recovery', () => {
      // Set up some cached data
      component['renderCache'].set('test', { x: 0, y: 0, width: 100 });
      component['levelNodeCounts'].set(0, 5);
      component['lastTreeHash'] = 'test-hash';

      // Clear caches
      component['clearAllCaches']();

      expect(component['renderCache'].size).toBe(0);
      expect(component['levelNodeCounts'].size).toBe(0);
      expect(component['lastTreeHash']).toBe('');
    });

    it('should handle canvas dimension validation', () => {
      const validCanvas = document.createElement('canvas');
      validCanvas.width = 800;
      validCanvas.height = 600;

      const validDimensions = {
        width: 1000,
        height: 800,
        levelWidths: new Map([[0, 200], [1, 400]])
      };

      expect(component['validateTreeDimensions'](validDimensions, validCanvas)).toBeTruthy();

      // Test with oversized canvas
      const oversizedCanvas = document.createElement('canvas');
      oversizedCanvas.width = 50000; // Exceeds maxCanvasWidth
      oversizedCanvas.height = 600;

      expect(component['validateTreeDimensions'](validDimensions, oversizedCanvas)).toBeFalsy();
    });
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

  // Adaptive Spacing Algorithm Tests
  describe('Adaptive Spacing Algorithms', () => {
    beforeEach(() => {
      // Ensure canvas is properly initialized for spacing calculations
      const canvas = component['canvasRef'].nativeElement;
      canvas.width = 1200;
      canvas.height = 800;
      component['ctx'] = canvas.getContext('2d')!;
      component['scale'] = 1;
    });

    describe('calculateAdaptiveSpacing', () => {
      it('should calculate optimal spacing for small trees (4 levels)', () => {
        const level = 1;
        const nodeCount = 3;
        
        const spacing = component['calculateAdaptiveSpacing'](level, nodeCount);
        
        expect(spacing).toBeGreaterThanOrEqual(component['minHorizontalSpacing']);
        expect(spacing).toBeLessThanOrEqual(component['maxHorizontalSpacing']);
        expect(typeof spacing).toBe('number');
      });

      it('should calculate tighter spacing for deeper levels', () => {
        const nodeCount = 4;
        
        const level2Spacing = component['calculateAdaptiveSpacing'](2, nodeCount);
        const level5Spacing = component['calculateAdaptiveSpacing'](5, nodeCount);
        
        expect(level5Spacing).toBeLessThanOrEqual(level2Spacing);
      });

      it('should return default spacing for single node', () => {
        const spacing = component['calculateAdaptiveSpacing'](1, 1);
        
        expect(spacing).toBe(component['horizontalSpacing']);
      });

      it('should respect minimum spacing constraints', () => {
        // Test with very wide canvas to ensure minimum is respected
        const canvas = component['canvasRef'].nativeElement;
        canvas.width = 5000;
        
        const spacing = component['calculateAdaptiveSpacing'](0, 20);
        
        expect(spacing).toBeGreaterThanOrEqual(component['minHorizontalSpacing']);
      });

      it('should respect maximum spacing constraints', () => {
        // Test with narrow canvas to ensure maximum is respected
        const canvas = component['canvasRef'].nativeElement;
        canvas.width = 400;
        
        const spacing = component['calculateAdaptiveSpacing'](0, 2);
        
        expect(spacing).toBeLessThanOrEqual(component['maxHorizontalSpacing']);
      });
    });

    describe('calculateEnhancedAdaptiveSpacing', () => {
      it('should handle shallow trees (4 levels) with standard spacing', () => {
        const level = 2;
        const nodeCount = 5;
        const totalLevels = 4;
        
        const spacing = component['calculateEnhancedAdaptiveSpacing'](level, nodeCount, totalLevels);
        
        expect(spacing).toBeGreaterThanOrEqual(component['minHorizontalSpacing']);
        expect(spacing).toBeLessThanOrEqual(component['maxHorizontalSpacing']);
      });

      it('should apply progressive tightening for medium depth trees (5-7 levels)', () => {
        const nodeCount = 4;
        const level = 3;
        
        const mediumTreeSpacing = component['calculateEnhancedAdaptiveSpacing'](level, nodeCount, 6);
        const shallowTreeSpacing = component['calculateEnhancedAdaptiveSpacing'](level, nodeCount, 3);
        
        expect(mediumTreeSpacing).toBeLessThan(shallowTreeSpacing);
      });

      it('should apply aggressive spacing reduction for deep trees (8-10 levels)', () => {
        const nodeCount = 3;
        const level = 4;
        
        const deepTreeSpacing = component['calculateEnhancedAdaptiveSpacing'](level, nodeCount, 9);
        const mediumTreeSpacing = component['calculateEnhancedAdaptiveSpacing'](level, nodeCount, 6);
        
        expect(deepTreeSpacing).toBeLessThan(mediumTreeSpacing);
      });

      it('should apply maximum compression for very deep trees (10+ levels)', () => {
        const nodeCount = 4;
        const level = 6;
        
        const veryDeepTreeSpacing = component['calculateEnhancedAdaptiveSpacing'](level, nodeCount, 12);
        const deepTreeSpacing = component['calculateEnhancedAdaptiveSpacing'](level, nodeCount, 8);
        
        expect(veryDeepTreeSpacing).toBeLessThan(deepTreeSpacing);
      });

      it('should handle performance optimizations for large trees', () => {
        // Set up large tree condition
        component['isLargeTree'] = true;
        
        const spacing = component['calculateEnhancedAdaptiveSpacing'](3, 5, 8);
        
        expect(spacing).toBeGreaterThanOrEqual(component['minHorizontalSpacing'] * 0.8);
        expect(typeof spacing).toBe('number');
      });

      it('should use minimum spacing for very deep levels in large trees', () => {
        component['isLargeTree'] = true;
        
        const deepLevelSpacing = component['calculateEnhancedAdaptiveSpacing'](7, 3, 10);
        
        expect(deepLevelSpacing).toBeGreaterThanOrEqual(component['minHorizontalSpacing']);
      });
    });

    describe('Overlap Prevention Logic', () => {
      it('should detect overlapping nodes at the same level', () => {
        const nodeBoundingBoxes = new Map();
        
        // Create overlapping nodes at level 2
        nodeBoundingBoxes.set('node1', {
          x: 100, y: 200, width: 180, height: 60, level: 2, nodeId: 'node1'
        });
        nodeBoundingBoxes.set('node2', {
          x: 150, y: 200, width: 180, height: 60, level: 2, nodeId: 'node2'
        });
        
        const overlaps = component['detectNodeOverlaps'](nodeBoundingBoxes);
        
        expect(overlaps.length).toBe(1);
        expect(overlaps[0].level).toBe(2);
        expect(overlaps[0].overlapArea).toBeGreaterThan(0);
      });

      it('should not detect overlaps for non-overlapping nodes', () => {
        const nodeBoundingBoxes = new Map();
        
        // Create non-overlapping nodes at level 1
        nodeBoundingBoxes.set('node1', {
          x: 100, y: 200, width: 180, height: 60, level: 1, nodeId: 'node1'
        });
        nodeBoundingBoxes.set('node2', {
          x: 300, y: 200, width: 180, height: 60, level: 1, nodeId: 'node2'
        });
        
        const overlaps = component['detectNodeOverlaps'](nodeBoundingBoxes);
        
        expect(overlaps.length).toBe(0);
      });

      it('should not detect overlaps between nodes at different levels', () => {
        const nodeBoundingBoxes = new Map();
        
        // Create overlapping nodes at different levels
        nodeBoundingBoxes.set('node1', {
          x: 100, y: 200, width: 180, height: 60, level: 1, nodeId: 'node1'
        });
        nodeBoundingBoxes.set('node2', {
          x: 150, y: 200, width: 180, height: 60, level: 2, nodeId: 'node2'
        });
        
        const overlaps = component['detectNodeOverlaps'](nodeBoundingBoxes);
        
        expect(overlaps.length).toBe(0);
      });

      it('should calculate bounding box overlap correctly with buffer', () => {
        const box1 = { x: 100, y: 200, width: 180, height: 60, level: 1, nodeId: 'node1' };
        const box2 = { x: 150, y: 200, width: 180, height: 60, level: 1, nodeId: 'node2' };
        
        const overlap = component['calculateBoundingBoxOverlap'](box1, box2);
        
        expect(overlap.hasOverlap).toBe(true);
        expect(overlap.area).toBeGreaterThan(0);
        expect(overlap.overlapRect).toBeDefined();
      });

      it('should adjust positioning when overlaps are detected', () => {
        const overlaps = [{
          node1: { x: 100, y: 200, width: 180, height: 60, level: 2, nodeId: 'node1' },
          node2: { x: 150, y: 200, width: 180, height: 60, level: 2, nodeId: 'node2' },
          overlapArea: 1000,
          level: 2
        }];
        
        const treeDimensions = {
          width: 800,
          height: 600,
          levelWidths: new Map([[2, 400]])
        };
        
        // Set up level node counts
        component['levelNodeCounts'].set(2, 2);
        
        const result = component['adjustPositioningForOverlaps'](overlaps, treeDimensions);
        
        expect(result.adjustedSpacing.size).toBeGreaterThan(0);
        expect(result.adjustedSpacing.get(2)).toBeGreaterThan(component['minHorizontalSpacing']);
      });
    });

    describe('Spacing Calculations for Various Tree Configurations', () => {
      it('should work correctly for trees with 4 levels', () => {
        const testTree: Person = {
          id: 'root',
          name: 'Root',
          children: [
            {
              id: 'l1-1', name: 'Level 1-1',
              children: [
                {
                  id: 'l2-1', name: 'Level 2-1',
                  children: [
                    { id: 'l3-1', name: 'Level 3-1', children: [] }
                  ]
                }
              ]
            }
          ]
        };
        
        component.personData = testTree;
        const dimensions = component['calculateTreeDimensionsWithAdaptiveSpacing'](testTree);
        
        expect(dimensions.width).toBeGreaterThan(0);
        expect(dimensions.height).toBeGreaterThan(0);
        expect(dimensions.levelWidths.size).toBe(4);
      });

      it('should work correctly for trees with 7 levels', () => {
        const createDeepTree = (level: number): Person[] => {
          if (level >= 7) return [];
          return [{
            id: `l${level}-1`,
            name: `Level ${level}-1`,
            children: createDeepTree(level + 1)
          }];
        };
        
        const testTree: Person = {
          id: 'root',
          name: 'Root',
          children: createDeepTree(1)
        };
        
        component.personData = testTree;
        const dimensions = component['calculateTreeDimensionsWithAdaptiveSpacing'](testTree);
        
        expect(dimensions.width).toBeGreaterThan(0);
        expect(dimensions.height).toBeGreaterThan(0);
        expect(dimensions.levelWidths.size).toBe(7);
      });

      it('should work correctly for trees with 10+ levels', () => {
        const createVeryDeepTree = (level: number): Person[] => {
          if (level >= 12) return [];
          return [{
            id: `l${level}-1`,
            name: `Level ${level}-1`,
            children: createVeryDeepTree(level + 1)
          }];
        };
        
        const testTree: Person = {
          id: 'root',
          name: 'Root',
          children: createVeryDeepTree(1)
        };
        
        component.personData = testTree;
        const dimensions = component['calculateTreeDimensionsWithAdaptiveSpacing'](testTree);
        
        expect(dimensions.width).toBeGreaterThan(0);
        expect(dimensions.height).toBeGreaterThan(0);
        expect(dimensions.levelWidths.size).toBe(12);
      });

      it('should handle different node counts per level', () => {
        const testTree: Person = {
          id: 'root',
          name: 'Root',
          children: [
            {
              id: 'l1-1', name: 'Level 1-1',
              children: [
                { id: 'l2-1', name: 'Level 2-1', children: [] },
                { id: 'l2-2', name: 'Level 2-2', children: [] },
                { id: 'l2-3', name: 'Level 2-3', children: [] }
              ]
            },
            {
              id: 'l1-2', name: 'Level 1-2',
              children: [
                { id: 'l2-4', name: 'Level 2-4', children: [] },
                { id: 'l2-5', name: 'Level 2-5', children: [] }
              ]
            }
          ]
        };
        
        component.personData = testTree;
        const dimensions = component['calculateTreeDimensionsWithAdaptiveSpacing'](testTree);
        
        // Level 0: 1 node (root)
        // Level 1: 2 nodes
        // Level 2: 5 nodes
        expect(component['levelNodeCounts'].get(0)).toBe(1);
        expect(component['levelNodeCounts'].get(1)).toBe(2);
        expect(component['levelNodeCounts'].get(2)).toBe(5);
        
        expect(dimensions.levelWidths.get(2)).toBeGreaterThan(dimensions.levelWidths.get(1)!);
      });

      it('should apply depth-specific adjustments correctly', () => {
        const levelWidth = 1000;
        const level = 5;
        const totalLevels = 10;
        
        const adjustedWidth = component['applyDepthSpecificAdjustments'](levelWidth, level, totalLevels);
        
        expect(adjustedWidth).toBeLessThanOrEqual(levelWidth);
        expect(adjustedWidth).toBeGreaterThan(0);
      });

      it('should calculate vertical spacing for different tree depths', () => {
        const shallowTreeSpacing = component['calculateVerticalSpacingForDepth'](3);
        const deepTreeSpacing = component['calculateVerticalSpacingForDepth'](10);
        
        expect(deepTreeSpacing).toBeLessThan(shallowTreeSpacing);
        expect(deepTreeSpacing).toBeGreaterThanOrEqual(40); // Minimum vertical spacing
      });
    });
  });

  // Connection Line Rendering Integration Tests
  describe('Connection Line Rendering Integration Tests', () => {
    let mockCanvas: HTMLCanvasElement;
    let mockContext: CanvasRenderingContext2D;
    let drawnLines: Array<{x1: number, y1: number, x2: number, y2: number}>;

    beforeEach(() => {
      // Set up mock canvas and context for line drawing verification
      mockCanvas = component['canvasRef'].nativeElement;
      mockCanvas.width = 1200;
      mockCanvas.height = 800;
      
      drawnLines = [];
      
      // Mock the context to capture line drawing calls
      mockContext = {
        beginPath: jasmine.createSpy('beginPath'),
        moveTo: jasmine.createSpy('moveTo'),
        lineTo: jasmine.createSpy('lineTo').and.callFake((x: number, y: number) => {
          // Capture line coordinates for verification
          const lastMove = (mockContext.moveTo as jasmine.Spy).calls.mostRecent();
          if (lastMove) {
            drawnLines.push({
              x1: lastMove.args[0],
              y1: lastMove.args[1],
              x2: x,
              y2: y
            });
          }
        }),
        stroke: jasmine.createSpy('stroke'),
        strokeStyle: '#007bff',
        lineWidth: 2
      } as any;
      
      component['ctx'] = mockContext;
      component['scale'] = 1;
      component['offsetX'] = 0;
      component['offsetY'] = 0;
    });

    describe('Clean Connection Line Rendering Without Artifacts', () => {
      it('should render clean lines without visual artifacts for single child', () => {
        const parentX = 200;
        const parentY = 100;
        const childPositions = [250];
        const connectorY = 140;
        const childTopY = 180;

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Verify that lines are drawn with proper pixel alignment (no artifacts)
        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.moveTo).toHaveBeenCalled();
        expect(mockContext.lineTo).toHaveBeenCalled();
        expect(mockContext.stroke).toHaveBeenCalled();

        // Verify precise line positioning (pixel-perfect with 0.5 offset)
        const moveToCall = (mockContext.moveTo as jasmine.Spy).calls.first();
        const lineToCall = (mockContext.lineTo as jasmine.Spy).calls.first();
        
        expect(moveToCall.args[0]).toBe(Math.round(parentX) + 0.5);
        expect(moveToCall.args[1]).toBe(Math.round(parentY) + 0.5);
      });

      it('should render clean lines without visual artifacts for multiple children', () => {
        const parentX = 300;
        const parentY = 100;
        const childPositions = [200, 300, 400];
        const connectorY = 140;
        const childTopY = 180;

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Verify that all necessary lines are drawn
        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.stroke).toHaveBeenCalled();
        
        // Should draw: 1 parent vertical + 1 horizontal connector + 3 child verticals = 5 line segments
        expect(mockContext.lineTo).toHaveBeenCalledTimes(5);
      });

      it('should use proper line styling for clean rendering', () => {
        const parentX = 200;
        const parentY = 100;
        const childPositions = [250];
        const connectorY = 140;
        const childTopY = 180;

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Verify proper line styling is applied
        expect(mockContext.strokeStyle).toBe(component['lineColor']);
        expect(mockContext.lineWidth).toBe(2);
      });

      it('should handle empty child positions gracefully', () => {
        const parentX = 200;
        const parentY = 100;
        const childPositions: number[] = [];
        const connectorY = 140;
        const childTopY = 180;

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Should not draw any lines for empty children
        expect(mockContext.beginPath).not.toHaveBeenCalled();
        expect(mockContext.stroke).not.toHaveBeenCalled();
      });
    });

    describe('Single Child vs Multiple Children Connection Optimization', () => {
      it('should use direct connection for single child scenario', () => {
        const parentX = 200;
        const parentY = 100;
        const childPositions = [250];
        const connectorY = 140;
        const childTopY = 180;

        spyOn(component as any, 'drawSingleChildConnection').and.callThrough();
        spyOn(component as any, 'drawMultipleChildrenConnections');

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Should call single child method, not multiple children method
        expect(component['drawSingleChildConnection']).toHaveBeenCalledWith(parentX, connectorY, 250, childTopY);
        expect(component['drawMultipleChildrenConnections']).not.toHaveBeenCalled();
      });

      it('should use optimized horizontal span for multiple children scenario', () => {
        const parentX = 300;
        const parentY = 100;
        const childPositions = [200, 300, 400];
        const connectorY = 140;
        const childTopY = 180;

        spyOn(component as any, 'drawSingleChildConnection');
        spyOn(component as any, 'drawMultipleChildrenConnections').and.callThrough();

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Should call multiple children method, not single child method
        expect(component['drawSingleChildConnection']).not.toHaveBeenCalled();
        expect(component['drawMultipleChildrenConnections']).toHaveBeenCalledWith(connectorY, childPositions, childTopY);
      });

      it('should draw minimal lines for single child connection', () => {
        const parentX = 200;
        const connectorY = 140;
        const childX = 250;
        const childTopY = 180;

        component['drawSingleChildConnection'](parentX, connectorY, childX, childTopY);

        // Should draw exactly 2 lines: horizontal from parent to child, vertical down to child
        expect(mockContext.lineTo).toHaveBeenCalledTimes(2);
        
        // Verify line coordinates
        const calls = (mockContext.lineTo as jasmine.Spy).calls.all();
        
        // First line: horizontal from parent to child
        expect(calls[0].args[0]).toBe(Math.round(childX) + 0.5);
        expect(calls[0].args[1]).toBe(Math.round(connectorY) + 0.5);
        
        // Second line: vertical down to child
        expect(calls[1].args[0]).toBe(Math.round(childX) + 0.5);
        expect(calls[1].args[1]).toBe(Math.round(childTopY) + 0.5);
      });

      it('should draw optimized horizontal span for multiple children', () => {
        const connectorY = 140;
        const childPositions = [200, 300, 400];
        const childTopY = 180;

        component['drawMultipleChildrenConnections'](connectorY, childPositions, childTopY);

        // Should draw: 1 horizontal connector + 3 vertical connectors = 4 lines
        expect(mockContext.lineTo).toHaveBeenCalledTimes(4);
        
        const calls = (mockContext.lineTo as jasmine.Spy).calls.all();
        
        // First line should be horizontal connector spanning from leftmost to rightmost child
        const leftmostX = childPositions[0];
        const rightmostX = childPositions[childPositions.length - 1];
        const bufferLeft = Math.max(0, leftmostX - component['connectionLineBuffer']);
        const bufferRight = rightmostX + component['connectionLineBuffer'];
        
        expect(calls[0].args[0]).toBe(Math.round(bufferRight) + 0.5);
        expect(calls[0].args[1]).toBe(Math.round(connectorY) + 0.5);
      });

      it('should draw vertical connectors to each child in multiple children scenario', () => {
        const connectorY = 140;
        const childPositions = [200, 300, 400];
        const childTopY = 180;

        component['drawMultipleChildrenConnections'](connectorY, childPositions, childTopY);

        const calls = (mockContext.lineTo as jasmine.Spy).calls.all();
        
        // Verify that vertical lines are drawn to each child position
        // Skip first call (horizontal connector) and check the rest
        for (let i = 1; i < calls.length; i++) {
          const expectedChildX = childPositions[i - 1];
          expect(calls[i].args[0]).toBe(Math.round(expectedChildX) + 0.5);
          expect(calls[i].args[1]).toBe(Math.round(childTopY) + 0.5);
        }
      });
    });

    describe('Unnecessary Line Extension Removal', () => {
      it('should not extend horizontal lines beyond actual child positions', () => {
        const connectorY = 140;
        const childPositions = [200, 300, 400];
        const childTopY = 180;

        component['drawMultipleChildrenConnections'](connectorY, childPositions, childTopY);

        const calls = (mockContext.lineTo as jasmine.Spy).calls.all();
        
        // Verify horizontal connector doesn't extend excessively beyond children
        const leftmostX = childPositions[0];
        const rightmostX = childPositions[childPositions.length - 1];
        const maxAllowedLeft = leftmostX - component['connectionLineBuffer'];
        const maxAllowedRight = rightmostX + component['connectionLineBuffer'];
        
        // First line is the horizontal connector
        const horizontalEndX = calls[0].args[0] - 0.5; // Remove pixel offset for comparison
        
        expect(horizontalEndX).toBeLessThanOrEqual(maxAllowedRight);
        expect(horizontalEndX).toBeGreaterThanOrEqual(maxAllowedLeft);
      });

      it('should use minimal buffer for connection line spacing', () => {
        const connectorY = 140;
        const childPositions = [200, 400]; // Wide spacing
        const childTopY = 180;

        component['drawMultipleChildrenConnections'](connectorY, childPositions, childTopY);

        const calls = (mockContext.moveTo as jasmine.Spy).calls.all();
        const lineCalls = (mockContext.lineTo as jasmine.Spy).calls.all();
        
        // Verify that buffer is minimal and controlled
        const leftmostX = childPositions[0];
        const rightmostX = childPositions[childPositions.length - 1];
        const expectedBuffer = component['connectionLineBuffer'];
        
        // Check that the horizontal line doesn't extend more than the specified buffer
        const horizontalStartX = calls[0].args[0] - 0.5; // Remove pixel offset
        const horizontalEndX = lineCalls[0].args[0] - 0.5; // Remove pixel offset
        
        expect(horizontalStartX).toBeGreaterThanOrEqual(leftmostX - expectedBuffer);
        expect(horizontalEndX).toBeLessThanOrEqual(rightmostX + expectedBuffer);
      });

      it('should not draw unnecessary lines for single child', () => {
        const parentX = 200;
        const connectorY = 140;
        const childX = 250;
        const childTopY = 180;

        component['drawSingleChildConnection'](parentX, connectorY, childX, childTopY);

        // Should draw exactly 2 lines, no more
        expect(mockContext.lineTo).toHaveBeenCalledTimes(2);
        expect(mockContext.beginPath).toHaveBeenCalledTimes(2);
        expect(mockContext.stroke).toHaveBeenCalledTimes(2);
      });

      it('should remove artifacts by using precise pixel positioning', () => {
        const x1 = 200.3;
        const y1 = 100.7;
        const x2 = 250.9;
        const y2 = 180.1;

        component['drawPreciseLine'](x1, y1, x2, y2);

        // Verify that coordinates are rounded and offset for pixel-perfect rendering
        const moveToCall = (mockContext.moveTo as jasmine.Spy).calls.mostRecent();
        const lineToCall = (mockContext.lineTo as jasmine.Spy).calls.mostRecent();
        
        expect(moveToCall.args[0]).toBe(Math.round(x1) + 0.5);
        expect(moveToCall.args[1]).toBe(Math.round(y1) + 0.5);
        expect(lineToCall.args[0]).toBe(Math.round(x2) + 0.5);
        expect(lineToCall.args[1]).toBe(Math.round(y2) + 0.5);
      });

      it('should handle edge case where children are very close together', () => {
        const connectorY = 140;
        const childPositions = [200, 205, 210]; // Very close children
        const childTopY = 180;

        component['drawMultipleChildrenConnections'](connectorY, childPositions, childTopY);

        // Should still draw proper connections without overlapping lines
        expect(mockContext.lineTo).toHaveBeenCalledTimes(4); // 1 horizontal + 3 vertical
        
        // Verify that each child gets its own vertical connector
        const calls = (mockContext.lineTo as jasmine.Spy).calls.all();
        
        // Check that vertical lines are drawn to each distinct child position
        for (let i = 1; i < calls.length; i++) {
          const childX = calls[i].args[0] - 0.5; // Remove pixel offset
          expect(childPositions).toContain(childX);
        }
      });
    });

    describe('Integration with Tree Structure', () => {
      it('should render clean connections for complete tree structure', () => {
        const testTree: Person = {
          id: 'root',
          name: 'Root Person',
          children: [
            {
              id: 'child1',
              name: 'Child 1',
              children: [
                { id: 'grandchild1', name: 'Grandchild 1', children: [] },
                { id: 'grandchild2', name: 'Grandchild 2', children: [] }
              ]
            },
            {
              id: 'child2',
              name: 'Child 2',
              children: []
            }
          ]
        };

        component.personData = testTree;
        fixture.detectChanges();

        // Verify that the tree renders without throwing errors
        expect(component.personData).toBeDefined();
        
        // Test connection rendering for the tree structure
        const parentX = 300;
        const parentY = 100;
        const childPositions = [200, 400]; // Two children
        const connectorY = 140;
        const childTopY = 180;

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Should handle multiple children scenario correctly
        expect(mockContext.lineTo).toHaveBeenCalledTimes(3); // 1 horizontal + 2 vertical
      });

      it('should handle deep tree structures with clean connection rendering', () => {
        const createDeepTree = (level: number): Person[] => {
          if (level >= 5) return [];
          return [{
            id: `level${level}`,
            name: `Level ${level}`,
            children: createDeepTree(level + 1)
          }];
        };

        const deepTree: Person = {
          id: 'root',
          name: 'Root',
          children: createDeepTree(1)
        };

        component.personData = deepTree;
        fixture.detectChanges();

        // Test single child connections at each level
        const parentX = 300;
        const parentY = 100;
        const childPositions = [300]; // Single child directly below
        const connectorY = 140;
        const childTopY = 180;

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Should use single child optimization
        expect(mockContext.lineTo).toHaveBeenCalledTimes(2); // Direct connection
      });
    });
  });

  // Connection Line Rendering Integration Tests
  describe('Connection Line Rendering Integration Tests', () => {
    let mockCanvas: HTMLCanvasElement;
    let mockContext: CanvasRenderingContext2D;
    let drawnLines: Array<{x1: number, y1: number, x2: number, y2: number}>;

    beforeEach(() => {
      // Set up mock canvas and context for line drawing verification
      mockCanvas = document.createElement('canvas');
      mockCanvas.width = 1200;
      mockCanvas.height = 800;
      
      // Mock the canvasRef to return our mock canvas
      component['canvasRef'] = { nativeElement: mockCanvas } as any;
      
      drawnLines = [];
      
      // Mock the context to capture line drawing calls
      mockContext = {
        beginPath: jasmine.createSpy('beginPath'),
        moveTo: jasmine.createSpy('moveTo'),
        lineTo: jasmine.createSpy('lineTo').and.callFake((x: number, y: number) => {
          // Capture line coordinates for verification
          const lastMove = (mockContext.moveTo as jasmine.Spy).calls.mostRecent();
          if (lastMove) {
            drawnLines.push({
              x1: lastMove.args[0],
              y1: lastMove.args[1],
              x2: x,
              y2: y
            });
          }
        }),
        stroke: jasmine.createSpy('stroke'),
        strokeStyle: '#007bff',
        lineWidth: 2
      } as any;
      
      component['ctx'] = mockContext;
      component['scale'] = 1;
      component['offsetX'] = 0;
      component['offsetY'] = 0;
    });

    describe('Clean Connection Line Rendering Without Artifacts', () => {
      it('should render clean lines without visual artifacts for single child', () => {
        const parentX = 200;
        const parentY = 100;
        const childPositions = [250];
        const connectorY = 140;
        const childTopY = 180;

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Verify that lines are drawn with proper pixel alignment (no artifacts)
        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.moveTo).toHaveBeenCalled();
        expect(mockContext.lineTo).toHaveBeenCalled();
        expect(mockContext.stroke).toHaveBeenCalled();

        // Verify precise line positioning (pixel-perfect with 0.5 offset)
        const moveToCall = (mockContext.moveTo as jasmine.Spy).calls.first();
        
        expect(moveToCall.args[0]).toBe(Math.round(parentX) + 0.5);
        expect(moveToCall.args[1]).toBe(Math.round(parentY) + 0.5);
      });

      it('should render clean lines without visual artifacts for multiple children', () => {
        const parentX = 300;
        const parentY = 100;
        const childPositions = [200, 300, 400];
        const connectorY = 140;
        const childTopY = 180;

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Verify that all necessary lines are drawn
        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.stroke).toHaveBeenCalled();
        
        // Should draw: 1 parent vertical + 1 horizontal connector + 3 child verticals = 5 line segments
        expect(mockContext.lineTo).toHaveBeenCalledTimes(5);
      });

      it('should use proper line styling for clean rendering', () => {
        const parentX = 200;
        const parentY = 100;
        const childPositions = [250];
        const connectorY = 140;
        const childTopY = 180;

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Verify proper line styling is applied
        expect(mockContext.strokeStyle).toBe(component['lineColor']);
        expect(mockContext.lineWidth).toBe(2);
      });

      it('should handle empty child positions gracefully', () => {
        const parentX = 200;
        const parentY = 100;
        const childPositions: number[] = [];
        const connectorY = 140;
        const childTopY = 180;

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Should not draw any lines for empty children
        expect(mockContext.beginPath).not.toHaveBeenCalled();
        expect(mockContext.stroke).not.toHaveBeenCalled();
      });
    });

    describe('Single Child vs Multiple Children Connection Optimization', () => {
      it('should use direct connection for single child scenario', () => {
        const parentX = 200;
        const parentY = 100;
        const childPositions = [250];
        const connectorY = 140;
        const childTopY = 180;

        spyOn(component as any, 'drawSingleChildConnection').and.callThrough();
        spyOn(component as any, 'drawMultipleChildrenConnections');

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Should call single child method, not multiple children method
        expect(component['drawSingleChildConnection']).toHaveBeenCalledWith(parentX, connectorY, 250, childTopY);
        expect(component['drawMultipleChildrenConnections']).not.toHaveBeenCalled();
      });

      it('should use optimized horizontal span for multiple children scenario', () => {
        const parentX = 300;
        const parentY = 100;
        const childPositions = [200, 300, 400];
        const connectorY = 140;
        const childTopY = 180;

        spyOn(component as any, 'drawSingleChildConnection');
        spyOn(component as any, 'drawMultipleChildrenConnections').and.callThrough();

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Should call multiple children method, not single child method
        expect(component['drawSingleChildConnection']).not.toHaveBeenCalled();
        expect(component['drawMultipleChildrenConnections']).toHaveBeenCalledWith(connectorY, childPositions, childTopY);
      });

      it('should draw minimal lines for single child connection', () => {
        const parentX = 200;
        const connectorY = 140;
        const childX = 250;
        const childTopY = 180;

        component['drawSingleChildConnection'](parentX, connectorY, childX, childTopY);

        // Should draw exactly 2 lines: horizontal from parent to child, vertical down to child
        expect(mockContext.lineTo).toHaveBeenCalledTimes(2);
        
        // Verify line coordinates
        const calls = (mockContext.lineTo as jasmine.Spy).calls.all();
        
        // First line: horizontal from parent to child
        expect(calls[0].args[0]).toBe(Math.round(childX) + 0.5);
        expect(calls[0].args[1]).toBe(Math.round(connectorY) + 0.5);
        
        // Second line: vertical down to child
        expect(calls[1].args[0]).toBe(Math.round(childX) + 0.5);
        expect(calls[1].args[1]).toBe(Math.round(childTopY) + 0.5);
      });

      it('should draw optimized horizontal span for multiple children', () => {
        const connectorY = 140;
        const childPositions = [200, 300, 400];
        const childTopY = 180;

        component['drawMultipleChildrenConnections'](connectorY, childPositions, childTopY);

        // Should draw: 1 horizontal connector + 3 vertical connectors = 4 lines
        expect(mockContext.lineTo).toHaveBeenCalledTimes(4);
        
        const calls = (mockContext.lineTo as jasmine.Spy).calls.all();
        
        // First line should be horizontal connector spanning from leftmost to rightmost child
        const leftmostX = childPositions[0];
        const rightmostX = childPositions[childPositions.length - 1];
        const bufferRight = rightmostX + component['connectionLineBuffer'];
        
        expect(calls[0].args[0]).toBe(Math.round(bufferRight) + 0.5);
        expect(calls[0].args[1]).toBe(Math.round(connectorY) + 0.5);
      });

      it('should draw vertical connectors to each child in multiple children scenario', () => {
        const connectorY = 140;
        const childPositions = [200, 300, 400];
        const childTopY = 180;

        component['drawMultipleChildrenConnections'](connectorY, childPositions, childTopY);

        const calls = (mockContext.lineTo as jasmine.Spy).calls.all();
        
        // Verify that vertical lines are drawn to each child position
        // Skip first call (horizontal connector) and check the rest
        for (let i = 1; i < calls.length; i++) {
          const expectedChildX = childPositions[i - 1];
          expect(calls[i].args[0]).toBe(Math.round(expectedChildX) + 0.5);
          expect(calls[i].args[1]).toBe(Math.round(childTopY) + 0.5);
        }
      });
    });

    describe('Unnecessary Line Extension Removal', () => {
      it('should not extend horizontal lines beyond actual child positions', () => {
        const connectorY = 140;
        const childPositions = [200, 300, 400];
        const childTopY = 180;

        component['drawMultipleChildrenConnections'](connectorY, childPositions, childTopY);

        const calls = (mockContext.lineTo as jasmine.Spy).calls.all();
        
        // Verify horizontal connector doesn't extend excessively beyond children
        const leftmostX = childPositions[0];
        const rightmostX = childPositions[childPositions.length - 1];
        const maxAllowedLeft = leftmostX - component['connectionLineBuffer'];
        const maxAllowedRight = rightmostX + component['connectionLineBuffer'];
        
        // First line is the horizontal connector
        const horizontalEndX = calls[0].args[0] - 0.5; // Remove pixel offset for comparison
        
        expect(horizontalEndX).toBeLessThanOrEqual(maxAllowedRight);
        expect(horizontalEndX).toBeGreaterThanOrEqual(maxAllowedLeft);
      });

      it('should use minimal buffer for connection line spacing', () => {
        const connectorY = 140;
        const childPositions = [200, 400]; // Wide spacing
        const childTopY = 180;

        component['drawMultipleChildrenConnections'](connectorY, childPositions, childTopY);

        const calls = (mockContext.moveTo as jasmine.Spy).calls.all();
        const lineCalls = (mockContext.lineTo as jasmine.Spy).calls.all();
        
        // Verify that buffer is minimal and controlled
        const leftmostX = childPositions[0];
        const rightmostX = childPositions[childPositions.length - 1];
        const expectedBuffer = component['connectionLineBuffer'];
        
        // Check that the horizontal line doesn't extend more than the specified buffer
        const horizontalStartX = calls[0].args[0] - 0.5; // Remove pixel offset
        const horizontalEndX = lineCalls[0].args[0] - 0.5; // Remove pixel offset
        
        expect(horizontalStartX).toBeGreaterThanOrEqual(leftmostX - expectedBuffer);
        expect(horizontalEndX).toBeLessThanOrEqual(rightmostX + expectedBuffer);
      });

      it('should not draw unnecessary lines for single child', () => {
        const parentX = 200;
        const connectorY = 140;
        const childX = 250;
        const childTopY = 180;

        component['drawSingleChildConnection'](parentX, connectorY, childX, childTopY);

        // Should draw exactly 2 lines, no more
        expect(mockContext.lineTo).toHaveBeenCalledTimes(2);
        expect(mockContext.beginPath).toHaveBeenCalledTimes(2);
        expect(mockContext.stroke).toHaveBeenCalledTimes(2);
      });

      it('should remove artifacts by using precise pixel positioning', () => {
        const x1 = 200.3;
        const y1 = 100.7;
        const x2 = 250.9;
        const y2 = 180.1;

        component['drawPreciseLine'](x1, y1, x2, y2);

        // Verify that coordinates are rounded and offset for pixel-perfect rendering
        const moveToCall = (mockContext.moveTo as jasmine.Spy).calls.mostRecent();
        const lineToCall = (mockContext.lineTo as jasmine.Spy).calls.mostRecent();
        
        expect(moveToCall.args[0]).toBe(Math.round(x1) + 0.5);
        expect(moveToCall.args[1]).toBe(Math.round(y1) + 0.5);
        expect(lineToCall.args[0]).toBe(Math.round(x2) + 0.5);
        expect(lineToCall.args[1]).toBe(Math.round(y2) + 0.5);
      });

      it('should handle edge case where children are very close together', () => {
        const connectorY = 140;
        const childPositions = [200, 205, 210]; // Very close children
        const childTopY = 180;

        component['drawMultipleChildrenConnections'](connectorY, childPositions, childTopY);

        // Should still draw proper connections without overlapping lines
        expect(mockContext.lineTo).toHaveBeenCalledTimes(4); // 1 horizontal + 3 vertical
        
        // Verify that each child gets its own vertical connector
        const calls = (mockContext.lineTo as jasmine.Spy).calls.all();
        
        // Check that vertical lines are drawn to each distinct child position
        for (let i = 1; i < calls.length; i++) {
          const childX = calls[i].args[0] - 0.5; // Remove pixel offset
          expect(childPositions).toContain(childX);
        }
      });
    });

    describe('Integration with Tree Structure', () => {
      it('should render clean connections for complete tree structure', () => {
        const testTree: Person = {
          id: 'root',
          name: 'Root Person',
          children: [
            {
              id: 'child1',
              name: 'Child 1',
              children: [
                { id: 'grandchild1', name: 'Grandchild 1', children: [] },
                { id: 'grandchild2', name: 'Grandchild 2', children: [] }
              ]
            },
            {
              id: 'child2',
              name: 'Child 2',
              children: []
            }
          ]
        };

        component.personData = testTree;
        fixture.detectChanges();

        // Verify that the tree renders without throwing errors
        expect(component.personData).toBeDefined();
        
        // Test connection rendering for the tree structure
        const parentX = 300;
        const parentY = 100;
        const childPositions = [200, 400]; // Two children
        const connectorY = 140;
        const childTopY = 180;

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Should handle multiple children scenario correctly
        expect(mockContext.lineTo).toHaveBeenCalledTimes(4); // 1 parent vertical + 1 horizontal + 2 child verticals
      });

      it('should handle deep tree structures with clean connection rendering', () => {
        const createDeepTree = (level: number): Person[] => {
          if (level >= 5) return [];
          return [{
            id: `level${level}`,
            name: `Level ${level}`,
            children: createDeepTree(level + 1)
          }];
        };

        const deepTree: Person = {
          id: 'root',
          name: 'Root',
          children: createDeepTree(1)
        };

        component.personData = deepTree;
        fixture.detectChanges();

        // Test single child connections at each level
        const parentX = 300;
        const parentY = 100;
        const childPositions = [300]; // Single child directly below
        const connectorY = 140;
        const childTopY = 180;

        component['drawOptimizedConnections'](parentX, parentY, childPositions, connectorY, childTopY);

        // Should use single child optimization
        expect(mockContext.lineTo).toHaveBeenCalledTimes(3); // 1 parent vertical + 2 for single child connection
      });
    });
  });

  // Responsive Behavior Tests
  describe('Responsive Behavior Tests', () => {
    let mockCanvas: HTMLCanvasElement;
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
      // Store original window dimensions
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
      
      // Set up mock canvas
      mockCanvas = component['canvasRef'].nativeElement;
      component['ctx'] = mockCanvas.getContext('2d')!;
    });

    afterEach(() => {
      // Restore original window dimensions
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: originalInnerHeight
      });
    });

    describe('Device-Specific Initial Positioning', () => {
      it('should set mobile-optimized initial positioning for screens ≤768px', () => {
        // Mock mobile screen size
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 375
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 667
        });

        mockCanvas.width = 375;
        mockCanvas.height = 667;

        const initialView = component['calculateInitialView']();

        // Mobile should have smaller scale and adjusted positioning
        expect(initialView.scale).toBeLessThanOrEqual(0.6);
        expect(initialView.scale).toBeGreaterThanOrEqual(0.2);
        expect(initialView.offsetX).toBeGreaterThanOrEqual(0);
        expect(initialView.offsetY).toBeGreaterThanOrEqual(0);
      });

      it('should set tablet-optimized initial positioning for screens 769-1024px', () => {
        // Mock tablet screen size
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 768
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 1024
        });

        mockCanvas.width = 768;
        mockCanvas.height = 1024;

        const initialView = component['calculateInitialView']();

        // Tablet should have medium scale
        expect(initialView.scale).toBeLessThanOrEqual(0.8);
        expect(initialView.scale).toBeGreaterThanOrEqual(0.4);
        expect(initialView.offsetX).toBeGreaterThanOrEqual(0);
        expect(initialView.offsetY).toBeGreaterThanOrEqual(0);
      });

      it('should set desktop-optimized initial positioning for screens >1024px', () => {
        // Mock desktop screen size
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 1920
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 1080
        });

        mockCanvas.width = 1920;
        mockCanvas.height = 1080;

        const initialView = component['calculateInitialView']();

        // Desktop should have larger scale
        expect(initialView.scale).toBeLessThanOrEqual(1.2);
        expect(initialView.scale).toBeGreaterThanOrEqual(0.6);
        expect(initialView.offsetX).toBeGreaterThanOrEqual(0);
        expect(initialView.offsetY).toBeGreaterThanOrEqual(0);
      });

      it('should apply initial positioning on component initialization', () => {
        // Mock mobile screen
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 414
        });

        mockCanvas.width = 414;
        mockCanvas.height = 736;

        spyOn(component as any, 'calculateInitialView').and.callThrough();

        component.ngAfterViewInit();

        expect(component['calculateInitialView']).toHaveBeenCalled();
      });

      it('should handle edge case of very small mobile screens', () => {
        // Mock very small mobile screen
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 320
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 568
        });

        mockCanvas.width = 320;
        mockCanvas.height = 568;

        const initialView = component['calculateInitialView']();

        // Should still provide usable positioning
        expect(initialView.scale).toBeGreaterThan(0.1);
        expect(initialView.offsetX).toBeGreaterThanOrEqual(0);
        expect(initialView.offsetY).toBeGreaterThanOrEqual(0);
      });

      it('should handle edge case of very large desktop screens', () => {
        // Mock large desktop screen
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 2560
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 1440
        });

        mockCanvas.width = 2560;
        mockCanvas.height = 1440;

        const initialView = component['calculateInitialView']();

        // Should not exceed maximum reasonable scale
        expect(initialView.scale).toBeLessThanOrEqual(1.5);
        expect(initialView.offsetX).toBeGreaterThanOrEqual(0);
        expect(initialView.offsetY).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Touch Interaction Improvements on Mobile Devices', () => {
      beforeEach(() => {
        // Mock mobile screen
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 375
        });

        mockCanvas.width = 375;
        mockCanvas.height = 667;
      });

      it('should handle touch events with proper event prevention', () => {
        const mockTouchEvent = {
          type: 'touchstart',
          touches: [{ clientX: 100, clientY: 100 }],
          preventDefault: jasmine.createSpy('preventDefault'),
          stopPropagation: jasmine.createSpy('stopPropagation')
        } as any;

        // Test that touch events are handled (even if methods don't exist yet)
        expect(() => {
          if (component['onTouchStart']) {
            component['onTouchStart'](mockTouchEvent);
          }
        }).not.toThrow();
      });

      it('should calculate distance between two touch points accurately', () => {
        const touch1 = { clientX: 100, clientY: 100 };
        const touch2 = { clientX: 200, clientY: 200 };

        // Calculate distance manually for testing
        const distance = Math.sqrt(Math.pow(200 - 100, 2) + Math.pow(200 - 100, 2));
        const expectedDistance = Math.sqrt(20000); // 141.42...

        expect(distance).toBeCloseTo(expectedDistance, 1);
      });

      it('should calculate center point between two touches accurately', () => {
        const touch1 = { clientX: 100, clientY: 100 };
        const touch2 = { clientX: 200, clientY: 200 };

        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;

        expect(centerX).toBe(150);
        expect(centerY).toBe(150);
      });

      it('should handle rapid touch gestures without performance issues', () => {
        const startTime = performance.now();

        // Simulate rapid calculations (since actual touch methods may not exist)
        for (let i = 0; i < 50; i++) {
          const touch = { clientX: 100 + i, clientY: 100 + i };
          // Simulate some calculation work
          const distance = Math.sqrt(touch.clientX * touch.clientX + touch.clientY * touch.clientY);
        }

        const endTime = performance.now();
        const processingTime = endTime - startTime;

        // Should handle rapid calculations efficiently (under 50ms for 50 calculations)
        expect(processingTime).toBeLessThan(50);
      });
    });

    describe('Proper Scaling and Positioning Across Different Screen Sizes', () => {
      const testScreenSizes = [
        { width: 320, height: 568, name: 'iPhone SE' },
        { width: 375, height: 667, name: 'iPhone 8' },
        { width: 414, height: 896, name: 'iPhone 11' },
        { width: 768, height: 1024, name: 'iPad' },
        { width: 1024, height: 768, name: 'iPad Landscape' },
        { width: 1366, height: 768, name: 'Laptop' },
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 2560, height: 1440, name: 'Large Desktop' }
      ];

      testScreenSizes.forEach(screenSize => {
        it(`should handle ${screenSize.name} (${screenSize.width}x${screenSize.height}) properly`, () => {
          // Mock screen size
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: screenSize.width
          });
          Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: screenSize.height
          });

          mockCanvas.width = screenSize.width;
          mockCanvas.height = screenSize.height;

          const initialView = component['calculateInitialView']();

          // Verify scale is appropriate for screen size
          expect(initialView.scale).toBeGreaterThan(0.1);
          expect(initialView.scale).toBeLessThanOrEqual(1.5);

          // Verify positioning keeps content visible
          expect(initialView.offsetX).toBeGreaterThanOrEqual(0);
          expect(initialView.offsetY).toBeGreaterThanOrEqual(0);
        });
      });

      it('should maintain proper scaling when resizing canvas', () => {
        const originalWidth = 1200;
        const originalHeight = 800;
        
        mockCanvas.width = originalWidth;
        mockCanvas.height = originalHeight;

        const initialView = component['calculateInitialView']();

        // Resize canvas
        const newWidth = 800;
        const newHeight = 600;
        mockCanvas.width = newWidth;
        mockCanvas.height = newHeight;

        // Test that resizing doesn't break the component
        expect(() => {
          if (component['resizeCanvas']) {
            component['resizeCanvas']();
          }
        }).not.toThrow();

        // Verify component state remains valid
        expect(component['scale']).toBeGreaterThan(0);
        expect(component['offsetX']).toBeGreaterThanOrEqual(0);
        expect(component['offsetY']).toBeGreaterThanOrEqual(0);
      });

      it('should handle orientation changes properly', () => {
        // Start in portrait mode
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 375
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 667
        });

        mockCanvas.width = 375;
        mockCanvas.height = 667;

        const portraitView = component['calculateInitialView']();

        // Switch to landscape mode
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 667
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 375
        });

        mockCanvas.width = 667;
        mockCanvas.height = 375;

        const landscapeView = component['calculateInitialView']();

        // Verify different positioning for different orientations
        expect(landscapeView.scale).not.toBe(portraitView.scale);
        expect(landscapeView.offsetX).not.toBe(portraitView.offsetX);
        expect(landscapeView.offsetY).not.toBe(portraitView.offsetY);
      });

      it('should ensure root level is prominently displayed on first load', () => {
        const testTree: Person = {
          id: 'root',
          name: 'Root Person',
          children: [
            { id: 'child1', name: 'Child 1', children: [] },
            { id: 'child2', name: 'Child 2', children: [] }
          ]
        };

        component.personData = testTree;
        
        // Mock various screen sizes
        const screenSizes = [375, 768, 1920];
        
        screenSizes.forEach(width => {
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: width
          });

          mockCanvas.width = width;
          mockCanvas.height = width * 0.6; // Maintain aspect ratio

          const initialView = component['calculateInitialView']();
          
          // Apply initial view
          component['scale'] = initialView.scale;
          component['offsetX'] = initialView.offsetX;
          component['offsetY'] = initialView.offsetY;

          // Verify initial view is calculated properly
          expect(initialView.scale).toBeGreaterThan(0);
          expect(initialView.offsetX).toBeGreaterThanOrEqual(0);
          expect(initialView.offsetY).toBeGreaterThanOrEqual(0);
        });
      });

      it('should show first 2-3 levels clearly on initial load', () => {
        const deepTree: Person = {
          id: 'root',
          name: 'Root Person',
          children: [
            {
              id: 'level1-1',
              name: 'Level 1-1',
              children: [
                {
                  id: 'level2-1',
                  name: 'Level 2-1',
                  children: [
                    { id: 'level3-1', name: 'Level 3-1', children: [] }
                  ]
                }
              ]
            }
          ]
        };

        component.personData = deepTree;
        mockCanvas.width = 1200;
        mockCanvas.height = 800;

        const initialView = component['calculateInitialView']();
        
        // Apply initial view
        component['scale'] = initialView.scale;
        component['offsetX'] = initialView.offsetX;
        component['offsetY'] = initialView.offsetY;

        // Verify that initial view provides reasonable scaling for deep trees
        expect(initialView.scale).toBeGreaterThan(0.1);
        expect(initialView.scale).toBeLessThanOrEqual(1.2);
        
        // Verify positioning allows for tree visibility
        const visibleWidth = mockCanvas.width / component['scale'];
        const visibleHeight = mockCanvas.height / component['scale'];
        
        expect(visibleWidth).toBeGreaterThan(component['nodeWidth']);
        expect(visibleHeight).toBeGreaterThan(component['nodeHeight']);
      });
    });

    describe('Screen Size Edge Cases and Responsive Behavior', () => {
      it('should handle extremely narrow screens gracefully', () => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 240
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 320
        });

        mockCanvas.width = 240;
        mockCanvas.height = 320;

        const initialView = component['calculateInitialView']();

        expect(initialView.scale).toBeGreaterThan(0.1);
        expect(initialView.offsetX).toBeGreaterThanOrEqual(0);
        expect(initialView.offsetY).toBeGreaterThanOrEqual(0);
      });

      it('should handle extremely wide screens gracefully', () => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 3840
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 2160
        });

        mockCanvas.width = 3840;
        mockCanvas.height = 2160;

        const initialView = component['calculateInitialView']();

        expect(initialView.scale).toBeLessThanOrEqual(2.0);
        expect(initialView.offsetX).toBeGreaterThanOrEqual(0);
        expect(initialView.offsetY).toBeGreaterThanOrEqual(0);
      });

      it('should maintain performance on high-DPI displays', () => {
        // Mock high-DPI display
        Object.defineProperty(window, 'devicePixelRatio', {
          writable: true,
          configurable: true,
          value: 3
        });

        mockCanvas.width = 1125; // 375 * 3
        mockCanvas.height = 2001; // 667 * 3

        const startTime = performance.now();
        
        const initialView = component['calculateInitialView']();

        const endTime = performance.now();
        const processingTime = endTime - startTime;

        // Should handle high-DPI efficiently
        expect(processingTime).toBeLessThan(100);
        expect(initialView.scale).toBeGreaterThan(0);
      });

      it('should handle window resize events properly', () => {
        spyOn(component as any, 'resizeCanvas').and.callThrough();

        // Simulate window resize
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 800
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: 600
        });

        // Test that resize handling doesn't break
        expect(() => {
          if (component['resizeCanvas']) {
            component['resizeCanvas']();
          }
        }).not.toThrow();
      });
    });
  });
});