import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

import { CanvasTreeComponent } from './canvas-tree.component';

describe('CanvasTreeComponent', () => {
  let component: CanvasTreeComponent;
  let fixture: ComponentFixture<CanvasTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CanvasTreeComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CanvasTreeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('calculateAdaptiveSpacing', () => {
    beforeEach(() => {
      // Mock canvas element and context
      const mockCanvas = document.createElement('canvas');
      mockCanvas.width = 1200;
      mockCanvas.height = 800;
      
      // Set up the canvas reference
      Object.defineProperty(component, 'canvasRef', {
        value: { nativeElement: mockCanvas },
        writable: true
      });
      
      // Initialize scale to 1 for predictable calculations
      (component as any).scale = 1;
    });

    it('should return default horizontal spacing when adaptive spacing is disabled', () => {
      // Disable adaptive spacing
      (component as any).adaptiveSpacing = false;
      
      const spacing = (component as any).calculateAdaptiveSpacing(1, 5);
      
      expect(spacing).toBe(50); // Default horizontalSpacing value
    });

    it('should return default spacing for single node', () => {
      const spacing = (component as any).calculateAdaptiveSpacing(1, 1);
      
      expect(spacing).toBe(50); // Default horizontalSpacing value
    });

    it('should calculate spacing based on available canvas width', () => {
      // Test with fewer nodes to ensure we don't hit minimum constraint
      const nodeCount = 2;
      const level = 0; // Root level, no adjustment
      
      const spacing = (component as any).calculateAdaptiveSpacing(level, nodeCount);
      
      // With canvas width 1200, node width 180, and 2 nodes:
      // Available width = 1200, total node width = 2 * 180 = 360
      // Available spacing width = 1200 - 360 = 840
      // Base spacing = 840 / 1 = 840 (1 spacing slot between 2 nodes)
      // Level adjustment factor = 1 - (0 * 0.1) = 1.0
      // Expected spacing = 840 * 1.0 = 840, but capped at maxHorizontalSpacing (80)
      
      expect(spacing).toBe(80); // Should be capped at maxHorizontalSpacing
    });

    it('should apply level-based adjustments for deeper levels', () => {
      // Test that level adjustments are applied correctly
      // Even if they hit constraints, the algorithm should be working
      const nodeCount = 4;
      
      // Test different levels
      const level0Spacing = (component as any).calculateAdaptiveSpacing(0, nodeCount);
      const level2Spacing = (component as any).calculateAdaptiveSpacing(2, nodeCount);
      const level5Spacing = (component as any).calculateAdaptiveSpacing(5, nodeCount);
      
      // All should be within valid bounds
      expect(level0Spacing).toBeGreaterThanOrEqual(30);
      expect(level0Spacing).toBeLessThanOrEqual(80);
      expect(level2Spacing).toBeGreaterThanOrEqual(30);
      expect(level2Spacing).toBeLessThanOrEqual(80);
      expect(level5Spacing).toBeGreaterThanOrEqual(30);
      expect(level5Spacing).toBeLessThanOrEqual(80);
      
      // Deeper levels should have tighter or equal spacing (due to constraints)
      expect(level2Spacing).toBeLessThanOrEqual(level0Spacing);
      expect(level5Spacing).toBeLessThanOrEqual(level2Spacing);
    });

    it('should respect minimum spacing constraints', () => {
      // Test with many nodes to force tight spacing
      const nodeCount = 20;
      const level = 3;
      
      const spacing = (component as any).calculateAdaptiveSpacing(level, nodeCount);
      
      // Should never go below minHorizontalSpacing (30)
      expect(spacing).toBeGreaterThanOrEqual(30);
    });

    it('should respect maximum spacing constraints', () => {
      // Test with very few nodes and large canvas
      const nodeCount = 2;
      const level = 0;
      
      const spacing = (component as any).calculateAdaptiveSpacing(level, nodeCount);
      
      // Should never exceed maxHorizontalSpacing (80)
      expect(spacing).toBeLessThanOrEqual(80);
    });

    it('should store level-specific spacing in layoutConfig', () => {
      const nodeCount = 3;
      const level = 2;
      
      const spacing = (component as any).calculateAdaptiveSpacing(level, nodeCount);
      
      // Check that the spacing was stored in layoutConfig
      const storedSpacing = (component as any).layoutConfig.levelBasedSpacing.get(level);
      expect(storedSpacing).toBe(spacing);
    });

    it('should handle various tree configurations correctly', () => {
      // Test configuration 1: Wide tree (many nodes at same level)
      const wideTreeSpacing = (component as any).calculateAdaptiveSpacing(1, 8);
      
      // Test configuration 2: Deep tree (fewer nodes but deeper level)
      const deepTreeSpacing = (component as any).calculateAdaptiveSpacing(6, 5);
      
      // Test configuration 3: Balanced tree
      const balancedTreeSpacing = (component as any).calculateAdaptiveSpacing(3, 4);
      
      // All should be within valid range
      expect(wideTreeSpacing).toBeGreaterThanOrEqual(30);
      expect(wideTreeSpacing).toBeLessThanOrEqual(80);
      
      expect(deepTreeSpacing).toBeGreaterThanOrEqual(30);
      expect(deepTreeSpacing).toBeLessThanOrEqual(80);
      
      expect(balancedTreeSpacing).toBeGreaterThanOrEqual(30);
      expect(balancedTreeSpacing).toBeLessThanOrEqual(80);
      
      // Deep tree should have tighter spacing than shallow tree with same node count
      const shallowTreeSpacing = (component as any).calculateAdaptiveSpacing(1, 5);
      expect(deepTreeSpacing).toBeLessThan(shallowTreeSpacing);
    });

    it('should handle edge case with zero available spacing width', () => {
      // Mock a very narrow canvas
      const mockCanvas = document.createElement('canvas');
      mockCanvas.width = 200; // Very narrow
      mockCanvas.height = 800;
      
      Object.defineProperty(component, 'canvasRef', {
        value: { nativeElement: mockCanvas },
        writable: true
      });
      
      const spacing = (component as any).calculateAdaptiveSpacing(1, 5);
      
      // Should still return minimum spacing
      expect(spacing).toBe(30); // minHorizontalSpacing
    });

    it('should handle different scale values correctly', () => {
      // Test with different scale values
      (component as any).scale = 0.5;
      
      const spacingScaled = (component as any).calculateAdaptiveSpacing(1, 4);
      
      // Reset scale
      (component as any).scale = 1;
      const spacingNormal = (component as any).calculateAdaptiveSpacing(1, 4);
      
      // With smaller scale, available width is effectively larger, so spacing might be different
      // Both should still be within valid bounds
      expect(spacingScaled).toBeGreaterThanOrEqual(30);
      expect(spacingScaled).toBeLessThanOrEqual(80);
      expect(spacingNormal).toBeGreaterThanOrEqual(30);
      expect(spacingNormal).toBeLessThanOrEqual(80);
    });
  });
});
