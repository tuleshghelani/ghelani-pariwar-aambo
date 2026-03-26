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
    levelSpacing: 120,
    siblingSpacing: 150,
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
          levelSpacing: 140,
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
    if (changes['personData'] && this.personData) {
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
      this.ctx.moveTo(
        connection.from.x + connection.from.width / 2,
        connection.from.y + connection.from.height
      );
      
      const midY = (connection.from.y + connection.from.height + connection.to.y) / 2;
      this.ctx.quadraticCurveTo(
        connection.from.x + connection.from.width / 2,
        midY,
        connection.to.x + connection.to.width / 2,
        connection.to.y
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

    // Node background
    this.ctx.fillStyle = this.getNodeColor(node, primary);
    this.ctx.fillRect(x, y, width, height);

    // Node border
    this.ctx.strokeStyle = this.getNodeBorderColor(node, accent, primary);
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, width, height);

    // Node text
    this.ctx.fillStyle = white;
    this.ctx.font = `bold 12px ${getComputedStyle(document.documentElement).getPropertyValue('--font-primary').trim() || 'Outfit, sans-serif'}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Split long names
    const words = node.name.split(' ');
    const lineHeight = 14;
    const startY = y + height / 2 - (words.length - 1) * lineHeight / 2;

    words.forEach((word, index) => {
      this.ctx.fillText(word, x + width / 2, startY + index * lineHeight);
    });

    // Level indicator
    this.ctx.fillStyle = textColor;
    this.ctx.font = `10px ${getComputedStyle(document.documentElement).getPropertyValue('--font-secondary').trim() || 'Quicksand, sans-serif'}`;
    // this.ctx.fillText(`Level ${node.level}`, x + width / 2, y + height - 8);
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
