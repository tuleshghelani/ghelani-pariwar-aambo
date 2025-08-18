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

  // Error handling and recovery properties
  private readonly maxCanvasWidth: number = 32767; // Maximum safe canvas width
  private readonly maxCanvasHeight: number = 32767; // Maximum safe canvas height
  private readonly maxTreeWidth: number = 50000; // Maximum tree width before fallback
  private readonly maxTreeHeight: number = 30000; // Maximum tree height before fallback
  private readonly maxNodesPerLevel: number = 200; // Maximum nodes per level before optimization
  private readonly emergencyFallbackScale: number = 0.1; // Emergency scale for oversized trees
  private errorRecoveryAttempts: number = 0;
  private readonly maxErrorRecoveryAttempts: number = 3;
  private lastErrorState: string | null = null;
  private isInErrorRecovery: boolean = false;

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

  ngOnInit(): void { }

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

    // Enhanced initialization with root level optimization
    const isMobile = window.innerWidth <= 768;

    // Add a small delay to ensure the canvas is properly sized before drawing
    setTimeout(() => {
      // Draw the tree when data is available with root level optimization
      if (this.personData) {
        // Apply root-optimized initial positioning for all devices
        this.applyRootOptimizedInitialView();
        this.drawTree();

        // Ensure root level prominence after initial draw
        setTimeout(() => {
          this.ensureRootLevelProminence();
        }, 50);
      }
    }, isMobile ? 150 : 100); // Slightly longer delay for mobile to ensure proper initialization
  }

  /**
   * Apply root-optimized initial view for all device types
   * Ensures the root level is prominently displayed and first 2-3 levels are clearly visible
   */
  private applyRootOptimizedInitialView(): void {
    if (!this.isBrowser) return;

    const canvas = this.canvasRef.nativeElement;
    const initialView = this.calculateInitialView();

    // Apply root-optimized initial settings
    this.scale = initialView.scale;
    this.offsetX = initialView.offsetX;
    this.offsetY = initialView.offsetY;

    // Device-specific additional adjustments for root prominence
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth <= 768;
    const isTablet = screenWidth > 768 && screenWidth <= 1024;

    if (isMobile) {
      // Mobile-specific root optimization
      this.optimizeMobileRootDisplay(canvas, screenWidth);
    } else if (isTablet) {
      // Tablet-specific root optimization
      this.optimizeTabletRootDisplay(canvas);
    } else {
      // Desktop-specific root optimization
      this.optimizeDesktopRootDisplay(canvas);
    }

    // Ensure the view is within appropriate bounds for the device
    if (isMobile) {
      this.ensureMobileViewBounds();
    }
  }

  /**
   * Optimize root display specifically for mobile devices
   * Ensures maximum root visibility and first level clarity on small screens
   */
  private optimizeMobileRootDisplay(canvas: HTMLCanvasElement, screenWidth: number): void {
    // For very small screens, prioritize root visibility even more
    if (screenWidth <= 480) {
      // Adjust vertical position to show more content below root
      this.offsetY = Math.max(this.offsetY * 0.8, canvas.height * 0.01);

      // Slightly reduce scale if needed to show more context
      if (this.scale > 0.3) {
        this.scale = Math.max(0.25, this.scale * 0.95);
      }
    } else if (screenWidth <= 600) {
      // Medium mobile screens - balance root prominence with context
      this.offsetY = Math.max(this.offsetY * 0.9, canvas.height * 0.02);
    }

    // Ensure root is positioned for optimal thumb navigation
    const thumbReachArea = canvas.width * 0.7; // Most users can reach 70% of screen width
    if (this.offsetX > thumbReachArea) {
      this.offsetX = Math.min(this.offsetX, thumbReachArea * 0.8);
    }
  }

  /**
   * Optimize root display for tablet devices
   * Balances root prominence with showing first 2-3 levels clearly
   */
  private optimizeTabletRootDisplay(canvas: HTMLCanvasElement): void {
    // Tablets can show more content, so optimize for showing first 2-3 levels
    const isLandscape = window.innerWidth > window.innerHeight;

    if (isLandscape) {
      // Landscape tablets - can show more horizontal content
      this.offsetX = Math.max(this.offsetX, canvas.width * 0.1);
      this.offsetY = Math.max(this.offsetY, canvas.height * 0.08);
    } else {
      // Portrait tablets - optimize for vertical content
      this.offsetY = Math.max(this.offsetY * 0.9, canvas.height * 0.06);
    }
  }

  /**
   * Optimize root display for desktop devices
   * Maximizes the visibility of first 2-3 levels while maintaining root prominence
   */
  private optimizeDesktopRootDisplay(canvas: HTMLCanvasElement): void {
    // Desktop has the most screen real estate, so optimize for showing tree structure

    // Ensure root is positioned to show maximum tree context
    this.offsetX = Math.max(this.offsetX, canvas.width * 0.08);
    this.offsetY = Math.max(this.offsetY, canvas.height * 0.1);

    // Desktop can handle slightly larger scale for better readability
    if (this.scale < 0.6) {
      this.scale = Math.min(0.85, this.scale * 1.1);
    }
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
   * Calculate device-specific initial view settings with enhanced root level optimization
   * Determines optimal scale and positioning for mobile (≤768px), tablet (769-1024px), and desktop
   * Ensures root level is prominently displayed and first 2-3 levels are clearly visible
   * @returns Object containing scale, offsetX, and offsetY values optimized for root level display
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

    // Calculate optimal initial view based on tree structure for root prominence
    const initialViewConfig = this.calculateOptimalInitialViewForRootDisplay();

    // Enhanced device-specific initial scale and positioning logic with root level optimization
    if (screenWidth <= 768) {
      // Mobile devices (≤768px): Root-optimized mobile positioning
      const isPortrait = screenHeight > screenWidth;

      // Adjust scale to ensure root and first 2-3 levels are clearly visible
      let mobileScale = initialViewConfig.mobileScale;
      if (screenWidth <= 480) {
        // Very small mobile screens - prioritize root visibility
        mobileScale = Math.max(0.25, initialViewConfig.mobileScale * 0.8);
      } else if (screenWidth <= 600) {
        // Medium mobile screens - balance root and level visibility
        mobileScale = Math.max(0.3, initialViewConfig.mobileScale * 0.9);
      }

      // Root-centered positioning for mobile - ensure root node is prominently displayed
      const rootCenteredOffsetX = this.calculateRootCenteredOffsetX(canvasWidth, mobileScale);
      const rootCenteredOffsetY = this.calculateRootCenteredOffsetY(canvasHeight, mobileScale, true);

      return {
        scale: mobileScale,
        offsetX: rootCenteredOffsetX,
        offsetY: rootCenteredOffsetY
      };
    } else if (screenWidth > 768 && screenWidth <= 1024) {
      // Tablet devices (769-1024px): Root-optimized tablet positioning
      const isLandscape = screenWidth > screenHeight;

      // Scale to show root and first 2-3 levels clearly on tablet
      const tabletScale = isLandscape ?
        Math.max(0.5, initialViewConfig.tabletScale) :
        Math.max(0.45, initialViewConfig.tabletScale * 0.9);

      // Root-centered positioning for tablet
      const rootCenteredOffsetX = this.calculateRootCenteredOffsetX(canvasWidth, tabletScale);
      const rootCenteredOffsetY = this.calculateRootCenteredOffsetY(canvasHeight, tabletScale, false);

      return {
        scale: tabletScale,
        offsetX: rootCenteredOffsetX,
        offsetY: rootCenteredOffsetY
      };
    } else {
      // Desktop devices (>1024px): Root-optimized desktop positioning
      const desktopScale = Math.max(0.6, initialViewConfig.desktopScale);

      // Root-centered positioning for desktop - show first 2-3 levels clearly
      const rootCenteredOffsetX = this.calculateRootCenteredOffsetX(canvasWidth, desktopScale);
      const rootCenteredOffsetY = this.calculateRootCenteredOffsetY(canvasHeight, desktopScale, false);

      return {
        scale: desktopScale,
        offsetX: rootCenteredOffsetX,
        offsetY: rootCenteredOffsetY
      };
    }
  }

  /**
   * Calculate optimal initial view configuration for root level display
   * Analyzes tree structure to determine best scale and positioning for root prominence
   * @returns Configuration object with device-specific scale recommendations
   */
  private calculateOptimalInitialViewForRootDisplay(): {
    mobileScale: number;
    tabletScale: number;
    desktopScale: number;
    recommendedLevelsToShow: number;
  } {
    if (!this.personData) {
      return {
        mobileScale: 0.35,
        tabletScale: 0.6,
        desktopScale: 0.8,
        recommendedLevelsToShow: 3
      };
    }

    // Analyze tree structure to optimize initial view
    const treeAnalysis = this.analyzeTreeStructureForInitialView(this.personData);

    // Calculate optimal scales based on tree characteristics
    let mobileScale = 0.35;
    let tabletScale = 0.6;
    let desktopScale = 0.8;
    let recommendedLevelsToShow = 3;

    // Adjust scales based on tree depth and width
    if (treeAnalysis.maxDepth <= 3) {
      // Shallow trees - can use larger scale to show all levels
      mobileScale = 0.45;
      tabletScale = 0.7;
      desktopScale = 0.9;
      recommendedLevelsToShow = treeAnalysis.maxDepth;
    } else if (treeAnalysis.maxDepth <= 5) {
      // Medium depth trees - optimize for first 3 levels
      mobileScale = 0.4;
      tabletScale = 0.65;
      desktopScale = 0.85;
      recommendedLevelsToShow = 3;
    } else if (treeAnalysis.maxDepth <= 8) {
      // Deep trees - focus on root and first 2 levels
      mobileScale = 0.35;
      tabletScale = 0.6;
      desktopScale = 0.8;
      recommendedLevelsToShow = 2;
    } else {
      // Very deep trees - prioritize root visibility
      mobileScale = 0.3;
      tabletScale = 0.55;
      desktopScale = 0.75;
      recommendedLevelsToShow = 2;
    }

    // Adjust for tree width at first few levels
    if (treeAnalysis.maxWidthInFirstThreeLevels > 8) {
      // Very wide trees - reduce scale to fit more content
      mobileScale *= 0.85;
      tabletScale *= 0.9;
      desktopScale *= 0.95;
    } else if (treeAnalysis.maxWidthInFirstThreeLevels <= 3) {
      // Narrow trees - can use larger scale
      mobileScale *= 1.1;
      tabletScale *= 1.05;
      desktopScale *= 1.02;
    }

    return {
      mobileScale: Math.max(0.2, Math.min(0.6, mobileScale)),
      tabletScale: Math.max(0.4, Math.min(0.8, tabletScale)),
      desktopScale: Math.max(0.5, Math.min(1.0, desktopScale)),
      recommendedLevelsToShow
    };
  }

  /**
   * Analyze tree structure to inform initial view optimization
   * Examines tree depth, width, and distribution for optimal root display
   * @param person - Root person node
   * @returns Analysis results for initial view optimization
   */
  private analyzeTreeStructureForInitialView(person: Person): {
    maxDepth: number;
    maxWidthInFirstThreeLevels: number;
    totalNodesInFirstThreeLevels: number;
    rootHasChildren: boolean;
  } {
    let maxDepth = 0;
    let maxWidthInFirstThreeLevels = 0;
    let totalNodesInFirstThreeLevels = 0;
    const levelCounts = new Map<number, number>();

    const traverse = (node: Person, level: number): void => {
      maxDepth = Math.max(maxDepth, level);

      if (!levelCounts.has(level)) {
        levelCounts.set(level, 0);
      }
      levelCounts.set(level, levelCounts.get(level)! + 1);

      // Track nodes in first three levels for width analysis
      if (level <= 2) {
        totalNodesInFirstThreeLevels++;
        maxWidthInFirstThreeLevels = Math.max(
          maxWidthInFirstThreeLevels,
          levelCounts.get(level)!
        );
      }

      if (node.children) {
        node.children.forEach(child => traverse(child, level + 1));
      }
    };

    traverse(person, 0);

    return {
      maxDepth,
      maxWidthInFirstThreeLevels,
      totalNodesInFirstThreeLevels,
      rootHasChildren: !!(person.children && person.children.length > 0)
    };
  }

  /**
   * Calculate root-centered horizontal offset for optimal root display
   * Ensures root node is prominently positioned and first levels are visible
   * @param canvasWidth - Canvas width in pixels
   * @param scale - Current scale factor
   * @returns Optimal horizontal offset for root centering
   */
  private calculateRootCenteredOffsetX(canvasWidth: number, scale: number): number {
    if (!this.personData) {
      return canvasWidth * 0.1;
    }

    // Calculate approximate tree width for first few levels
    const treeAnalysis = this.analyzeTreeStructureForInitialView(this.personData);
    const estimatedTreeWidth = this.estimateTreeWidthForFirstLevels(treeAnalysis);

    // Calculate offset to center the root and show first levels optimally
    const scaledTreeWidth = estimatedTreeWidth * scale;
    const availableWidth = canvasWidth;

    // Center the tree with slight left bias to show more of the right side
    let centeredOffsetX = (availableWidth - scaledTreeWidth) / 2;

    // Adjust for better root prominence
    const rootProminenceAdjustment = canvasWidth * 0.05;
    centeredOffsetX += rootProminenceAdjustment;

    // Ensure minimum margin from canvas edge
    const minMargin = canvasWidth * 0.02;
    const maxMargin = canvasWidth * 0.4;

    return Math.max(minMargin, Math.min(maxMargin, centeredOffsetX));
  }

  /**
   * Calculate root-centered vertical offset for optimal root display
   * Positions root node to show first 2-3 levels clearly
   * @param canvasHeight - Canvas height in pixels
   * @param scale - Current scale factor
   * @param isMobile - Whether this is a mobile device
   * @returns Optimal vertical offset for root centering
   */
  private calculateRootCenteredOffsetY(canvasHeight: number, scale: number, isMobile: boolean): number {
    if (!this.personData) {
      return canvasHeight * 0.1;
    }

    // Calculate approximate height needed for first 2-3 levels
    const treeAnalysis = this.analyzeTreeStructureForInitialView(this.personData);
    const levelsToShow = Math.min(3, treeAnalysis.maxDepth + 1);

    // Estimate height for the levels we want to show
    const nodeHeight = this.nodeHeight;
    const verticalSpacing = this.calculateVerticalSpacingForDepth(treeAnalysis.maxDepth);
    const estimatedHeightForLevels = levelsToShow * (nodeHeight + verticalSpacing);

    // Calculate offset to position root optimally
    const scaledHeight = estimatedHeightForLevels * scale;
    const availableHeight = canvasHeight;

    // Position root in upper portion to show more levels below
    let rootOffsetY: number;

    if (isMobile) {
      // Mobile: Position root higher to maximize visible levels
      rootOffsetY = availableHeight * 0.05;
    } else {
      // Desktop/Tablet: Balance root prominence with level visibility
      rootOffsetY = Math.max(
        availableHeight * 0.08,
        (availableHeight - scaledHeight) * 0.25
      );
    }

    // Ensure reasonable bounds
    const minOffsetY = availableHeight * 0.02;
    const maxOffsetY = availableHeight * 0.3;

    return Math.max(minOffsetY, Math.min(maxOffsetY, rootOffsetY));
  }

  /**
   * Estimate tree width for first few levels to optimize initial positioning
   * @param treeAnalysis - Tree structure analysis results
   * @returns Estimated width needed for first levels
   */
  private estimateTreeWidthForFirstLevels(treeAnalysis: {
    maxDepth: number;
    maxWidthInFirstThreeLevels: number;
    totalNodesInFirstThreeLevels: number;
    rootHasChildren: boolean;
  }): number {
    // Use the maximum width in first three levels as base
    const maxNodesInLevel = treeAnalysis.maxWidthInFirstThreeLevels;

    // Estimate spacing (use average between min and max)
    const estimatedSpacing = (this.minHorizontalSpacing + this.maxHorizontalSpacing) / 2;

    // Calculate estimated width
    const estimatedWidth = maxNodesInLevel * this.nodeWidth +
      (maxNodesInLevel - 1) * estimatedSpacing;

    // Add some buffer for connection lines and margins
    const buffer = this.nodeWidth * 0.5;

    return estimatedWidth + buffer;
  }

  /**
   * Calculate optimal root start position for prominent root display
   * Ensures root node is centered and first 2-3 levels are clearly visible
   * @param canvas - Canvas element
   * @param treeDimensions - Calculated tree dimensions
   * @returns Optimal X position for root node start
   */
  private calculateOptimalRootStartPosition(
    canvas: HTMLCanvasElement,
    treeDimensions: { width: number, height: number, levelWidths: Map<number, number> }
  ): number {
    const isMobile = window.innerWidth <= 768;
    const canvasWidth = canvas.width;
    const scaledCanvasWidth = canvasWidth / this.scale;

    // Calculate base centered position
    let startX = (scaledCanvasWidth - treeDimensions.width) / 2;

    // Apply device-specific adjustments for root prominence
    if (isMobile) {
      // Mobile: Ensure root is visible with slight left bias for better navigation
      const mobileAdjustment = Math.min(50, scaledCanvasWidth * 0.08);
      startX = Math.max(mobileAdjustment, startX);

      // Ensure we don't push content too far right on small screens
      const maxStartX = scaledCanvasWidth * 0.15;
      startX = Math.min(startX, maxStartX);
    } else {
      // Desktop/Tablet: Center with slight adjustment for optimal viewing
      const desktopAdjustment = scaledCanvasWidth * 0.02;
      startX += desktopAdjustment;

      // Ensure reasonable bounds
      const minStartX = scaledCanvasWidth * 0.05;
      const maxStartX = scaledCanvasWidth * 0.25;
      startX = Math.max(minStartX, Math.min(maxStartX, startX));
    }

    return startX;
  }

  /**
   * Check if root level is not prominently displayed in current view
   * Determines if the current view needs adjustment to show root better
   * @returns True if root is not prominently displayed
   */
  private isRootNotProminentlyDisplayed(): boolean {
    if (!this.personData || !this.isBrowser) {
      return false;
    }

    const canvas = this.canvasRef.nativeElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Calculate where the root node would be positioned in current view
    const treeDimensions = this.calculateTreeDimensionsWithAdaptiveSpacing(this.personData);
    const rootStartX = this.calculateOptimalRootStartPosition(canvas, treeDimensions);

    // Transform to screen coordinates
    const screenRootX = rootStartX * this.scale + this.offsetX;
    const screenRootY = 50 * this.scale + this.offsetY; // Root Y position

    // Check if root is prominently visible
    const rootNodeScreenWidth = this.nodeWidth * this.scale;
    const rootNodeScreenHeight = this.nodeHeight * this.scale;

    // Root should be well within the visible area
    const isRootVisible = screenRootX >= 0 &&
      screenRootX + rootNodeScreenWidth <= canvasWidth &&
      screenRootY >= 0 &&
      screenRootY + rootNodeScreenHeight <= canvasHeight;

    // Root should be in the upper portion of the screen for prominence
    const isRootInUpperPortion = screenRootY <= canvasHeight * 0.4;

    // Root should be reasonably centered horizontally
    const rootCenterX = screenRootX + rootNodeScreenWidth / 2;
    const isRootReasonablyCentered = rootCenterX >= canvasWidth * 0.1 &&
      rootCenterX <= canvasWidth * 0.9;

    // Check if scale is appropriate for showing first 2-3 levels
    const isScaleAppropriate = this.scale >= 0.2 && this.scale <= 1.2;

    return !(isRootVisible && isRootInUpperPortion && isRootReasonablyCentered && isScaleAppropriate);
  }

  /**
   * Ensure root level prominence is maintained
   * Adjusts view if root is not prominently displayed
   */
  private ensureRootLevelProminence(): void {
    if (!this.isBrowser || !this.personData) {
      return;
    }

    // Check if root is prominently displayed
    if (this.isRootNotProminentlyDisplayed()) {
      // Reset to optimal initial view for root prominence
      const initialView = this.calculateInitialView();

      // Smoothly transition to new view (optional - can be instant)
      const transitionDuration = 300; // ms
      const startTime = Date.now();
      const startScale = this.scale;
      const startOffsetX = this.offsetX;
      const startOffsetY = this.offsetY;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / transitionDuration, 1);

        // Use easing function for smooth transition
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        this.scale = startScale + (initialView.scale - startScale) * easeProgress;
        this.offsetX = startOffsetX + (initialView.offsetX - startOffsetX) * easeProgress;
        this.offsetY = startOffsetY + (initialView.offsetY - startOffsetY) * easeProgress;

        this.drawTree();

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      // Start animation or apply immediately for mobile (better performance)
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        // Instant transition for mobile to avoid performance issues
        this.scale = initialView.scale;
        this.offsetX = initialView.offsetX;
        this.offsetY = initialView.offsetY;
        this.drawTree();
      } else {
        // Smooth transition for desktop/tablet
        requestAnimationFrame(animate);
      }
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

      // Enhanced initial positioning logic with root level optimization
      const initialView = this.calculateInitialView();

      // Check if this is initial load or significant resize that requires repositioning
      const isInitialLoad = Math.abs(this.scale - 1) < 0.1 &&
        Math.abs(this.offsetX) < 10 &&
        Math.abs(this.offsetY) < 10;

      // For mobile devices, also reset view on orientation changes to maintain root prominence
      const isMobile = window.innerWidth <= 768;
      const orientationChanged = isMobile && (
        (window.innerWidth > window.innerHeight && this.scale < 0.4) ||
        (window.innerHeight > window.innerWidth && this.scale > 0.6)
      );

      // Also reset view if the current view doesn't show the root prominently
      const rootNotProminent = this.isRootNotProminentlyDisplayed();

      if (isInitialLoad || orientationChanged || rootNotProminent) {
        this.scale = initialView.scale;
        this.offsetX = initialView.offsetX;
        this.offsetY = initialView.offsetY;

        // For mobile devices, ensure the view is properly bounded after resize
        if (isMobile) {
          setTimeout(() => this.ensureMobileViewBounds(), 100);
        }

        // Ensure root level prominence is maintained after resize
        setTimeout(() => this.ensureRootLevelProminence(), 150);
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
   * Optimized canvas clearing for large trees
   * Uses efficient clearing methods based on tree size and device capabilities
   */
  private optimizedCanvasClear(): void {
    if (!this.ctx) return;

    const canvas = this.canvasRef.nativeElement;

    if (this.isLargeTree) {
      // For large trees, use the most efficient clearing method
      // Save current transformation matrix
      this.ctx.save();

      // Reset transformation to identity matrix for efficient clearing
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Clear entire canvas efficiently
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Restore transformation matrix
      this.ctx.restore();
    } else {
      // Standard clearing for smaller trees
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /**
   * Batch rendering optimization for large trees
   * Groups rendering operations to reduce canvas API calls
   */
  private optimizeRenderingBatch(): void {
    if (!this.isLargeTree) return;

    // Enable optimizations for large tree rendering
    if (this.ctx) {
      // Disable image smoothing for better performance on large trees when zoomed out
      if (this.scale < 0.5) {
        this.ctx.imageSmoothingEnabled = false;
      } else {
        this.ctx.imageSmoothingEnabled = true;
      }

      // Optimize line rendering for performance
      this.ctx.lineCap = 'butt';
      this.ctx.lineJoin = 'miter';
    }
  }

  /**
   * Memory management for render cache
   * Prevents memory leaks by limiting cache size and cleaning old entries
   */
  private manageRenderCacheMemory(): void {
    const maxCacheSize = this.isLargeTree ? 1000 : 500;

    if (this.renderCache.size > maxCacheSize) {
      // Remove oldest entries (first 25% of cache)
      const entriesToRemove = Math.floor(maxCacheSize * 0.25);
      const keys = Array.from(this.renderCache.keys());

      for (let i = 0; i < entriesToRemove && i < keys.length; i++) {
        this.renderCache.delete(keys[i]);
      }
    }
  }

  /**
   * Performance monitoring and adaptive optimization
   * Adjusts rendering strategy based on performance metrics
   */
  private adaptivePerformanceOptimization(): void {
    if (!this.isLargeTree) return;

    // Monitor rendering performance and adjust accordingly
    const startTime = performance.now();

    // Store start time for performance measurement
    (this as any)._renderStartTime = startTime;
  }

  /**
   * Complete performance measurement and optimization adjustment
   * Called after rendering to measure performance and adjust settings
   */
  private completePerformanceMeasurement(): void {
    if (!this.isLargeTree || !(this as any)._renderStartTime) return;

    const renderTime = performance.now() - (this as any)._renderStartTime;

    // If rendering is taking too long (>100ms), enable more aggressive optimizations
    if (renderTime > 100) {
      // Reduce render levels for very slow performance
      if (renderTime > 200 && this.maxRenderLevels > 8) {
        (this as any)._adaptiveMaxRenderLevels = Math.max(8, this.maxRenderLevels - 1);
      }

      // Clear cache more aggressively for slow renders
      if (this.renderCache.size > 200) {
        this.clearRenderCache();
      }
    }

    // Clean up measurement
    delete (this as any)._renderStartTime;
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

    // Use adaptive render levels if performance optimization has adjusted them
    const effectiveMaxRenderLevels = (this as any)._adaptiveMaxRenderLevels || this.maxRenderLevels;

    // For large trees, limit rendering depth
    if (this.isLargeTree && level > effectiveMaxRenderLevels) {
      return false;
    }

    // For very deep trees, consider current zoom level and device performance
    if (totalLevels > 10) {
      // More aggressive culling on mobile devices
      const isMobile = window.innerWidth <= 768;
      const mobileThreshold = isMobile ? 6 : 8;

      if (this.scale < 0.3 && level > mobileThreshold) {
        return false;
      }

      // Skip rendering very deep levels when zoomed out significantly
      if (this.scale < 0.2 && level > 5) {
        return false;
      }
    }

    // Performance optimization: Skip rendering levels that are outside visible area
    if (this.isLargeTree && this.scale < 0.4 && level > 12) {
      return false;
    }

    return true;
  }

  private drawTree(): void {
    if (!this.isBrowser || !this.ctx || !this.personData) return;

    try {
      // Validate tree data before processing
      if (!this.validateTreeData(this.personData)) {
        this.handleMalformedTreeData();
        return;
      }

      const canvas = this.canvasRef.nativeElement;
      const isMobile = window.innerWidth <= 768;

      // Performance optimization: Start performance monitoring for large trees
      this.adaptivePerformanceOptimization();

      // Performance optimization: Check if tree structure has changed
      const currentTreeHash = this.calculateTreeHash(this.personData);
      const treeStructureChanged = currentTreeHash !== this.lastTreeHash;

      // Performance optimization: Use optimized canvas clearing
      this.optimizedCanvasClear();

      // Performance optimization: Apply batch rendering optimizations
      this.optimizeRenderingBatch();

      // Clear node bounding boxes for fresh overlap detection
      this.clearNodeBoundingBoxes();

      // Performance optimization: Clear render cache if tree structure changed
      if (treeStructureChanged) {
        this.renderCache.clear();
        // Reset layout configuration for fresh adaptive spacing calculations
        this.layoutConfig.levelBasedSpacing.clear();
      }

      // Save current state
      this.ctx.save();

      // Apply transformations - ensuring proper integration with existing zoom and pan functionality
      this.ctx.translate(this.offsetX, this.offsetY);
      this.ctx.scale(this.scale, this.scale);

      // Calculate tree dimensions using enhanced adaptive spacing algorithms in main rendering pipeline
      const treeDimensions = this.calculateTreeDimensionsWithAdaptiveSpacing(this.personData);

      // Check for extremely wide trees and apply fallback strategies
      if (!this.validateTreeDimensions(treeDimensions, canvas)) {
        this.handleOversizedTree(treeDimensions, canvas);
        return;
      }

      // Enhanced mobile-aware tree centering with adaptive spacing considerations
      let startX = (canvas.width / this.scale - treeDimensions.width) / 2;

      // For mobile devices, adjust horizontal positioning to ensure root visibility
      if (isMobile) {
        const mobileAdjustment = Math.min(50, canvas.width / this.scale * 0.05);
        startX = Math.max(mobileAdjustment, startX);
      }

      // Apply optimized initial view settings for root level prominence
      const isInitialDraw = Math.abs(this.offsetX) < 10 && Math.abs(this.offsetY) < 10 && Math.abs(this.scale - 1) < 0.1;
      if (isInitialDraw) {
        const initialView = this.calculateInitialView();
        this.scale = initialView.scale;
        this.offsetX = initialView.offsetX;
        this.offsetY = initialView.offsetY;

        // Reapply transformations with optimized values for root display
        this.ctx.restore();
        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Recalculate startX with root-optimized positioning
        const recalculatedDimensions = this.calculateTreeDimensionsWithAdaptiveSpacing(this.personData);
        startX = this.calculateOptimalRootStartPosition(canvas, recalculatedDimensions);
      }

      // Mobile-specific rendering optimizations
      if (isMobile) {
        // Optimize canvas rendering for mobile performance
        this.ctx.imageSmoothingEnabled = this.scale > 0.5;
      }

      // Draw from root node using enhanced layout algorithms with integrated adaptive spacing
      // This ensures the main rendering pipeline uses the new adaptive spacing calculations
      this.drawNodeWithAdaptiveLayout(this.personData, startX, 50, 0, treeDimensions);

      // Perform overlap detection after initial rendering using enhanced algorithms
      const overlaps = this.detectNodeOverlaps(this.nodeBoundingBoxes);

      // If overlaps are detected, adjust positioning and redraw if necessary
      if (overlaps.length > 0) {
        const adjustmentResult = this.adjustPositioningForOverlaps(overlaps, treeDimensions);

        if (adjustmentResult.repositionRequired || adjustmentResult.adjustedSpacing.size > 0) {
          // Update layout configuration with adjusted spacing from enhanced algorithms
          adjustmentResult.adjustedSpacing.forEach((spacing, level) => {
            this.layoutConfig.levelBasedSpacing.set(level, spacing);
          });

          // Clear and redraw with adjusted spacing if significant overlaps were found
          if (adjustmentResult.repositionRequired) {
            this.ctx.clearRect(0, 0, canvas.width / this.scale, canvas.height / this.scale);
            this.clearNodeBoundingBoxes();

            // Recalculate tree dimensions with updated adaptive spacing algorithms
            const adjustedTreeDimensions = this.calculateTreeDimensionsWithAdaptiveSpacing(this.personData);

            // Recalculate start position with enhanced adaptive spacing
            let adjustedStartX = (canvas.width / this.scale - adjustedTreeDimensions.width) / 2;
            if (isMobile) {
              const mobileAdjustment = Math.min(50, canvas.width / this.scale * 0.05);
              adjustedStartX = Math.max(mobileAdjustment, adjustedStartX);
            }

            // Redraw using enhanced adaptive layout algorithms in main rendering pipeline
            this.drawNodeWithAdaptiveLayout(this.personData, adjustedStartX, 50, 0, adjustedTreeDimensions);
          }
        }
      }

      // Transformations are properly maintained for seamless zoom and pan functionality
      // The adaptive spacing calculations work within the existing transformation matrix
      // ensuring smooth interaction with zoom/pan operations

      // Restore state
      this.ctx.restore();

      // Performance optimization: Complete performance measurement and manage memory
      this.completePerformanceMeasurement();
      this.manageRenderCacheMemory();

      // Reset error recovery state on successful render
      this.resetErrorRecoveryState();

    } catch (error) {
      console.error('Error during tree rendering:', error);
      this.handleRenderingError(error);
    }
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

  /**
   * Enhanced tree dimensions calculation with integrated adaptive spacing
   * Calculates tree dimensions using the enhanced layout algorithms in the main rendering pipeline
   * @param person - Root person node
   * @returns Tree dimensions with adaptive spacing applied
   */
  private calculateTreeDimensionsWithAdaptiveSpacing(person: Person): { width: number, height: number, levelWidths: Map<number, number> } {
    try {
      const levelWidths = new Map<number, number>();
      const levelCounts = new Map<number, number>();

      // Reset levelNodeCounts for tracking nodes per level for spacing calculations
      this.levelNodeCounts.clear();

      // Performance optimization: Calculate tree hash for caching
      const treeHash = this.calculateTreeHash(person);

      // Calculate width needed for each level with enhanced adaptive spacing
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

      // Calculate total width and height using enhanced adaptive spacing algorithms
      let maxWidth = 0;
      let maxLevel = 0;

      levelCounts.forEach((count, level) => {
        // Use enhanced adaptive spacing calculation for main rendering pipeline
        const adaptiveSpacing = this.calculateEnhancedAdaptiveSpacing(level, count, levelCounts.size);

        // Store the calculated spacing in layout configuration for consistent use
        this.layoutConfig.levelBasedSpacing.set(level, adaptiveSpacing);

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

      // Validate calculated dimensions
      if (!isFinite(maxWidth) || !isFinite(height) || maxWidth <= 0 || height <= 0) {
        throw new Error(`Invalid calculated dimensions: width=${maxWidth}, height=${height}`);
      }

      // Cache results for performance
      this.lastTreeHash = treeHash;

      return { width: maxWidth, height, levelWidths };

    } catch (error) {
      console.error('Error calculating tree dimensions with adaptive spacing:', error);

      // Return safe fallback dimensions
      return {
        width: this.nodeWidth * 3, // Assume 3 nodes wide as fallback
        height: this.nodeHeight * 5, // Assume 5 levels as fallback
        levelWidths: new Map([[0, this.nodeWidth]])
      };
    }
  }

  private drawNode(person: Person, x: number, y: number, level: number, dimensions: { width: number, levelWidths: Map<number, number> }): number {
    if (!person) return 0;

    // Performance optimization: Use shouldRenderLevel for consistent level culling
    const totalLevels = this.levelNodeCounts.size;
    if (!this.shouldRenderLevel(level, totalLevels)) {
      return this.nodeWidth;
    }

    const isRoot = level === 0;

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

      // Use managed cache size limits
      this.manageRenderCacheMemory();
    }

    return finalWidth;
  }

  /**
   * Enhanced node drawing with integrated adaptive layout algorithms
   * Implements the enhanced layout algorithms in the main rendering pipeline
   * Ensures proper integration with existing zoom and pan functionality
   * @param person - Person node to draw
   * @param x - X coordinate for node position
   * @param y - Y coordinate for node position
   * @param level - Current tree level
   * @param dimensions - Tree dimensions with adaptive spacing
   * @returns Width of the drawn node and its children
   */
  private drawNodeWithAdaptiveLayout(person: Person, x: number, y: number, level: number, dimensions: { width: number, levelWidths: Map<number, number> }): number {
    if (!person) return 0;

    // Performance optimization: Use shouldRenderLevel for consistent level culling
    const totalLevels = this.levelNodeCounts.size;
    if (!this.shouldRenderLevel(level, totalLevels)) {
      return this.nodeWidth;
    }

    const isRoot = level === 0;

    // Performance optimization: Check render cache for large trees
    const cacheKey = `adaptive-${person.id}-${level}-${Math.round(x)}-${Math.round(y)}-${this.scale}`;
    if (this.isLargeTree && this.renderCache.has(cacheKey)) {
      const cached = this.renderCache.get(cacheKey)!;
      // Use cached dimensions but still update bounding box for overlap detection
      this.updateNodeBoundingBox(person.id, cached.x, cached.y, level);
      return cached.width;
    }

    // Update bounding box for overlap detection
    this.updateNodeBoundingBox(person.id, x, y, level);

    // Draw the node with enhanced styling for better visibility
    this.ctx.fillStyle = isRoot ? this.rootNodeColor : this.nodeColor;
    this.ctx.strokeStyle = isRoot ? this.lineColor : '#e4e7eb';
    this.ctx.lineWidth = 2;

    // Draw rounded rectangle
    this.roundRect(x, y, this.nodeWidth, this.nodeHeight, this.cornerRadius);

    // Add colored border on left side
    this.ctx.fillStyle = this.lineColor;
    this.ctx.fillRect(x, y, 4, this.nodeHeight);

    // Draw text with enhanced readability
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

    // Calculate positions for children using enhanced adaptive spacing
    const nextLevel = level + 1;
    const adjustedVerticalSpacing = this.calculateVerticalSpacingForDepth(this.levelNodeCounts.size);
    const nextY = y + this.nodeHeight + adjustedVerticalSpacing;
    const childrenCount = person.children.length;

    // Use stored adaptive spacing from layout configuration for consistency
    let adaptiveSpacing = this.layoutConfig.levelBasedSpacing.get(nextLevel);
    if (!adaptiveSpacing) {
      // Fallback to calculation if not stored
      adaptiveSpacing = this.calculateEnhancedAdaptiveSpacing(nextLevel, childrenCount, totalLevels);
      this.layoutConfig.levelBasedSpacing.set(nextLevel, adaptiveSpacing);
    }

    const childrenWidth = childrenCount * this.nodeWidth + (childrenCount - 1) * adaptiveSpacing;

    // Center children under parent with enhanced positioning
    let childX = x + (this.nodeWidth - childrenWidth) / 2;

    // Ensure children don't go off-screen or overlap with other elements
    const canvas = this.canvasRef.nativeElement;
    const minX = 10; // Minimum margin from canvas edge
    const maxX = (canvas.width / this.scale) - childrenWidth - 10;
    childX = Math.max(minX, Math.min(maxX, childX));

    // Calculate child positions for optimized connection rendering
    const parentCenterX = x + this.nodeWidth / 2;
    const parentBottomY = y + this.nodeHeight;
    const connectorY = y + this.nodeHeight + adjustedVerticalSpacing / 2;

    // Collect child center positions with adaptive spacing
    const childPositions: number[] = [];
    let currentChildX = childX;

    person.children.forEach(() => {
      childPositions.push(currentChildX + this.nodeWidth / 2);
      currentChildX += this.nodeWidth + adaptiveSpacing;
    });

    // Use optimized connection rendering methods for clean lines
    this.drawOptimizedConnections(
      parentCenterX,
      parentBottomY,
      childPositions,
      connectorY,
      nextY
    );

    // Draw children nodes recursively with adaptive layout
    let drawChildX = childX;
    person.children.forEach(child => {
      // Draw child node and its children using adaptive layout
      const childWidth = this.drawNodeWithAdaptiveLayout(child, drawChildX, nextY, nextLevel, dimensions);
      // Use consistent adaptive spacing for positioning
      drawChildX += childWidth + adaptiveSpacing;
    });

    const finalWidth = Math.max(this.nodeWidth, childrenWidth);

    // Performance optimization: Cache render results for large trees
    if (this.isLargeTree) {
      this.renderCache.set(cacheKey, { x, y, width: finalWidth });

      // Use managed cache size limits
      this.manageRenderCacheMemory();
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
    try {
      // Validate input parameters
      if (typeof level !== 'number' || typeof nodeCount !== 'number' || typeof totalLevels !== 'number') {
        throw new Error(`Invalid parameters: level=${level}, nodeCount=${nodeCount}, totalLevels=${totalLevels}`);
      }

      if (level < 0 || nodeCount < 0 || totalLevels < 0) {
        throw new Error(`Negative parameters not allowed: level=${level}, nodeCount=${nodeCount}, totalLevels=${totalLevels}`);
      }

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

      // Validate final spacing value
      if (!isFinite(calculatedSpacing) || calculatedSpacing < 0) {
        throw new Error(`Invalid calculated spacing: ${calculatedSpacing}`);
      }

      // Store level-specific spacing for future reference
      this.layoutConfig.levelBasedSpacing.set(level, calculatedSpacing);

      return calculatedSpacing;

    } catch (error) {
      console.error('Error calculating enhanced adaptive spacing:', error);

      // Return safe fallback spacing
      return Math.max(this.minHorizontalSpacing, this.horizontalSpacing * 0.8);
    }
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
      // Performance optimization: Use adaptive render levels and limit hash calculation depth
      const effectiveMaxRenderLevels = (this as any)._adaptiveMaxRenderLevels || this.maxRenderLevels;
      if (level > effectiveMaxRenderLevels) return;

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

  // ===== ERROR HANDLING AND RECOVERY METHODS =====

  /**
   * Validate tree data structure for malformed data
   * Checks for circular references, missing required properties, and data integrity
   * @param person - Root person node to validate
   * @returns True if tree data is valid, false otherwise
   */
  private validateTreeData(person: Person): boolean {
    if (!person) {
      console.warn('Tree validation failed: Root person is null or undefined');
      return false;
    }

    // Check for required properties
    if (!person.id || !person.name) {
      console.warn('Tree validation failed: Person missing required id or name', person);
      return false;
    }

    // Check for circular references and validate tree structure
    const visitedIds = new Set<string>();
    const maxDepth = 50; // Prevent infinite recursion

    const validateNode = (node: Person, depth: number, path: string[]): boolean => {
      // Prevent infinite recursion
      if (depth > maxDepth) {
        console.warn(`Tree validation failed: Maximum depth exceeded at ${path.join(' -> ')}`);
        return false;
      }

      // Check for circular references
      if (visitedIds.has(node.id)) {
        console.warn(`Tree validation failed: Circular reference detected for id ${node.id} at path ${path.join(' -> ')}`);
        return false;
      }

      // Validate node properties
      if (!node.id || !node.name) {
        console.warn(`Tree validation failed: Invalid node properties at ${path.join(' -> ')}`, node);
        return false;
      }

      // Check for invalid data types
      if (typeof node.id !== 'string' || typeof node.name !== 'string') {
        console.warn(`Tree validation failed: Invalid data types at ${path.join(' -> ')}`, node);
        return false;
      }

      visitedIds.add(node.id);

      // Validate children if they exist
      if (node.children) {
        if (!Array.isArray(node.children)) {
          console.warn(`Tree validation failed: Children is not an array at ${path.join(' -> ')}`, node);
          return false;
        }

        // Check for reasonable number of children
        if (node.children.length > this.maxNodesPerLevel) {
          console.warn(`Tree validation failed: Too many children (${node.children.length}) at ${path.join(' -> ')}`);
          return false;
        }

        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          if (!child) {
            console.warn(`Tree validation failed: Null child at index ${i} in ${path.join(' -> ')}`);
            return false;
          }

          const childPath = [...path, child.id || `child-${i}`];
          if (!validateNode(child, depth + 1, childPath)) {
            return false;
          }
        }
      }

      return true;
    };

    try {
      return validateNode(person, 0, [person.id]);
    } catch (error) {
      console.error('Tree validation failed with exception:', error);
      return false;
    }
  }

  /**
   * Validate tree dimensions to check for extremely wide trees
   * Ensures tree dimensions are within reasonable bounds for canvas rendering
   * @param dimensions - Calculated tree dimensions
   * @param canvas - Canvas element
   * @returns True if dimensions are acceptable, false if fallback is needed
   */
  private validateTreeDimensions(
    dimensions: { width: number; height: number; levelWidths: Map<number, number> },
    canvas: HTMLCanvasElement
  ): boolean {
    // Check for invalid dimensions
    if (!dimensions || typeof dimensions.width !== 'number' || typeof dimensions.height !== 'number') {
      console.warn('Tree dimensions validation failed: Invalid dimensions object', dimensions);
      return false;
    }

    // Check for NaN or infinite values
    if (!isFinite(dimensions.width) || !isFinite(dimensions.height)) {
      console.warn('Tree dimensions validation failed: Non-finite dimensions', dimensions);
      return false;
    }

    // Check for negative dimensions
    if (dimensions.width < 0 || dimensions.height < 0) {
      console.warn('Tree dimensions validation failed: Negative dimensions', dimensions);
      return false;
    }

    // Check for extremely large dimensions that would cause performance issues
    if (dimensions.width > this.maxTreeWidth || dimensions.height > this.maxTreeHeight) {
      console.warn(`Tree dimensions validation failed: Dimensions too large (${dimensions.width}x${dimensions.height})`);
      return false;
    }

    // Check canvas dimensions
    if (canvas.width > this.maxCanvasWidth || canvas.height > this.maxCanvasHeight) {
      console.warn(`Canvas dimensions validation failed: Canvas too large (${canvas.width}x${canvas.height})`);
      return false;
    }

    // Check for reasonable level widths
    if (dimensions.levelWidths) {
      for (const [level, width] of dimensions.levelWidths) {
        if (!isFinite(width) || width < 0) {
          console.warn(`Tree dimensions validation failed: Invalid level width at level ${level}: ${width}`);
          return false;
        }

        if (width > this.maxTreeWidth) {
          console.warn(`Tree dimensions validation failed: Level ${level} width too large: ${width}`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Handle malformed tree data with graceful fallback
   * Attempts to sanitize data or provides error message to user
   */
  private handleMalformedTreeData(): void {
    console.error('Malformed tree data detected, attempting recovery...');

    // Attempt to sanitize the tree data
    const sanitizedData = this.sanitizeTreeData(this.personData);

    if (sanitizedData && this.validateTreeData(sanitizedData)) {
      console.log('Tree data successfully sanitized, retrying render...');
      this.personData = sanitizedData;

      // Retry rendering with sanitized data
      if (this.errorRecoveryAttempts < this.maxErrorRecoveryAttempts) {
        this.errorRecoveryAttempts++;
        this.isInErrorRecovery = true;
        setTimeout(() => this.drawTree(), 100);
        return;
      }
    }

    // If sanitization fails, display error message
    this.displayErrorMessage('Invalid tree data structure. Please check your data format.');
  }

  /**
   * Handle oversized trees that don't fit in canvas
   * Implements fallback strategies for extremely wide trees
   * @param dimensions - Tree dimensions that are too large
   * @param canvas - Canvas element
   */
  private handleOversizedTree(
    dimensions: { width: number; height: number; levelWidths: Map<number, number> },
    canvas: HTMLCanvasElement
  ): void {
    console.warn('Oversized tree detected, applying fallback strategies...');

    try {
      // Strategy 1: Apply emergency scaling
      const emergencyScale = this.calculateEmergencyScale(dimensions, canvas);

      if (emergencyScale > 0 && emergencyScale < 1) {
        console.log(`Applying emergency scale: ${emergencyScale}`);

        // Save current scale and apply emergency scale
        const originalScale = this.scale;
        this.scale = emergencyScale;

        // Recalculate dimensions with emergency scale
        const scaledDimensions = {
          width: dimensions.width * emergencyScale,
          height: dimensions.height * emergencyScale,
          levelWidths: new Map(Array.from(dimensions.levelWidths).map(([level, width]) =>
            [level, width * emergencyScale]
          ))
        };

        // Validate scaled dimensions
        if (this.validateTreeDimensions(scaledDimensions, canvas)) {
          // Reset view to accommodate scaled tree
          this.resetViewForOversizedTree(canvas);

          // Continue with scaled rendering
          this.drawTreeWithFallbackScale(scaledDimensions, canvas);
          return;
        } else {
          // Restore original scale if scaling didn't work
          this.scale = originalScale;
        }
      }

      // Strategy 2: Enable horizontal scrolling mode
      this.enableHorizontalScrollingMode(dimensions, canvas);

    } catch (error) {
      console.error('Error in oversized tree handling:', error);
      this.handleRenderingError(error);
    }
  }

  /**
   * Handle general rendering errors with recovery mechanisms
   * Provides multiple fallback strategies for layout calculation failures
   * @param error - The error that occurred during rendering
   */
  private handleRenderingError(error: any): void {
    console.error('Rendering error occurred:', error);

    // Prevent infinite error loops
    if (this.isInErrorRecovery && this.errorRecoveryAttempts >= this.maxErrorRecoveryAttempts) {
      console.error('Maximum error recovery attempts reached, displaying error message');
      this.displayErrorMessage('Unable to render tree diagram. Please try refreshing the page.');
      return;
    }

    const errorMessage = error?.message || error?.toString() || 'Unknown error';

    // Check if this is the same error as before to prevent loops
    if (this.lastErrorState === errorMessage) {
      this.errorRecoveryAttempts++;
    } else {
      this.errorRecoveryAttempts = 1;
      this.lastErrorState = errorMessage;
    }

    this.isInErrorRecovery = true;

    // Recovery Strategy 1: Clear caches and retry
    if (this.errorRecoveryAttempts === 1) {
      console.log('Recovery attempt 1: Clearing caches and retrying...');
      this.clearAllCaches();
      setTimeout(() => this.drawTree(), 200);
      return;
    }

    // Recovery Strategy 2: Reset to default settings and retry
    if (this.errorRecoveryAttempts === 2) {
      console.log('Recovery attempt 2: Resetting to default settings...');
      this.resetToDefaultSettings();
      setTimeout(() => this.drawTree(), 300);
      return;
    }

    // Recovery Strategy 3: Use minimal rendering mode
    if (this.errorRecoveryAttempts === 3) {
      console.log('Recovery attempt 3: Using minimal rendering mode...');
      this.enableMinimalRenderingMode();
      setTimeout(() => this.drawTree(), 400);
      return;
    }

    // Final fallback: Display error message
    this.displayErrorMessage('Tree rendering failed. Please check your data or try refreshing the page.');
  }

  /**
   * Sanitize tree data to fix common issues
   * Attempts to repair malformed tree data where possible
   * @param person - Root person node to sanitize
   * @returns Sanitized person data or null if cannot be fixed
   */
  private sanitizeTreeData(person: Person | null): Person | null {
    if (!person) return null;

    try {
      const sanitized: Person = {
        id: person.id || `node-${Date.now()}`,
        name: person.name || 'Unknown',
        children: []
      };

      // Sanitize children if they exist
      if (person.children && Array.isArray(person.children)) {
        const validChildren: Person[] = [];
        const seenIds = new Set<string>();

        for (let i = 0; i < person.children.length && i < this.maxNodesPerLevel; i++) {
          const child = person.children[i];
          if (child && typeof child === 'object') {
            const sanitizedChild = this.sanitizeTreeData(child);
            if (sanitizedChild && !seenIds.has(sanitizedChild.id)) {
              seenIds.add(sanitizedChild.id);
              validChildren.push(sanitizedChild);
            }
          }
        }

        sanitized.children = validChildren;
      }

      return sanitized;
    } catch (error) {
      console.error('Error during tree data sanitization:', error);
      return null;
    }
  }

  /**
   * Calculate emergency scale for oversized trees
   * Determines the minimum scale needed to fit tree in canvas
   * @param dimensions - Tree dimensions
   * @param canvas - Canvas element
   * @returns Emergency scale factor
   */
  private calculateEmergencyScale(
    dimensions: { width: number; height: number },
    canvas: HTMLCanvasElement
  ): number {
    const availableWidth = canvas.width * 0.9; // Leave 10% margin
    const availableHeight = canvas.height * 0.9;

    const scaleX = availableWidth / dimensions.width;
    const scaleY = availableHeight / dimensions.height;

    // Use the smaller scale to ensure both dimensions fit
    const emergencyScale = Math.min(scaleX, scaleY);

    // Ensure scale is not too small to be useful
    return Math.max(this.emergencyFallbackScale, emergencyScale);
  }

  /**
   * Reset view settings for oversized tree handling
   * Adjusts view parameters to accommodate large trees
   * @param canvas - Canvas element
   */
  private resetViewForOversizedTree(canvas: HTMLCanvasElement): void {
    // Reset to center view
    this.offsetX = canvas.width * 0.05;
    this.offsetY = canvas.height * 0.05;

    // Ensure minimum scale for visibility
    if (this.scale < this.emergencyFallbackScale) {
      this.scale = this.emergencyFallbackScale;
    }
  }

  /**
   * Draw tree with fallback scale for oversized trees
   * Renders tree using emergency scaling with simplified layout
   * @param dimensions - Scaled tree dimensions
   * @param canvas - Canvas element
   */
  private drawTreeWithFallbackScale(
    dimensions: { width: number; height: number; levelWidths: Map<number, number> },
    canvas: HTMLCanvasElement
  ): void {
    try {
      // Use simplified rendering for oversized trees
      this.ctx.save();
      this.ctx.translate(this.offsetX, this.offsetY);
      this.ctx.scale(this.scale, this.scale);

      // Calculate start position
      const startX = Math.max(10, (canvas.width / this.scale - dimensions.width) / 2);

      // Draw with simplified layout
      this.drawNodeWithSimplifiedLayout(this.personData!, startX, 50, 0);

      this.ctx.restore();

      // Display warning message about scaling
      this.displayWarningMessage('Tree has been scaled down to fit. Use zoom controls to explore details.');

    } catch (error) {
      console.error('Error in fallback scale rendering:', error);
      throw error; // Re-throw to trigger further error handling
    }
  }

  /**
   * Enable horizontal scrolling mode for very wide trees
   * Allows horizontal navigation of trees that exceed canvas width
   * @param dimensions - Tree dimensions
   * @param canvas - Canvas element
   */
  private enableHorizontalScrollingMode(
    dimensions: { width: number; height: number },
    canvas: HTMLCanvasElement
  ): void {
    console.log('Enabling horizontal scrolling mode for wide tree');

    // Adjust scale to fit height while allowing horizontal scrolling
    const heightScale = (canvas.height * 0.9) / dimensions.height;
    this.scale = Math.min(1, heightScale);

    // Reset vertical position to show from top
    this.offsetY = canvas.height * 0.05;

    // Set horizontal position to show left side initially
    this.offsetX = canvas.width * 0.02;

    // Display instruction message
    this.displayInfoMessage('Tree is very wide. Use pan gestures or drag to explore horizontally.');

    // Continue with normal rendering
    try {
      this.drawTreeWithHorizontalScrolling(canvas);
    } catch (error) {
      console.error('Error in horizontal scrolling mode:', error);
      this.handleRenderingError(error);
    }
  }

  /**
   * Draw tree with horizontal scrolling support
   * Renders tree optimized for horizontal navigation
   * @param canvas - Canvas element
   */
  private drawTreeWithHorizontalScrolling(canvas: HTMLCanvasElement): void {
    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);

    // Use simplified layout for horizontal scrolling
    const startX = 50; // Fixed start position for scrolling
    this.drawNodeWithSimplifiedLayout(this.personData!, startX, 50, 0);

    this.ctx.restore();
  }

  /**
   * Draw node with simplified layout for error recovery
   * Uses basic layout without advanced features for reliability
   * @param person - Person node to draw
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param level - Tree level
   * @returns Width of drawn content
   */
  private drawNodeWithSimplifiedLayout(person: Person, x: number, y: number, level: number): number {
    if (!person || level > 10) return this.nodeWidth; // Limit depth for safety

    // Draw node with basic styling
    this.ctx.fillStyle = level === 0 ? this.rootNodeColor : this.nodeColor;
    this.ctx.strokeStyle = this.lineColor;
    this.ctx.lineWidth = 1;

    // Simple rectangle instead of rounded
    this.ctx.fillRect(x, y, this.nodeWidth, this.nodeHeight);
    this.ctx.strokeRect(x, y, this.nodeWidth, this.nodeHeight);

    // Draw text
    this.ctx.fillStyle = this.textColor;
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(person.id, x + this.nodeWidth / 2, y + 20);
    this.ctx.fillText(person.name, x + this.nodeWidth / 2, y + 35);

    // Draw children with basic spacing
    if (person.children && person.children.length > 0) {
      const childY = y + this.nodeHeight + 60;
      const spacing = Math.max(this.minHorizontalSpacing, 40);
      const totalWidth = person.children.length * this.nodeWidth + (person.children.length - 1) * spacing;
      let childX = x + (this.nodeWidth - totalWidth) / 2;

      // Draw simple connections
      const parentCenterX = x + this.nodeWidth / 2;
      this.ctx.strokeStyle = this.lineColor;
      this.ctx.lineWidth = 1;

      person.children.forEach((child, index) => {
        const childCenterX = childX + this.nodeWidth / 2;

        // Simple line connection
        this.ctx.beginPath();
        this.ctx.moveTo(parentCenterX, y + this.nodeHeight);
        this.ctx.lineTo(childCenterX, childY);
        this.ctx.stroke();

        // Draw child
        this.drawNodeWithSimplifiedLayout(child, childX, childY, level + 1);
        childX += this.nodeWidth + spacing;
      });

      return Math.max(this.nodeWidth, totalWidth);
    }

    return this.nodeWidth;
  }

  /**
   * Clear all caches for error recovery
   * Resets all cached data to force fresh calculations
   */
  private clearAllCaches(): void {
    this.renderCache.clear();
    this.nodeBoundingBoxes.clear();
    this.levelNodeCounts.clear();
    this.layoutConfig.levelBasedSpacing.clear();
    this.lastTreeHash = '';
  }

  /**
   * Reset to default settings for error recovery
   * Restores component to initial state
   */
  private resetToDefaultSettings(): void {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.clearAllCaches();

    // Reset layout configuration
    this.layoutConfig = {
      minHorizontalSpacing: this.minHorizontalSpacing,
      maxHorizontalSpacing: this.maxHorizontalSpacing,
      verticalSpacing: this.verticalSpacing,
      nodeWidth: this.nodeWidth,
      nodeHeight: this.nodeHeight,
      adaptiveSpacing: this.adaptiveSpacing,
      connectionLineBuffer: this.connectionLineBuffer,
      levelBasedSpacing: new Map<number, number>()
    };
  }

  /**
   * Enable minimal rendering mode for error recovery
   * Uses most basic rendering approach for maximum reliability
   */
  private enableMinimalRenderingMode(): void {
    // Disable performance optimizations that might cause issues
    this.isLargeTree = false;

    // Use conservative settings
    this.scale = 0.5;
    this.offsetX = 50;
    this.offsetY = 50;

    this.clearAllCaches();
  }

  /**
   * Reset error recovery state after successful render
   * Clears error tracking variables
   */
  private resetErrorRecoveryState(): void {
    this.errorRecoveryAttempts = 0;
    this.lastErrorState = null;
    this.isInErrorRecovery = false;
  }

  /**
   * Display error message to user
   * Shows error information in the canvas area
   * @param message - Error message to display
   */
  private displayErrorMessage(message: string): void {
    if (!this.ctx) return;

    const canvas = this.canvasRef.nativeElement;

    // Clear canvas
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw error message
    this.ctx.fillStyle = '#dc3545';
    this.ctx.font = 'bold 16px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Error', canvas.width / 2, canvas.height / 2 - 20);

    this.ctx.fillStyle = '#6c757d';
    this.ctx.font = '14px Arial';
    this.ctx.fillText(message, canvas.width / 2, canvas.height / 2 + 10);

    // Add retry instruction
    this.ctx.fillStyle = '#007bff';
    this.ctx.font = '12px Arial';
    this.ctx.fillText('Try refreshing the page or check your data', canvas.width / 2, canvas.height / 2 + 40);
  }

  /**
   * Display warning message to user
   * Shows warning information overlay
   * @param message - Warning message to display
   */
  private displayWarningMessage(message: string): void {
    // This could be enhanced to show a temporary overlay
    console.warn('Tree Warning:', message);

    // For now, just log to console
    // In a real implementation, you might show a toast notification
  }

  /**
   * Display info message to user
   * Shows informational message
   * @param message - Info message to display
   */
  private displayInfoMessage(message: string): void {
    // This could be enhanced to show a temporary overlay
    console.info('Tree Info:', message);

    // For now, just log to console
    // In a real implementation, you might show a toast notification
  }
}
