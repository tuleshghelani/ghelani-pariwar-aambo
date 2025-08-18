import { Component, ElementRef, Input, OnInit, ViewChild, AfterViewInit, HostListener, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Person } from '../../models/person.model';

// Enhanced layout configuration interface
interface EnhancedLayoutConfig {
  minHorizontalSpacing: number;
  maxHorizontalSpacing: number;
  verticalSpacing: number;
  nodeWidth: number;
  nodeHeight: number;
  adaptiveSpacing: boolean;
  connectionLineBuffer: number;
  levelBasedSpacing: Map<number, number>;
}

// Node bounding box interface for overlap detection
interface NodeBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
  nodeId: string;
}

// Node layout interface for positioning calculations
interface NodeLayout {
  x: number;
  y: number;
  level: number;
  siblingIndex: number;
  totalSiblings: number;
  effectiveWidth: number;
  person: Person;
}

@Component({
  selector: 'app-canvas-tree',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './canvas-tree.component.html',
  styleUrl: './canvas-tree.component.scss'
})
export class CanvasTreeComponent implements OnInit, AfterViewInit {
  @ViewChild('treeCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() personData: Person | null = null;
  
  private ctx!: CanvasRenderingContext2D;
  private scale: number = 1;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private isDragging: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;
  private isBrowser: boolean = false;
  
  // Node styling
  private readonly nodeWidth: number = 180;
  private readonly nodeHeight: number = 60;
  private readonly horizontalSpacing: number = 50;
  private readonly verticalSpacing: number = 80;
  private readonly cornerRadius: number = 8;
  
  // Adaptive spacing properties for dynamic spacing configuration
  private readonly minHorizontalSpacing: number = 30;
  private readonly maxHorizontalSpacing: number = 80;
  private readonly adaptiveSpacing: boolean = true;
  private readonly connectionLineBuffer: number = 10;
  private levelNodeCounts: Map<number, number> = new Map();
  
  // Enhanced layout configuration
  private layoutConfig: EnhancedLayoutConfig = {
    minHorizontalSpacing: this.minHorizontalSpacing,
    maxHorizontalSpacing: this.maxHorizontalSpacing,
    verticalSpacing: this.verticalSpacing,
    nodeWidth: this.nodeWidth,
    nodeHeight: this.nodeHeight,
    adaptiveSpacing: this.adaptiveSpacing,
    connectionLineBuffer: this.connectionLineBuffer,
    levelBasedSpacing: new Map<number, number>()
  };

  // Performance optimization properties for large tree structures
  private readonly maxRenderLevels: number = 15; // Limit rendering for very deep trees
  private readonly performanceThreshold: number = 100; // Node count threshold for performance optimizations
  private renderCache: Map<string, { x: number; y: number; width: number }> = new Map();
  private lastTreeHash: string = '';
  private isLargeTree: boolean = false;
  
  // Overlap detection properties
  private nodeBoundingBoxes: Map<string, NodeBoundingBox> = new Map();
  private readonly overlapBuffer: number = 5; // Minimum buffer between nodes to prevent visual overlap
  
  // Colors
  private readonly rootNodeColor: string = '#f5f7fa';
  private readonly nodeColor: string = '#ffffff';
  private readonly lineColor: string = '#007bff';
  private readonly textColor: string = '#343a40';
  private readonly idColor: string = '#007bff';
  
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
  
  ngOnInit(): void {}
  
  ngAfterViewInit(): void {
    if (!this.isBrowser) return; // Skip canvas operations on server
    
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    
    // Set initial canvas size
    this.resizeCanvas();
    
    // Set initial cursor style for desktop (not needed for mobile)
    if (window.innerWidth > 768) {
      canvas.style.cursor = 'grab';
    }
    
    // Enhanced mobile-first initialization
    const isMobile = window.innerWidth <= 768;
    
    // Add a small delay to ensure the canvas is properly sized before drawing
    setTimeout(() => {
      // Draw the tree when data is available
      if (this.personData) {
        // Apply mobile-optimized initial positioning
        if (isMobile) {
          this.optimizeMobileInitialView();
        }
        this.drawTree();
      }
    }, isMobile ? 150 : 100); // Slightly longer delay for mobile to ensure proper initialization
  }
  
  /**
   * Optimize initial view specifically for mobile devices
   * Ensures the root level is prominently displayed and properly centered
   */
  private optimizeMobileInitialView(): void {
    if (!this.isBrowser || window.innerWidth > 768) return;
    
    const canvas = this.canvasRef.nativeElement;
    const initialView = this.calculateInitialView();
    
    // Apply mobile-optimized initial settings
    this.scale = initialView.scale;
    this.offsetX = initialView.offsetX;
    this.offsetY = initialView.offsetY;
    
    // Additional mobile-specific adjustments
    const screenWidth = window.innerWidth;
    
    // For very small screens, ensure even better root visibility
    if (screenWidth <= 480) {
      this.offsetY = Math.max(this.offsetY, canvas.height * 0.01);
    }
    
    // Ensure the view is within mobile-friendly bounds
    this.ensureMobileViewBounds();
  }
  
  // Zoom control methods
  zoomIn(): void {
    if (!this.isBrowser) return;
    this.scale *= 1.2;
    this.drawTree();
  }
  
  zoomOut(): void {
    if (!this.isBrowser) return;
    this.scale *= 0.8;
    if (this.scale < 0.2) this.scale = 0.2; // Prevent zooming out too far
    this.drawTree();
  }
  
  resetView(): void {
    if (!this.isBrowser) return;
    
    // Use device-specific initial view settings for reset
    const initialView = this.calculateInitialView();
    this.scale = initialView.scale;
    this.offsetX = initialView.offsetX;
    this.offsetY = initialView.offsetY;
    
    this.drawTree();
  }
  
  @HostListener('window:resize')
  onResize(): void {
    if (!this.isBrowser) return;
    this.resizeCanvas();
    this.drawTree();
  }
  
  @HostListener('wheel', ['$event'])
  onMouseWheel(event: WheelEvent): void {
    if (!this.isBrowser) return;
    event.preventDefault();
    
    // Get mouse position relative to canvas
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Calculate zoom direction and factor
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    
    // Calculate new scale
    const newScale = this.scale * zoomFactor;
    
    // Limit zoom level
    if (newScale > 0.2 && newScale < 5) {
      // Calculate mouse position in world space before zoom
      const worldX = (mouseX - this.offsetX) / this.scale;
      const worldY = (mouseY - this.offsetY) / this.scale;
      
      // Update scale
      this.scale = newScale;
      
      // Calculate new offset to zoom at mouse position
      this.offsetX = mouseX - worldX * this.scale;
      this.offsetY = mouseY - worldY * this.scale;
      
      // Redraw with new scale
      this.drawTree();
    }
  }
  
  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (!this.isBrowser) return;
    this.isDragging = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.canvasRef.nativeElement.style.cursor = 'grabbing';
  }
  
  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isBrowser) return;
    if (this.isDragging) {
      const deltaX = event.clientX - this.lastX;
      const deltaY = event.clientY - this.lastY;
      
      this.offsetX += deltaX;
      this.offsetY += deltaY;
      
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      
      this.drawTree();
    }
  }
  
  @HostListener('mouseup')
  @HostListener('mouseleave')
  onMouseUp(): void {
    if (!this.isBrowser) return;
    this.isDragging = false;
    this.canvasRef.nativeElement.style.cursor = 'grab';
  }
  
  // Enhanced touch event handlers for mobile devices with improved responsiveness
  private lastTouchDistance: number = 0;
  private touchStartTime: number = 0;
  private initialTouchDistance: number = 0;
  private touchMoveThreshold: number = 10; // Minimum movement to start panning
  private hasMoved: boolean = false;
  private zoomSensitivity: number = 0.8; // Reduced for more controlled zooming
  private panSensitivity: number = 1.2; // Enhanced for smoother panning
  private lastTouchCenter: { x: number, y: number } = { x: 0, y: 0 };
  
  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    if (!this.isBrowser) return;
    event.preventDefault();
    
    this.touchStartTime = Date.now();
    this.hasMoved = false;
    
    if (event.touches.length === 1) {
      // Single touch - prepare for panning with improved sensitivity
      const touch = event.touches[0];
      this.lastX = touch.clientX;
      this.lastY = touch.clientY;
      
      // Don't immediately set dragging to true - wait for movement threshold
      this.isDragging = false;
    } else if (event.touches.length === 2) {
      // Two touches - enhanced pinch to zoom setup
      this.isDragging = false;
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      // Calculate initial distance and center point for more accurate zooming
      this.lastTouchDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      this.initialTouchDistance = this.lastTouchDistance;
      
      // Store initial touch center for consistent zoom behavior
      this.lastTouchCenter = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
    }
  }
  
  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (!this.isBrowser) return;
    event.preventDefault();
    
    if (event.touches.length === 1) {
      // Enhanced single touch panning with improved sensitivity
      const touch = event.touches[0];
      const deltaX = touch.clientX - this.lastX;
      const deltaY = touch.clientY - this.lastY;
      
      // Check if movement exceeds threshold before starting to pan
      const movementDistance = Math.hypot(deltaX, deltaY);
      
      if (!this.hasMoved && movementDistance > this.touchMoveThreshold) {
        this.isDragging = true;
        this.hasMoved = true;
      }
      
      if (this.isDragging && this.hasMoved) {
        // Apply enhanced pan sensitivity for smoother mobile interaction
        this.offsetX += deltaX * this.panSensitivity;
        this.offsetY += deltaY * this.panSensitivity;
        
        this.lastX = touch.clientX;
        this.lastY = touch.clientY;
        
        // Use requestAnimationFrame for smoother rendering on mobile
        requestAnimationFrame(() => this.drawTree());
      }
    } else if (event.touches.length === 2) {
      // Enhanced two-finger pinch to zoom with improved accuracy
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      // Calculate current distance and center
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      const currentCenter = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
      
      if (this.lastTouchDistance > 0 && this.initialTouchDistance > 0) {
        // Calculate zoom factor with improved sensitivity for mobile devices
        const rawZoomFactor = currentDistance / this.lastTouchDistance;
        
        // Apply zoom sensitivity adjustment for more controlled zooming
        const adjustedZoomFactor = 1 + (rawZoomFactor - 1) * this.zoomSensitivity;
        
        // Calculate new scale with mobile-optimized limits
        const newScale = this.scale * adjustedZoomFactor;
        const minScale = 0.15; // Allow more zoom out on mobile
        const maxScale = 4.0;   // Reasonable max zoom for mobile
        
        if (newScale >= minScale && newScale <= maxScale) {
          // Get canvas position for accurate zoom center calculation
          const rect = this.canvasRef.nativeElement.getBoundingClientRect();
          
          // Use current touch center for zoom point
          const canvasCenterX = currentCenter.x - rect.left;
          const canvasCenterY = currentCenter.y - rect.top;
          
          // Calculate world position before zoom for accurate zoom-to-point
          const worldX = (canvasCenterX - this.offsetX) / this.scale;
          const worldY = (canvasCenterY - this.offsetY) / this.scale;
          
          // Update scale
          this.scale = newScale;
          
          // Update offset to zoom at the touch center point
          this.offsetX = canvasCenterX - worldX * this.scale;
          this.offsetY = canvasCenterY - worldY * this.scale;
          
          // Use requestAnimationFrame for smoother zoom rendering
          requestAnimationFrame(() => this.drawTree());
        }
      }
      
      // Update tracking variables
      this.lastTouchDistance = currentDistance;
      this.lastTouchCenter = currentCenter;
    }
  }
  
  @HostListener('touchend', ['$event'])
  @HostListener('touchcancel', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    if (!this.isBrowser) return;
    
    // Handle tap gestures for mobile interaction
    const touchDuration = Date.now() - this.touchStartTime;
    const wasTap = !this.hasMoved && touchDuration < 300; // Quick tap detection
    
    if (wasTap && event.touches.length === 0) {
      // Handle tap gesture - could be used for node selection in future
      // For now, just ensure the view is properly centered if needed
      this.ensureMobileViewBounds();
    }
    
    // Reset touch interaction state
    this.isDragging = false;
    this.lastTouchDistance = 0;
    this.initialTouchDistance = 0;
    this.hasMoved = false;
    this.touchStartTime = 0;
    this.lastTouchCenter = { x: 0, y: 0 };
  }
  
  /**
   * Ensure the view stays within reasonable bounds for mobile devices
   * Prevents users from getting lost by panning too far off-screen
   */
  private ensureMobileViewBounds(): void {
    if (!this.isBrowser || window.innerWidth > 768) return;
    
    const canvas = this.canvasRef.nativeElement;
    const maxOffsetX = canvas.width * 0.5;
    const maxOffsetY = canvas.height * 0.5;
    const minOffsetX = -canvas.width * 0.5;
    const minOffsetY = -canvas.height * 0.5;
    
    // Gently constrain the view to prevent getting completely lost
    let needsRedraw = false;
    
    if (this.offsetX > maxOffsetX) {
      this.offsetX = maxOffsetX;
      needsRedraw = true;
    } else if (this.offsetX < minOffsetX) {
      this.offsetX = minOffsetX;
      needsRedraw = true;
    }
    
    if (this.offsetY > maxOffsetY) {
      this.offsetY = maxOffsetY;
      needsRedraw = true;
    } else if (this.offsetY < minOffsetY) {
      this.offsetY = minOffsetY;
      needsRedraw = true;
    }
    
    if (needsRedraw) {
      this.drawTree();
    }
  }
  
  /**
   * Calculate device-specific initial view settings with enhanced mobile positioning
   * Determines optimal scale and positioning for mobile (≤768px), tablet (769-1024px), and desktop
   * Includes better initial positioning when component first loads on mobile
   * @returns Object containing scale, offsetX, and offsetY values
   */
  private calculateInitialView(): { scale: number, offsetX: number, offsetY: number } {
    if (!this.isBrowser) {
      return { scale: 1, offsetX: 0, offsetY: 0 };
    }

    const canvas = this.canvasRef.nativeElement;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Enhanced device-specific initial scale and positioning logic
    if (screenWidth <= 768) {
      // Mobile devices (≤768px): Enhanced mobile-first positioning
      const isPortrait = screenHeight > screenWidth;
      
      // Adjust scale based on orientation and screen size
      let mobileScale = 0.35;
      if (screenWidth <= 480) {
        // Very small mobile screens
        mobileScale = 0.25;
      } else if (screenWidth <= 600) {
        // Medium mobile screens
        mobileScale = 0.3;
      }
      
      // Enhanced positioning for mobile - ensure root is prominently displayed
      const offsetXFactor = isPortrait ? 0.05 : 0.08;
      const offsetYFactor = isPortrait ? 0.02 : 0.05;
      
      return {
        scale: mobileScale,
        offsetX: canvasWidth * offsetXFactor,
        offsetY: canvasHeight * offsetYFactor
      };
    } else if (screenWidth > 768 && screenWidth <= 1024) {
      // Tablet devices (769-1024px): Improved tablet positioning
      const isLandscape = screenWidth > screenHeight;
      
      return {
        scale: isLandscape ? 0.65 : 0.55,
        offsetX: canvasWidth * (isLandscape ? 0.18 : 0.12),
        offsetY: canvasHeight * (isLandscape ? 0.12 : 0.08)
      };
    } else {
      // Desktop devices (>1024px): Optimized desktop positioning
      return {
        scale: 0.8,
        offsetX: canvasWidth * 0.2,
        offsetY: canvasHeight * 0.15
      };
    }
  }

  private resizeCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement;
    
    if (container) {
      // Set canvas dimensions to match container
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      // Performance optimization: Clear render cache on resize for large trees
      if (this.isLargeTree) {
        this.clearRenderCache();
      }
      
      // Enhanced initial positioning logic with better mobile support
      const initialView = this.calculateInitialView();
      
      // Check if this is initial load or significant resize that requires repositioning
      const isInitialLoad = Math.abs(this.scale - 1) < 0.1 && 
                           Math.abs(this.offsetX) < 10 && 
                           Math.abs(this.offsetY) < 10;
      
      // For mobile devices, also reset view on orientation changes
      const isMobile = window.innerWidth <= 768;
      const orientationChanged = isMobile && (
        (window.innerWidth > window.innerHeight && this.scale < 0.4) ||
        (window.innerHeight > window.innerWidth && this.scale > 0.6)
      );
      
      if (isInitialLoad || orientationChanged) {
        this.scale = initialView.scale;
        this.offsetX = initialView.offsetX;
        this.offsetY = initialView.offsetY;
        
        // For mobile devices, ensure the view is properly bounded after resize
        if (isMobile) {
          setTimeout(() => this.ensureMobileViewBounds(), 100);
        }
      }
    }
  }
  
  /**
   * Detect potential node overlaps at any tree level
   * Implements bounding box collision detection for nodes
   * @param nodeBoundingBoxes - Map of node bounding boxes to check for overlaps
   * @returns Array of overlapping node pairs with their overlap details
   */
  private detectNodeOverlaps(nodeBoundingBoxes: Map<string, NodeBoundingBox>): Array<{
    node1: NodeBoundingBox;
    node2: NodeBoundingBox;
    overlapArea: number;
    level: number;
  }> {
    const overlaps: Array<{
      node1: NodeBoundingBox;
      node2: NodeBoundingBox;
      overlapArea: number;
      level: number;
    }> = [];

    const boundingBoxArray = Array.from(nodeBoundingBoxes.values());

    // Check each pair of nodes for overlaps
    for (let i = 0; i < boundingBoxArray.length; i++) {
      for (let j = i + 1; j < boundingBoxArray.length; j++) {
        const node1 = boundingBoxArray[i];
        const node2 = boundingBoxArray[j];

        // Only check nodes at the same level for overlaps
        if (node1.level === node2.level) {
          const overlap = this.calculateBoundingBoxOverlap(node1, node2);
          if (overlap.hasOverlap) {
            overlaps.push({
              node1,
              node2,
              overlapArea: overlap.area,
              level: node1.level
            });
          }
        }
      }
    }

    return overlaps;
  }

  /**
   * Calculate bounding box collision detection between two nodes
   * Includes buffer zone to prevent visual overlap
   * @param box1 - First node's bounding box
   * @param box2 - Second node's bounding box
   * @returns Overlap information including whether overlap exists and area
   */
  private calculateBoundingBoxOverlap(
    box1: NodeBoundingBox, 
    box2: NodeBoundingBox
  ): { hasOverlap: boolean; area: number; overlapRect?: { x: number; y: number; width: number; height: number } } {
    // Add buffer to bounding boxes to prevent visual overlap
    const bufferedBox1 = {
      x: box1.x - this.overlapBuffer,
      y: box1.y - this.overlapBuffer,
      width: box1.width + (this.overlapBuffer * 2),
      height: box1.height + (this.overlapBuffer * 2)
    };

    const bufferedBox2 = {
      x: box2.x - this.overlapBuffer,
      y: box2.y - this.overlapBuffer,
      width: box2.width + (this.overlapBuffer * 2),
      height: box2.height + (this.overlapBuffer * 2)
    };

    // Calculate overlap rectangle
    const overlapLeft = Math.max(bufferedBox1.x, bufferedBox2.x);
    const overlapTop = Math.max(bufferedBox1.y, bufferedBox2.y);
    const overlapRight = Math.min(
      bufferedBox1.x + bufferedBox1.width,
      bufferedBox2.x + bufferedBox2.width
    );
    const overlapBottom = Math.min(
      bufferedBox1.y + bufferedBox1.height,
      bufferedBox2.y + bufferedBox2.height
    );

    // Check if there's actual overlap
    const hasOverlap = overlapLeft < overlapRight && overlapTop < overlapBottom;

    if (hasOverlap) {
      const overlapWidth = overlapRight - overlapLeft;
      const overlapHeight = overlapBottom - overlapTop;
      const area = overlapWidth * overlapHeight;

      return {
        hasOverlap: true,
        area,
        overlapRect: {
          x: overlapLeft,
          y: overlapTop,
          width: overlapWidth,
          height: overlapHeight
        }
      };
    }

    return { hasOverlap: false, area: 0 };
  }

  /**
   * Adjust node positioning when overlaps are detected
   * Redistributes nodes at affected levels to prevent overlapping
   * @param overlaps - Array of detected overlaps
   * @param treeDimensions - Current tree dimensions
   * @returns Updated node positions and spacing adjustments
   */
  private adjustPositioningForOverlaps(
    overlaps: Array<{
      node1: NodeBoundingBox;
      node2: NodeBoundingBox;
      overlapArea: number;
      level: number;
    }>,
    treeDimensions: { width: number; height: number; levelWidths: Map<number, number> }
  ): { adjustedSpacing: Map<number, number>; repositionRequired: boolean } {
    const adjustedSpacing = new Map<number, number>();
    let repositionRequired = false;

    if (overlaps.length === 0) {
      return { adjustedSpacing, repositionRequired };
    }

    // Group overlaps by level
    const overlapsByLevel = new Map<number, Array<{
      node1: NodeBoundingBox;
      node2: NodeBoundingBox;
      overlapArea: number;
      level: number;
    }>>();

    overlaps.forEach(overlap => {
      if (!overlapsByLevel.has(overlap.level)) {
        overlapsByLevel.set(overlap.level, []);
      }
      overlapsByLevel.get(overlap.level)!.push(overlap);
    });

    // Process each level with overlaps
    overlapsByLevel.forEach((levelOverlaps, level) => {
      const nodeCount = this.levelNodeCounts.get(level) || 1;
      const currentSpacing = this.layoutConfig.levelBasedSpacing.get(level) || this.horizontalSpacing;

      // Calculate required spacing increase to resolve overlaps
      let maxOverlapWidth = 0;
      levelOverlaps.forEach(overlap => {
        // Calculate overlap width from the bounding boxes
        const box1 = overlap.node1;
        const box2 = overlap.node2;
        const overlapLeft = Math.max(box1.x, box2.x);
        const overlapRight = Math.min(box1.x + box1.width, box2.x + box2.width);
        const overlapWidth = Math.max(0, overlapRight - overlapLeft);
        maxOverlapWidth = Math.max(maxOverlapWidth, overlapWidth);
      });

      // Calculate new spacing needed to prevent overlaps
      const spacingIncrease = Math.ceil(maxOverlapWidth / (nodeCount - 1)) + this.overlapBuffer;
      const newSpacing = Math.max(
        currentSpacing + spacingIncrease,
        this.minHorizontalSpacing
      );

      // Ensure new spacing doesn't exceed maximum bounds
      const finalSpacing = Math.min(newSpacing, this.maxHorizontalSpacing);

      // If spacing needs to be increased beyond maximum, we need repositioning
      if (newSpacing > this.maxHorizontalSpacing) {
        repositionRequired = true;
        
        // Use maximum spacing and flag for alternative layout strategy
        adjustedSpacing.set(level, this.maxHorizontalSpacing);
      } else {
        adjustedSpacing.set(level, finalSpacing);
      }
    });

    return { adjustedSpacing, repositionRequired };
  }

  /**
   * Update node bounding boxes during tree rendering
   * Maintains accurate bounding box information for overlap detection
   * @param nodeId - Unique identifier for the node
   * @param x - Node X position
   * @param y - Node Y position
   * @param level - Tree level of the node
   */
  private updateNodeBoundingBox(nodeId: string, x: number, y: number, level: number): void {
    this.nodeBoundingBoxes.set(nodeId, {
      x,
      y,
      width: this.nodeWidth,
      height: this.nodeHeight,
      level,
      nodeId
    });
  }

  /**
   * Clear all node bounding boxes
   * Called before each tree redraw to reset overlap detection state
   */
  private clearNodeBoundingBoxes(): void {
    this.nodeBoundingBoxes.clear();
  }

  /**
   * Clear render cache for performance optimization
   * Called when tree structure changes or memory optimization is needed
   */
  private clearRenderCache(): void {
    this.renderCache.clear();
  }

  /**
   * Performance optimization: Limit rendering depth for very large trees
   * Determines if a level should be rendered based on performance considerations
   * @param level - Current tree level
   * @param totalLevels - Total levels in the tree
   * @returns Whether the level should be rendered
   */
  private shouldRenderLevel(level: number, totalLevels: number): boolean {
    // Always render first few levels
    if (level <= 3) return true;
    
    // For large trees, limit rendering depth
    if (this.isLargeTree && level > this.maxRenderLevels) {
      return false;
    }
    
    // For very deep trees, consider current zoom level
    if (totalLevels > 10 && this.scale < 0.3 && level > 8) {
      return false;
    }
    
    return true;
  }

  private drawTree(): void {
    if (!this.isBrowser || !this.ctx || !this.personData) return;
    
    const canvas = this.canvasRef.nativeElement;
    const isMobile = window.innerWidth <= 768;
    
    // Performance optimization: Check if tree structure has changed
    const currentTreeHash = this.calculateTreeHash(this.personData);
    const treeStructureChanged = currentTreeHash !== this.lastTreeHash;
    
    // Clear canvas with performance-optimized clearing
    if (this.isLargeTree) {
      // For large trees, use more efficient clearing method
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.ctx.restore();
    } else {
      // Standard clearing for smaller trees
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // Clear node bounding boxes for fresh overlap detection
    this.clearNodeBoundingBoxes();
    
    // Performance optimization: Clear render cache if tree structure changed
    if (treeStructureChanged) {
      this.renderCache.clear();
    }
    
    // Save current state
    this.ctx.save();
    
    // Apply transformations
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);
    
    // Calculate tree dimensions
    const treeDimensions = this.calculateTreeDimensions(this.personData);
    
    // Enhanced mobile-aware tree centering
    let startX = (canvas.width / this.scale - treeDimensions.width) / 2;
    
    // For mobile devices, adjust horizontal positioning to ensure root visibility
    if (isMobile) {
      const mobileAdjustment = Math.min(50, canvas.width / this.scale * 0.05);
      startX = Math.max(mobileAdjustment, startX);
    }
    
    // Apply initial view settings if this is the first draw
    const isInitialDraw = Math.abs(this.offsetX) < 10 && Math.abs(this.offsetY) < 10 && Math.abs(this.scale - 1) < 0.1;
    if (isInitialDraw) {
      const initialView = this.calculateInitialView();
      this.scale = initialView.scale;
      this.offsetX = initialView.offsetX;
      this.offsetY = initialView.offsetY;
      
      // Reapply transformations with new values
      this.ctx.restore();
      this.ctx.save();
      this.ctx.translate(this.offsetX, this.offsetY);
      this.ctx.scale(this.scale, this.scale);
      
      // Recalculate startX with new scale
      startX = (canvas.width / this.scale - treeDimensions.width) / 2;
      if (isMobile) {
        const mobileAdjustment = Math.min(50, canvas.width / this.scale * 0.05);
        startX = Math.max(mobileAdjustment, startX);
      }
    }
    
    // Mobile-specific rendering optimizations
    if (isMobile) {
      // Optimize canvas rendering for mobile performance
      this.ctx.imageSmoothingEnabled = this.scale > 0.5;
    }
    
    // Draw from root node and collect bounding boxes
    this.drawNode(this.personData, startX, 50, 0, treeDimensions);
    
    // Perform overlap detection after initial rendering
    const overlaps = this.detectNodeOverlaps(this.nodeBoundingBoxes);
    
    // If overlaps are detected, adjust positioning and redraw if necessary
    if (overlaps.length > 0) {
      const adjustmentResult = this.adjustPositioningForOverlaps(overlaps, treeDimensions);
      
      if (adjustmentResult.repositionRequired || adjustmentResult.adjustedSpacing.size > 0) {
        // Update layout configuration with adjusted spacing
        adjustmentResult.adjustedSpacing.forEach((spacing, level) => {
          this.layoutConfig.levelBasedSpacing.set(level, spacing);
        });
        
        // Clear and redraw with adjusted spacing if significant overlaps were found
        if (adjustmentResult.repositionRequired) {
          this.ctx.clearRect(0, 0, canvas.width / this.scale, canvas.height / this.scale);
          this.clearNodeBoundingBoxes();
          
          // Recalculate tree dimensions with new spacing
          const adjustedTreeDimensions = this.calculateTreeDimensions(this.personData);
          
          // Recalculate start position
          let adjustedStartX = (canvas.width / this.scale - adjustedTreeDimensions.width) / 2;
          if (isMobile) {
            const mobileAdjustment = Math.min(50, canvas.width / this.scale * 0.05);
            adjustedStartX = Math.max(mobileAdjustment, adjustedStartX);
          }
          
          // Redraw with adjusted positioning
          this.drawNode(this.personData, adjustedStartX, 50, 0, adjustedTreeDimensions);
        }
      }
    }
    
    // Restore state
    this.ctx.restore();
  }
  
  private calculateTreeDimensions(person: Person): { width: number, height: number, levelWidths: Map<number, number> } {
    const levelWidths = new Map<number, number>();
    const levelCounts = new Map<number, number>();
    
    // Reset levelNodeCounts for tracking nodes per level for spacing calculations
    this.levelNodeCounts.clear();
    
    // Performance optimization: Calculate tree hash for caching
    const treeHash = this.calculateTreeHash(person);
    
    // Calculate width needed for each level with depth handling
    const calculateLevelWidths = (node: Person, level: number): void => {
      // Performance optimization: Limit processing for extremely deep trees
      if (level > this.maxRenderLevels) {
        return;
      }
      
      if (!levelCounts.has(level)) {
        levelCounts.set(level, 0);
        levelWidths.set(level, 0);
        this.levelNodeCounts.set(level, 0);
      }
      
      levelCounts.set(level, levelCounts.get(level)! + 1);
      this.levelNodeCounts.set(level, this.levelNodeCounts.get(level)! + 1);
      
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => calculateLevelWidths(child, level + 1));
      }
    };
    
    calculateLevelWidths(person, 0);
    
    // Determine if this is a large tree for performance optimizations
    const totalNodes = Array.from(levelCounts.values()).reduce((sum, count) => sum + count, 0);
    this.isLargeTree = totalNodes > this.performanceThreshold || levelCounts.size > 7;
    
    // Calculate total width and height using enhanced adaptive spacing for variable depths
    let maxWidth = 0;
    let maxLevel = 0;
    
    levelCounts.forEach((count, level) => {
      // Use enhanced adaptive spacing for variable tree depths
      const adaptiveSpacing = this.calculateEnhancedAdaptiveSpacing(level, count, levelCounts.size);
      
      // Calculate level width with enhanced spacing to handle deeper trees efficiently
      const levelWidth = count * this.nodeWidth + (count - 1) * adaptiveSpacing;
      
      // Apply level-specific adjustments for deeper trees (4-10+ levels)
      const depthAdjustedWidth = this.applyDepthSpecificAdjustments(levelWidth, level, levelCounts.size);
      
      // Ensure minimum spacing requirements are met to prevent overlapping
      const minRequiredWidth = count * this.nodeWidth + (count - 1) * this.minHorizontalSpacing;
      const finalLevelWidth = Math.max(depthAdjustedWidth, minRequiredWidth);
      
      levelWidths.set(level, finalLevelWidth);
      maxWidth = Math.max(maxWidth, finalLevelWidth);
      maxLevel = Math.max(maxLevel, level);
    });
    
    // Apply vertical spacing adjustments for deeper trees
    const adjustedVerticalSpacing = this.calculateVerticalSpacingForDepth(levelCounts.size);
    const height = (maxLevel + 1) * (this.nodeHeight + adjustedVerticalSpacing);
    
    // Cache results for performance
    this.lastTreeHash = treeHash;
    
    return { width: maxWidth, height, levelWidths };
  }
  
  private drawNode(person: Person, x: number, y: number, level: number, dimensions: { width: number, levelWidths: Map<number, number> }): number {
    if (!person) return 0;
    
    // Performance optimization: Skip rendering for extremely deep levels in large trees
    if (this.isLargeTree && level > this.maxRenderLevels) {
      return this.nodeWidth;
    }
    
    const isRoot = level === 0;
    // const levelWidth = dimensions.levelWidths.get(level) || 0;
    
    // Performance optimization: Check render cache for large trees
    const cacheKey = `${person.id}-${level}-${Math.round(x)}-${Math.round(y)}`;
    if (this.isLargeTree && this.renderCache.has(cacheKey)) {
      const cached = this.renderCache.get(cacheKey)!;
      // Use cached dimensions but still update bounding box for overlap detection
      this.updateNodeBoundingBox(person.id, cached.x, cached.y, level);
      return cached.width;
    }
    
    // Update bounding box for overlap detection
    this.updateNodeBoundingBox(person.id, x, y, level);
    
    // Draw the node
    this.ctx.fillStyle = isRoot ? this.rootNodeColor : this.nodeColor;
    this.ctx.strokeStyle = isRoot ? this.lineColor : '#e4e7eb';
    this.ctx.lineWidth = 2;
    
    // Draw rounded rectangle
    this.roundRect(x, y, this.nodeWidth, this.nodeHeight, this.cornerRadius);
    
    // Add colored border on left side
    this.ctx.fillStyle = this.lineColor;
    this.ctx.fillRect(x, y, 4, this.nodeHeight);
    
    // Draw text
    this.ctx.fillStyle = this.idColor;
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(person.id, x + this.nodeWidth / 2, y + 20);
    
    this.ctx.fillStyle = this.textColor;
    this.ctx.font = '14px Arial';
    this.ctx.fillText(person.name, x + this.nodeWidth / 2, y + 40);
    
    // If no children, return node width
    if (!person.children || person.children.length === 0) {
      return this.nodeWidth;
    }
    
    // Calculate positions for children
    const nextLevel = level + 1;
    const nextY = y + this.nodeHeight + this.verticalSpacing;
    const childrenCount = person.children.length;
    
    // Use enhanced adaptive spacing for children positioning to handle variable tree depths
    const totalLevels = this.levelNodeCounts.size;
    const adaptiveSpacing = this.calculateEnhancedAdaptiveSpacing(nextLevel, childrenCount, totalLevels);
    const childrenWidth = childrenCount * this.nodeWidth + (childrenCount - 1) * adaptiveSpacing;
    
    // Center children under parent
    let childX = x + (this.nodeWidth - childrenWidth) / 2;
    
    // Calculate child positions for optimized connection rendering
    const parentCenterX = x + this.nodeWidth / 2;
    const parentBottomY = y + this.nodeHeight;
    const connectorY = y + this.nodeHeight + this.verticalSpacing / 2;
    
    // Collect child center positions
    const childPositions: number[] = [];
    let currentChildX = childX;
    
    person.children.forEach(() => {
      childPositions.push(currentChildX + this.nodeWidth / 2);
      currentChildX += this.nodeWidth + adaptiveSpacing;
    });
    
    // Use optimized connection rendering methods
    this.drawOptimizedConnections(
      parentCenterX,
      parentBottomY,
      childPositions,
      connectorY,
      nextY
    );
    
    // Draw children nodes
    let drawChildX = childX;
    person.children.forEach(child => {
      // Draw child node and its children
      const childWidth = this.drawNode(child, drawChildX, nextY, nextLevel, dimensions);
      // Use enhanced adaptive spacing for consistent positioning across variable depths
      drawChildX += childWidth + adaptiveSpacing;
    });
    
    const finalWidth = Math.max(this.nodeWidth, childrenWidth);
    
    // Performance optimization: Cache render results for large trees
    if (this.isLargeTree) {
      const cacheKey = `${person.id}-${level}-${Math.round(x)}-${Math.round(y)}`;
      this.renderCache.set(cacheKey, { x, y, width: finalWidth });
      
      // Limit cache size to prevent memory issues
      if (this.renderCache.size > 500) {
        const firstKey = this.renderCache.keys().next().value;
        this.renderCache.delete(firstKey);
      }
    }
    
    return finalWidth;
  }
  
  /**
   * Calculate optimal horizontal spacing based on tree width and canvas dimensions
   * Adjusts spacing dynamically for different tree depths to prevent overlapping
   * @param level - The current tree level (0 = root)
   * @param nodeCount - Number of nodes at this level
   * @returns Calculated spacing value between nodes
   */
  private calculateAdaptiveSpacing(level: number, nodeCount: number): number {
    if (!this.adaptiveSpacing || nodeCount <= 1) {
      return this.horizontalSpacing;
    }

    const canvas = this.canvasRef.nativeElement;
    const availableWidth = canvas.width / this.scale;
    
    // Calculate total width needed for nodes at this level
    const totalNodeWidth = nodeCount * this.nodeWidth;
    
    // Calculate available space for spacing
    const availableSpacingWidth = availableWidth - totalNodeWidth;
    
    // Calculate base spacing (space between nodes)
    const spacingSlots = Math.max(1, nodeCount - 1);
    let baseSpacing = Math.max(0, availableSpacingWidth / spacingSlots);
    
    // Apply level-based adjustments for deeper trees
    // Deeper levels get progressively tighter spacing to fit more content
    const levelAdjustmentFactor = Math.max(0.5, 1 - (level * 0.1));
    baseSpacing *= levelAdjustmentFactor;
    
    // Ensure spacing stays within configured bounds
    const calculatedSpacing = Math.max(
      this.minHorizontalSpacing,
      Math.min(this.maxHorizontalSpacing, baseSpacing)
    );
    
    // Store level-specific spacing for future reference
    this.layoutConfig.levelBasedSpacing.set(level, calculatedSpacing);
    
    return calculatedSpacing;
  }

  /**
   * Enhanced adaptive spacing calculation for variable tree depths (4-10+ levels)
   * Implements level-specific spacing adjustments for deeper trees with performance optimizations
   * @param level - The current tree level (0 = root)
   * @param nodeCount - Number of nodes at this level
   * @param totalLevels - Total number of levels in the tree
   * @returns Enhanced calculated spacing value optimized for tree depth
   */
  private calculateEnhancedAdaptiveSpacing(level: number, nodeCount: number, totalLevels: number): number {
    if (!this.adaptiveSpacing || nodeCount <= 1) {
      return this.horizontalSpacing;
    }

    const canvas = this.canvasRef.nativeElement;
    const availableWidth = canvas.width / this.scale;
    
    // Calculate total width needed for nodes at this level
    const totalNodeWidth = nodeCount * this.nodeWidth;
    
    // Calculate available space for spacing
    const availableSpacingWidth = availableWidth - totalNodeWidth;
    
    // Calculate base spacing (space between nodes)
    const spacingSlots = Math.max(1, nodeCount - 1);
    let baseSpacing = Math.max(0, availableSpacingWidth / spacingSlots);
    
    // Enhanced level-based adjustments for variable tree depths
    let levelAdjustmentFactor: number;
    
    if (totalLevels <= 4) {
      // Shallow trees (1-4 levels): Standard spacing
      levelAdjustmentFactor = Math.max(0.7, 1 - (level * 0.08));
    } else if (totalLevels <= 7) {
      // Medium depth trees (5-7 levels): Progressive tightening
      levelAdjustmentFactor = Math.max(0.5, 1 - (level * 0.12));
    } else if (totalLevels <= 10) {
      // Deep trees (8-10 levels): Aggressive spacing reduction
      levelAdjustmentFactor = Math.max(0.35, 1 - (level * 0.15));
    } else {
      // Very deep trees (10+ levels): Maximum compression with performance considerations
      levelAdjustmentFactor = Math.max(0.25, 1 - (level * 0.18));
      
      // Performance optimization: Further reduce spacing for extremely deep levels
      if (level > 8) {
        levelAdjustmentFactor *= 0.8;
      }
    }
    
    baseSpacing *= levelAdjustmentFactor;
    
    // Apply performance optimizations for large tree structures
    if (this.isLargeTree) {
      // Reduce spacing more aggressively for large trees to improve performance
      baseSpacing *= 0.85;
      
      // For very deep levels in large trees, use minimum spacing
      if (level > 6) {
        baseSpacing = Math.max(baseSpacing, this.minHorizontalSpacing);
      }
    }
    
    // Ensure spacing stays within configured bounds with depth-aware limits
    const minSpacing = level > 5 ? this.minHorizontalSpacing * 0.8 : this.minHorizontalSpacing;
    const maxSpacing = level > 3 ? this.maxHorizontalSpacing * 0.9 : this.maxHorizontalSpacing;
    
    const calculatedSpacing = Math.max(
      minSpacing,
      Math.min(maxSpacing, baseSpacing)
    );
    
    // Store level-specific spacing for future reference
    this.layoutConfig.levelBasedSpacing.set(level, calculatedSpacing);
    
    return calculatedSpacing;
  }

  /**
   * Apply depth-specific adjustments for level width calculations
   * Handles trees with 4-10+ levels efficiently by adjusting layout based on total depth
   * @param levelWidth - Base level width calculation
   * @param level - Current level being processed
   * @param totalLevels - Total number of levels in the tree
   * @returns Adjusted level width optimized for tree depth
   */
  private applyDepthSpecificAdjustments(levelWidth: number, level: number, totalLevels: number): number {
    let adjustedWidth = levelWidth;
    
    // Apply compression for deeper trees to fit more content efficiently
    if (totalLevels > 7) {
      // For deep trees, apply progressive compression
      const compressionFactor = Math.max(0.85, 1 - ((totalLevels - 7) * 0.03));
      adjustedWidth *= compressionFactor;
      
      // Additional compression for deeper levels within deep trees
      if (level > 4) {
        const deepLevelCompression = Math.max(0.9, 1 - ((level - 4) * 0.02));
        adjustedWidth *= deepLevelCompression;
      }
    }
    
    // Performance optimization: Limit width expansion for very wide levels in deep trees
    if (totalLevels > 5 && level > 2) {
      const canvas = this.canvasRef.nativeElement;
      const maxAllowedWidth = (canvas.width / this.scale) * 0.95;
      adjustedWidth = Math.min(adjustedWidth, maxAllowedWidth);
    }
    
    return adjustedWidth;
  }

  /**
   * Calculate vertical spacing adjustments for deeper trees
   * Optimizes vertical space usage for trees with many levels
   * @param totalLevels - Total number of levels in the tree
   * @returns Adjusted vertical spacing value
   */
  private calculateVerticalSpacingForDepth(totalLevels: number): number {
    let adjustedVerticalSpacing = this.verticalSpacing;
    
    // Reduce vertical spacing for deeper trees to fit more levels on screen
    if (totalLevels > 5) {
      // Progressive reduction for trees with more than 5 levels
      const reductionFactor = Math.max(0.7, 1 - ((totalLevels - 5) * 0.05));
      adjustedVerticalSpacing *= reductionFactor;
    }
    
    // Ensure minimum vertical spacing for readability
    const minVerticalSpacing = 40;
    adjustedVerticalSpacing = Math.max(minVerticalSpacing, adjustedVerticalSpacing);
    
    return adjustedVerticalSpacing;
  }

  /**
   * Calculate tree hash for performance caching
   * Generates a simple hash of the tree structure for cache invalidation
   * @param person - Root person node
   * @returns Hash string representing tree structure
   */
  private calculateTreeHash(person: Person): string {
    const hashParts: string[] = [];
    
    const traverse = (node: Person, level: number): void => {
      if (level > this.maxRenderLevels) return;
      
      hashParts.push(`${node.id}-${level}`);
      if (node.children) {
        node.children.forEach(child => traverse(child, level + 1));
      }
    };
    
    traverse(person, 0);
    return hashParts.join('|');
  }

  /**
   * Draw optimized connection lines for clean rendering without artifacts
   * Implements separate logic for single child vs multiple children scenarios
   * @param parentX - Parent node center X coordinate
   * @param parentY - Parent node bottom Y coordinate
   * @param childPositions - Array of child center X coordinates
   * @param connectorY - Y coordinate for horizontal connector line
   * @param childTopY - Y coordinate for child node tops
   */
  private drawOptimizedConnections(
    parentX: number, 
    parentY: number, 
    childPositions: number[], 
    connectorY: number, 
    childTopY: number
  ): void {
    if (childPositions.length === 0) return;

    // Set line style for connections
    this.ctx.strokeStyle = this.lineColor;
    this.ctx.lineWidth = 2;

    // Draw vertical line from parent to connector level
    this.drawPreciseLine(parentX, parentY, parentX, connectorY);

    if (childPositions.length === 1) {
      // Single child scenario: direct connection
      this.drawSingleChildConnection(parentX, connectorY, childPositions[0], childTopY);
    } else {
      // Multiple children scenario: optimized horizontal span
      this.drawMultipleChildrenConnections(connectorY, childPositions, childTopY);
    }
  }

  /**
   * Draw connection for single child scenario
   * Creates direct connection from parent to child without unnecessary extensions
   * @param parentX - Parent center X coordinate
   * @param connectorY - Y coordinate for horizontal connector
   * @param childX - Child center X coordinate
   * @param childTopY - Child top Y coordinate
   */
  private drawSingleChildConnection(
    parentX: number, 
    connectorY: number, 
    childX: number, 
    childTopY: number
  ): void {
    // Draw horizontal line from parent to child
    this.drawPreciseLine(parentX, connectorY, childX, connectorY);
    
    // Draw vertical line down to child
    this.drawPreciseLine(childX, connectorY, childX, childTopY);
  }

  /**
   * Draw connections for multiple children scenario
   * Creates optimized horizontal span only between actual child positions
   * @param connectorY - Y coordinate for horizontal connector
   * @param childPositions - Array of child center X coordinates
   * @param childTopY - Child top Y coordinate
   */
  private drawMultipleChildrenConnections(
    connectorY: number, 
    childPositions: number[], 
    childTopY: number
  ): void {
    // Calculate precise span between first and last child
    const leftmostX = childPositions[0];
    const rightmostX = childPositions[childPositions.length - 1];
    
    // Draw horizontal connector line with minimal buffer, no excessive extensions
    const bufferLeft = Math.max(0, leftmostX - this.connectionLineBuffer);
    const bufferRight = Math.min(rightmostX + this.connectionLineBuffer, rightmostX + this.connectionLineBuffer);
    
    this.drawPreciseLine(bufferLeft, connectorY, bufferRight, connectorY);
    
    // Draw vertical connectors to each child
    childPositions.forEach(childX => {
      this.drawPreciseLine(childX, connectorY, childX, childTopY);
    });
  }

  /**
   * Helper method for drawing precise line segments without artifacts
   * Ensures clean rendering by using proper canvas drawing techniques
   * @param x1 - Start X coordinate
   * @param y1 - Start Y coordinate
   * @param x2 - End X coordinate
   * @param y2 - End Y coordinate
   */
  private drawPreciseLine(x1: number, y1: number, x2: number, y2: number): void {
    this.ctx.beginPath();
    
    // Use pixel-perfect positioning to avoid anti-aliasing artifacts
    const pixelX1 = Math.round(x1) + 0.5;
    const pixelY1 = Math.round(y1) + 0.5;
    const pixelX2 = Math.round(x2) + 0.5;
    const pixelY2 = Math.round(y2) + 0.5;
    
    this.ctx.moveTo(pixelX1, pixelY1);
    this.ctx.lineTo(pixelX2, pixelY2);
    this.ctx.stroke();
  }



  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }
}
