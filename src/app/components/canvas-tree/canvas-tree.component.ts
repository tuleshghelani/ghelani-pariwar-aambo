import { Component, Input, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef, OnChanges, SimpleChanges, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Person } from '../../models/person.model';
import { CanvasTreeService, TreeLayoutConfig, TreeBounds } from '../../services/canvas-tree.service';

export interface TreeNode {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
  children: TreeNode[];
  parent?: TreeNode;
  isRoot: boolean;
  isLeaf: boolean;
}

export interface TreeConnection {
  from: TreeNode;
  to: TreeNode;
  path: string;
}

@Component({
  selector: 'app-canvas-tree',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './canvas-tree.component.html',
  styleUrls: ['./canvas-tree.component.scss']
})
export class CanvasTreeComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @Input() personData: Person | null = null;
  @Input() nodeShape: 'square' | 'mango' = 'square';
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('container', { static: false }) containerRef!: ElementRef<HTMLDivElement>;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number | null = null;
  private isDragging = false;
  private isTouchDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private pinchStartDistance = 0;
  private pinchStartZoom = 1;
  private pinchCenterX = 0;
  private pinchCenterY = 0;
  zoom = 1;
  isFullscreen = false;
  isMenuOpen = true;
  private menuTimeoutId: any;
  private minZoom = 0.1;
  private maxZoom = 3;
  private panX = 0;
  private panY = 0;
  private treeNodes: TreeNode[] = [];
  private connections: TreeConnection[] = [];
  private hoveredNode: TreeNode | null = null;
  private selectedNode: TreeNode | null = null;
  private treeBounds: TreeBounds | null = null;

  // Canvas dimensions
  private canvasWidth = 0;
  private canvasHeight = 0;

  // Layout configuration
  private layoutConfig: TreeLayoutConfig = {
    nodeWidth: 120,
    nodeHeight: 60,
    levelSpacing: 160, // Default larger spacing to handle mango
    siblingSpacing: 160,
    minCanvasWidth: 800,
    minCanvasHeight: 600
  };

  // Performance optimization
  private renderRequested = false;
  private lastRenderTime = 0;
  private readonly minRenderInterval = 16; // ~60fps

  constructor(
    private cdr: ChangeDetectorRef,
    private canvasTreeService: CanvasTreeService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (this.personData) {
      this.buildTreeStructure();
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Adjust node sizes for small screens
      if (window.matchMedia && window.matchMedia('(max-width: 767px)').matches) {
        this.layoutConfig = {
          ...this.layoutConfig,
          nodeWidth: 150,
          nodeHeight: 72,
          levelSpacing: this.nodeShape === 'mango' ? 180 : 140,
          siblingSpacing: 180
        };
        if (this.personData) {
          this.buildTreeStructure();
        }
      }
      this.initializeCanvas();
      this.setupEventListeners();
      this.render();
      this.resetMenuTimeout(); // Auto-close menu after 3 seconds initially
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    let shouldRebuild = false;

    if (changes['nodeShape']) {
      // Update spacing based on shape
      const isMobile = isPlatformBrowser(this.platformId) && window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
      this.layoutConfig.levelSpacing = this.nodeShape === 'mango' ? (isMobile ? 180 : 160) : (isMobile ? 140 : 120);
      shouldRebuild = true;
    }

    if (changes['personData']) {
      shouldRebuild = true;
    }

    if (shouldRebuild && this.personData) {
      this.buildTreeStructure();
      if (isPlatformBrowser(this.platformId) && this.canvas) {
        this.centerTree();
        this.render();
      }
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.cleanup();
    }
  }

  private initializeCanvas(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.updateCanvasSize();
    this.centerTree();
  }

  private updateCanvasSize(): void {
    const container = this.containerRef.nativeElement;
    this.canvasWidth = container.clientWidth;
    this.canvasHeight = container.clientHeight;
    
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    
    // Set device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.canvasWidth * dpr;
    this.canvas.height = this.canvasHeight * dpr;
    this.ctx.scale(dpr, dpr);
    this.canvas.style.width = this.canvasWidth + 'px';
    this.canvas.style.height = this.canvasHeight + 'px';
  }

  private buildTreeStructure(): void {
    if (!this.personData) return;

    // Use service to build tree structure
    const treeData = this.canvasTreeService.buildTreeStructure(this.personData, this.layoutConfig);
    
    this.treeNodes = treeData.nodes;
    this.connections = treeData.connections;
    this.treeBounds = treeData.bounds;

    // Check performance recommendations
    const stats = this.canvasTreeService.getTreeStatistics(this.treeNodes);
    const recommendations = this.canvasTreeService.getPerformanceRecommendations(stats.totalNodes);
    
    if (recommendations.shouldUseVirtualization) {
      console.warn(`Large tree detected (${stats.totalNodes} nodes). Consider implementing virtualization for better performance.`);
    }
  }


  private centerTree(): void {
    if (this.treeNodes.length === 0 || !this.treeBounds) return;

    // Center tree in canvas using service
    this.canvasTreeService.centerTreeInCanvas(this.treeNodes, this.canvasWidth, this.canvasHeight);
    
    // Reset pan and zoom
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
  }

  private render(): void {
    if (!this.ctx || this.renderRequested) return;

    const now = performance.now();
    if (now - this.lastRenderTime < this.minRenderInterval) {
      this.renderRequested = true;
      requestAnimationFrame(() => {
        this.renderRequested = false;
        this.render();
      });
      return;
    }

    this.lastRenderTime = now;

    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    // Save context
    this.ctx.save();
    
    // Apply transformations
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    // Render connections first (behind nodes)
    this.renderConnections();
    
    // Render nodes
    this.renderNodes();

    // Restore context
    this.ctx.restore();
  }

  private renderConnections(): void {
    // use theme primary color
    const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#17a3de';
    this.ctx.strokeStyle = primary;
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';

    this.connections.forEach(connection => {
      this.ctx.beginPath();
      
      let startX: number, startY: number, endX: number, endY: number;

      if (this.nodeShape === 'mango') {
        const s = 0.70; // Scaled down matching the new smaller mango shape
        const fromCx = connection.from.x + connection.from.width / 2;
        const fromCy = connection.from.y + connection.from.height / 2;
        const toCx = connection.to.x + connection.to.width / 2;
        const toCy = connection.to.y + connection.to.height / 2;
        
        // Parent beak coordinates
        startX = fromCx + 5 * s;
        startY = fromCy + 90 * s;
        
        // Child stem coordinates
        endX = toCx + 10 * s;
        endY = toCy - 60 * s;
      } else {
        startX = connection.from.x + connection.from.width / 2;
        startY = connection.from.y + connection.from.height;
        endX = connection.to.x + connection.to.width / 2;
        endY = connection.to.y;
      }

      this.ctx.moveTo(startX, startY);
      
      const midY = (startY + endY) / 2;
      
      // Use cubic bezier for perfect vertical entry/exit lines
      this.ctx.bezierCurveTo(
        startX, midY,
        endX, midY,
        endX, endY
      );
      
      this.ctx.stroke();
    });
  }

  private renderNodes(): void {
    this.treeNodes.forEach(node => {
      this.renderNode(node);
    });
  }

  private renderNode(node: TreeNode): void {
    const x = node.x;
    const y = node.y;
    const width = node.width;
    const height = node.height;

    // Read theme colors
    const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#17a3de';
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#a1a1a6';
    const white = getComputedStyle(document.documentElement).getPropertyValue('--white-color').trim() || '#ffffff';
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || '#4a4a4a';

    this.ctx.save();

    if (this.nodeShape === 'mango') {
      this.drawMangoShape(x, y, width, height, node, primary, accent);
    } else {
      // Node background
      this.ctx.fillStyle = this.getNodeColor(node, primary);
      this.ctx.fillRect(x, y, width, height);

      // Node border
      this.ctx.strokeStyle = this.getNodeBorderColor(node, accent, primary);
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, width, height);
    }

    const fontSize = this.nodeShape === 'mango' ? '12px' : '13px'; // Slightly smaller font for smaller mango
    this.ctx.font = `bold ${fontSize} ${getComputedStyle(document.documentElement).getPropertyValue('--font-primary').trim() || 'Outfit, sans-serif'}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Split long names
    const words = node.name.split(' ');
    const lineHeight = this.nodeShape === 'mango' ? 14 : 16; // Tighter line height
    const startY = y + height / 2 - (words.length - 1) * lineHeight / 2 + (this.nodeShape === 'mango' ? 2 : 0);

    // Draw text background pill for mango to ensure overflow visibility
    if (this.nodeShape === 'mango') {
      let maxWordWidth = 0;
      words.forEach(w => {
        const wWidth = this.ctx.measureText(w).width;
        if (wWidth > maxWordWidth) maxWordWidth = wWidth;
      });
      
      const paddingX = 8;
      const paddingY = 4;
      const pillWidth = maxWordWidth + paddingX * 2;
      const pillHeight = words.length * lineHeight + paddingY * 2 - (lineHeight - 12);
      
      const pillX = x + width / 2 - pillWidth / 2;
      const pillY = startY - lineHeight / 2 - paddingY + 1;

      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'; // Muted elegant dark overlay
      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
      
      const r = 6;
      this.ctx.beginPath();
      this.ctx.moveTo(pillX + r, pillY);
      this.ctx.lineTo(pillX + pillWidth - r, pillY);
      this.ctx.quadraticCurveTo(pillX + pillWidth, pillY, pillX + pillWidth, pillY + r);
      this.ctx.lineTo(pillX + pillWidth, pillY + pillHeight - r);
      this.ctx.quadraticCurveTo(pillX + pillWidth, pillY + pillHeight, pillX + pillWidth - r, pillY + pillHeight);
      this.ctx.lineTo(pillX + r, pillY + pillHeight);
      this.ctx.quadraticCurveTo(pillX, pillY + pillHeight, pillX, pillY + pillHeight - r);
      this.ctx.lineTo(pillX, pillY + r);
      this.ctx.quadraticCurveTo(pillX, pillY, pillX + r, pillY);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();

      // Premium white text
      this.ctx.fillStyle = '#ffffff'; 
      this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
      this.ctx.shadowBlur = 3;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 1;
    } else {
      this.ctx.fillStyle = white;
    }

    words.forEach((word, index) => {
      this.ctx.fillText(word, x + width / 2, startY + index * lineHeight);
    });

    this.ctx.restore();

    // Level indicator
    this.ctx.fillStyle = textColor;
    this.ctx.font = `10px ${getComputedStyle(document.documentElement).getPropertyValue('--font-secondary').trim() || 'Quicksand, sans-serif'}`;
    // this.ctx.fillText(`Level ${node.level}`, x + width / 2, y + height - 8);
  }

  private drawMangoShape(x: number, y: number, width: number, height: number, node: TreeNode, primary: string, accent: string): void {
    const isHovered = node === this.hoveredNode;
    const isSelected = node === this.selectedNode;

    this.ctx.save();
    
    // Center of the node
    const cx = x + width / 2;
    const cy = y + height / 2;
    this.ctx.translate(cx, cy);

    // Optimized size multiplier for graceful proportions without overlapping siblings
    const s = 0.70; // Decreased to ensure safe spacing and readable lines

    // Add a subtle drop shadow for premium look
    this.ctx.shadowColor = 'rgba(0,0,0,0.25)';
    this.ctx.shadowBlur = 12;
    this.ctx.shadowOffsetY = 6;
    this.ctx.shadowOffsetX = 3;

    // Draw leaf
    this.ctx.beginPath();
    this.ctx.moveTo(10 * s, -60 * s); // stem connection
    // Leaf curving top-left
    this.ctx.bezierCurveTo(-5 * s, -75 * s, -30 * s, -80 * s, -40 * s, -60 * s);
    this.ctx.bezierCurveTo(-25 * s, -55 * s, -10 * s, -55 * s, 10 * s, -60 * s);
    this.ctx.fillStyle = isSelected ? '#33691E' : '#4CAF50'; // deep vivid green
    this.ctx.fill();
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = '#1B5E20';
    this.ctx.stroke();

    // Draw mango body (Perfectly calculated C1-continuous Paisley/Mango shape)
    this.ctx.beginPath();
    this.ctx.moveTo(10 * s, -60 * s); // top stem area
    
    // Convex right cheek
    this.ctx.bezierCurveTo(60 * s, -60 * s, 70 * s, -10 * s, 50 * s, 30 * s);
    
    // Concave right tuck dropping to the beak (S-curve)
    this.ctx.bezierCurveTo(35 * s, 60 * s, 25 * s, 80 * s, 5 * s, 90 * s);
    
    // Bottom rounding of the beak (sharp but round tip)
    this.ctx.bezierCurveTo(-10 * s, 95 * s, -25 * s, 85 * s, -25 * s, 70 * s);
    
    // C-curve left belly sweeping out and up massively
    this.ctx.bezierCurveTo(-25 * s, 40 * s, -70 * s, 10 * s, -50 * s, -30 * s);
    
    // Top left shoulder back to stem
    this.ctx.bezierCurveTo(-40 * s, -55 * s, -15 * s, -60 * s, 10 * s, -60 * s);
    this.ctx.closePath();

    // Create realistic mango gradient
    // Center of gradient offset to upper-left belly to simulate 3D lighting
    const gradient = this.ctx.createRadialGradient(-20 * s, -20 * s, 5 * s, 0, 0, 80 * s);
    
    if (isSelected || isHovered) {
      gradient.addColorStop(0, '#EEFF41'); // bright lime highlight
      gradient.addColorStop(0.15, '#FFF59D'); // light yellow
      gradient.addColorStop(0.4, '#FFC107'); // yellow
      gradient.addColorStop(0.7, '#e69925ff'); // orange
      gradient.addColorStop(1, '#E65100'); // deep dark orange boundary
    } else {
      gradient.addColorStop(0, '#D4E157'); // lime green highlight
      gradient.addColorStop(0.15, '#FFE082'); // light yellow
      gradient.addColorStop(0.4, '#FFCA28'); // mango yellow
      gradient.addColorStop(0.7, '#F57C00'); // orange
      gradient.addColorStop(1, '#E65100'); // rich reddish/brown edge for depth
    }

    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    // Border
    this.ctx.strokeStyle = isSelected ? primary : (isHovered ? accent : '#E65100');
    this.ctx.lineWidth = isSelected ? 3 : 1.5;
    this.ctx.shadowColor = 'transparent'; // Remove shadow for stroke
    this.ctx.stroke();

    this.ctx.restore();
  }

  private getNodeColor(node: TreeNode, primary: string): string {
    if (node.isRoot) return primary;
    if (node.isLeaf) return 'rgba(23, 163, 222, 0.7)';
    return 'rgba(23, 163, 222, 0.5)';
  }

  private getNodeBorderColor(node: TreeNode, accent: string, primary: string): string {
    if (node === this.hoveredNode) return accent;
    if (node === this.selectedNode) return primary;
    return accent;
  }

  private setupEventListeners(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.onWheel.bind(this));
    this.canvas.addEventListener('click', this.onClick.bind(this));
    // Touch events for mobile
    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false } as AddEventListenerOptions);
    this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false } as AddEventListenerOptions);
    this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
    
    window.addEventListener('resize', this.onResize.bind(this));
    document.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isFullscreen) {
      this.toggleFullscreen();
    }
  }

  private onMouseDown(event: MouseEvent): void {
    this.isDragging = true;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.canvas.style.cursor = 'grabbing';
  }

  private onMouseMove(event: MouseEvent): void {
    if (this.isDragging) {
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;
      
      this.panX += deltaX;
      this.panY += deltaY;
      
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      
      this.render();
    } else {
      // Check for hover
      const mousePos = this.getMousePosition(event);
      const hoveredNode = this.getNodeAtPosition(mousePos.x, mousePos.y);
      
      if (hoveredNode !== this.hoveredNode) {
        this.hoveredNode = hoveredNode;
        this.canvas.style.cursor = hoveredNode ? 'pointer' : 'grab';
        this.render();
      }
    }
  }

  private onMouseUp(): void {
    this.isDragging = false;
    this.canvas.style.cursor = 'grab';
  }

  // Touch support
  private onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      // One finger: start panning
      this.isTouchDragging = true;
      this.lastMouseX = event.touches[0].clientX;
      this.lastMouseY = event.touches[0].clientY;
    } else if (event.touches.length === 2) {
      // Two fingers: start pinch zoom
      event.preventDefault();
      const [t1, t2] = [event.touches[0], event.touches[1]];
      this.pinchStartDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      this.pinchStartZoom = this.zoom;
      this.pinchCenterX = (t1.clientX + t2.clientX) / 2;
      this.pinchCenterY = (t1.clientY + t2.clientY) / 2;
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (event.touches.length === 1 && this.isTouchDragging) {
      event.preventDefault();
      const touch = event.touches[0];
      const deltaX = touch.clientX - this.lastMouseX;
      const deltaY = touch.clientY - this.lastMouseY;
      this.panX += deltaX;
      this.panY += deltaY;
      this.lastMouseX = touch.clientX;
      this.lastMouseY = touch.clientY;
      this.render();
    } else if (event.touches.length === 2) {
      // Pinch zoom
      event.preventDefault();
      const [t1, t2] = [event.touches[0], event.touches[1]];
      const newDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (this.pinchStartDistance > 0) {
        const scale = newDistance / this.pinchStartDistance;
        const targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.pinchStartZoom * scale));
        const rect = this.canvas.getBoundingClientRect();
        const centerX = this.pinchCenterX - rect.left;
        const centerY = this.pinchCenterY - rect.top;
        const zoomRatio = targetZoom / this.zoom;
        this.panX = centerX - (centerX - this.panX) * zoomRatio;
        this.panY = centerY - (centerY - this.panY) * zoomRatio;
        this.zoom = targetZoom;
        this.render();
      }
    }
  }

  private onTouchEnd(): void {
    this.isTouchDragging = false;
    this.pinchStartDistance = 0;
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));
    
    if (newZoom !== this.zoom) {
      const zoomRatio = newZoom / this.zoom;
      
      this.panX = mouseX - (mouseX - this.panX) * zoomRatio;
      this.panY = mouseY - (mouseY - this.panY) * zoomRatio;
      this.zoom = newZoom;
      
      this.render();
    }
  }

  private onClick(event: MouseEvent): void {
    if (this.isDragging) return;
    
    const mousePos = this.getMousePosition(event);
    const clickedNode = this.getNodeAtPosition(mousePos.x, mousePos.y);
    
    if (clickedNode) {
      this.selectedNode = clickedNode;
      this.render();
      console.log('Selected node:', clickedNode);
    }
  }

  private onResize(): void {
    this.updateCanvasSize();
    this.render();
  }

  private getMousePosition(event: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - this.panX) / this.zoom,
      y: (event.clientY - rect.top - this.panY) / this.zoom
    };
  }

  private getNodeAtPosition(x: number, y: number): TreeNode | null {
    for (let i = this.treeNodes.length - 1; i >= 0; i--) {
      const node = this.treeNodes[i];
      if (x >= node.x && x <= node.x + node.width &&
          y >= node.y && y <= node.y + node.height) {
        return node;
      }
    }
    return null;
  }

  private cleanup(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    if (isPlatformBrowser(this.platformId)) {
      this.clearMenuTimeout();
      window.removeEventListener('resize', this.onResize.bind(this));
      this.canvas.removeEventListener('touchstart', this.onTouchStart as any);
      this.canvas.removeEventListener('touchmove', this.onTouchMove as any);
      this.canvas.removeEventListener('touchend', this.onTouchEnd as any);
      document.removeEventListener('keydown', this.onKeyDown.bind(this));
    }
  }

  // Public methods for external controls
  zoomIn(): void {
    const zoomFactor = 1.2;
    const newZoom = Math.min(this.maxZoom, this.zoom * zoomFactor);
    if (newZoom !== this.zoom) {
      this.zoom = newZoom;
      this.render();
    }
  }

  zoomOut(): void {
    const zoomFactor = 0.8;
    const newZoom = Math.max(this.minZoom, this.zoom * zoomFactor);
    if (newZoom !== this.zoom) {
      this.zoom = newZoom;
      this.render();
    }
  }

  resetZoom(): void {
    this.zoom = 1;
    this.centerTree();
    this.render();
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    
    // Prevent background scrolling when in fullscreen mode
    if (this.isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // Allow DOM to update before resizing canvas
    setTimeout(() => {
      this.updateCanvasSize();
      this.fitToScreen();
    }, 50);
  }

  fitToScreen(): void {
    if (this.treeNodes.length === 0 || !this.treeBounds) return;
    
    // Use service to calculate optimal zoom
    this.zoom = this.canvasTreeService.getOptimalZoom(this.treeBounds, this.canvasWidth, this.canvasHeight);
    
    this.centerTree();
    this.render();
  }

  // Menu control methods
  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    if (this.isMenuOpen) {
      this.resetMenuTimeout();
    } else {
      this.clearMenuTimeout();
    }
  }

  resetMenuTimeout(): void {
    this.clearMenuTimeout();
    if (this.isMenuOpen) {
      this.menuTimeoutId = setTimeout(() => {
        this.isMenuOpen = false;
        this.cdr.detectChanges();
      }, 3000);
    }
  }

  clearMenuTimeout(): void {
    if (this.menuTimeoutId) {
      clearTimeout(this.menuTimeoutId);
      this.menuTimeoutId = null;
    }
  }
}
