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
    
    // Set initial cursor style for desktop
    if (window.innerWidth > 576) {
      canvas.style.cursor = 'grab';
    }
    
    // Add a small delay to ensure the canvas is properly sized before drawing
    setTimeout(() => {
      // Draw the tree when data is available
      if (this.personData) {
        this.drawTree();
      }
    }, 100);
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
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
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
  
  // Touch event handlers for mobile devices
  private lastTouchDistance: number = 0;
  
  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    if (!this.isBrowser) return;
    event.preventDefault();
    
    if (event.touches.length === 1) {
      // Single touch - panning
      this.isDragging = true;
      this.lastX = event.touches[0].clientX;
      this.lastY = event.touches[0].clientY;
    } else if (event.touches.length === 2) {
      // Two touches - pinch to zoom
      this.isDragging = false;
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      this.lastTouchDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
    }
  }
  
  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (!this.isBrowser) return;
    event.preventDefault();
    
    if (event.touches.length === 1 && this.isDragging) {
      // Single touch - panning
      const deltaX = event.touches[0].clientX - this.lastX;
      const deltaY = event.touches[0].clientY - this.lastY;
      
      this.offsetX += deltaX;
      this.offsetY += deltaY;
      
      this.lastX = event.touches[0].clientX;
      this.lastY = event.touches[0].clientY;
      
      this.drawTree();
    } else if (event.touches.length === 2) {
      // Two touches - pinch to zoom
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      // Calculate current distance between touches
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      // Calculate zoom factor based on the change in distance
      if (this.lastTouchDistance > 0) {
        const zoomFactor = currentDistance / this.lastTouchDistance;
        
        // Apply zoom if it's within reasonable limits
        const newScale = this.scale * zoomFactor;
        if (newScale >= 0.2 && newScale <= 5) {
          // Calculate the midpoint between the two touches
          const midX = (touch1.clientX + touch2.clientX) / 2;
          const midY = (touch1.clientY + touch2.clientY) / 2;
          
          // Get canvas position
          const rect = this.canvasRef.nativeElement.getBoundingClientRect();
          
          // Calculate position relative to canvas
          const canvasMidX = midX - rect.left;
          const canvasMidY = midY - rect.top;
          
          // Calculate world position before zoom
          const worldX = (canvasMidX - this.offsetX) / this.scale;
          const worldY = (canvasMidY - this.offsetY) / this.scale;
          
          // Update scale
          this.scale = newScale;
          
          // Update offset to zoom at the midpoint between touches
          this.offsetX = canvasMidX - worldX * this.scale;
          this.offsetY = canvasMidY - worldY * this.scale;
          
          this.drawTree();
        }
      }
      
      this.lastTouchDistance = currentDistance;
    }
  }
  
  @HostListener('touchend')
  @HostListener('touchcancel')
  onTouchEnd(): void {
    if (!this.isBrowser) return;
    this.isDragging = false;
    this.lastTouchDistance = 0;
  }
  
  private resizeCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement;
    
    if (container) {
      // Set canvas dimensions to match container
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      // For mobile devices, ensure minimum dimensions
      if (window.innerWidth <= 576 && this.scale === 1) {
        // Set initial scale for small screens to show more of the tree
        this.scale = 0.6;
        
        // Set initial offset to center the tree better on small screens
        this.offsetX = canvas.width / 4;
        this.offsetY = 20;
      }
    }
  }
  
  private drawTree(): void {
    if (!this.isBrowser || !this.ctx || !this.personData) return;
    
    const canvas = this.canvasRef.nativeElement;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save current state
    this.ctx.save();
    
    // Apply transformations
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);
    
    // Calculate tree dimensions
    const treeDimensions = this.calculateTreeDimensions(this.personData);
    
    // Center the tree horizontally
    const startX = (canvas.width / this.scale - treeDimensions.width) / 2;
    
    // For mobile devices, ensure the tree is visible initially
    if (window.innerWidth <= 576 && Math.abs(this.offsetX) < 10 && Math.abs(this.offsetY) < 10) {
      // This is likely the first draw on mobile, adjust position to show more of the tree
      this.offsetX = canvas.width / 4;
      this.scale = 0.5;
      this.ctx.translate(this.offsetX, this.offsetY);
      this.ctx.scale(this.scale, this.scale);
    }
    
    // Draw from root node
    this.drawNode(this.personData, startX, 50, 0, treeDimensions);
    
    // Restore state
    this.ctx.restore();
  }
  
  private calculateTreeDimensions(person: Person): { width: number, height: number, levelWidths: Map<number, number> } {
    const levelWidths = new Map<number, number>();
    const levelCounts = new Map<number, number>();
    
    // Reset levelNodeCounts for tracking nodes per level for spacing calculations
    this.levelNodeCounts.clear();
    
    // Calculate width needed for each level
    const calculateLevelWidths = (node: Person, level: number): void => {
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
    
    // Calculate total width and height using adaptive spacing
    let maxWidth = 0;
    let maxLevel = 0;
    
    levelCounts.forEach((count, level) => {
      // Use adaptive spacing calculations for dynamic spacing
      const adaptiveSpacing = this.calculateAdaptiveSpacing(level, count);
      
      // Calculate level width with adaptive spacing to prevent overlapping
      const levelWidth = count * this.nodeWidth + (count - 1) * adaptiveSpacing;
      
      // Ensure minimum spacing requirements are met to prevent overlapping
      const minRequiredWidth = count * this.nodeWidth + (count - 1) * this.minHorizontalSpacing;
      const finalLevelWidth = Math.max(levelWidth, minRequiredWidth);
      
      levelWidths.set(level, finalLevelWidth);
      maxWidth = Math.max(maxWidth, finalLevelWidth);
      maxLevel = Math.max(maxLevel, level);
    });
    
    const height = (maxLevel + 1) * (this.nodeHeight + this.verticalSpacing);
    
    return { width: maxWidth, height, levelWidths };
  }
  
  private drawNode(person: Person, x: number, y: number, level: number, dimensions: { width: number, levelWidths: Map<number, number> }): number {
    if (!person) return 0;
    
    const isRoot = level === 0;
    // const levelWidth = dimensions.levelWidths.get(level) || 0;
    
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
    
    // Use adaptive spacing for children positioning to prevent overlapping
    const adaptiveSpacing = this.calculateAdaptiveSpacing(nextLevel, childrenCount);
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
      // Use adaptive spacing for consistent positioning
      drawChildX += childWidth + adaptiveSpacing;
    });
    
    return Math.max(this.nodeWidth, childrenWidth);
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
      this.drawMultipleChildrenConnections(parentX, connectorY, childPositions, childTopY);
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
   * @param parentX - Parent center X coordinate
   * @param connectorY - Y coordinate for horizontal connector
   * @param childPositions - Array of child center X coordinates
   * @param childTopY - Child top Y coordinate
   */
  private drawMultipleChildrenConnections(
    parentX: number, 
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

  /**
   * Helper method for drawing clean horizontal line segments
   * Specialized for horizontal connections with precise positioning
   * @param startX - Start X coordinate
   * @param endX - End X coordinate
   * @param y - Y coordinate for the horizontal line
   */
  private drawHorizontalLine(startX: number, endX: number, y: number): void {
    this.drawPreciseLine(startX, y, endX, y);
  }

  /**
   * Helper method for drawing clean vertical line segments
   * Specialized for vertical connections with precise positioning
   * @param x - X coordinate for the vertical line
   * @param startY - Start Y coordinate
   * @param endY - End Y coordinate
   */
  private drawVerticalLine(x: number, startY: number, endY: number): void {
    this.drawPreciseLine(x, startY, x, endY);
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
