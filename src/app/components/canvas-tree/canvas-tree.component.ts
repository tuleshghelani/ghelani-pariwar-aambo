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
  private lastMouseX = 0;
  private lastMouseY = 0;
  zoom = 1;
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
  private readonly layoutConfig: TreeLayoutConfig = {
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
      this.initializeCanvas();
      this.setupEventListeners();
      this.render();
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
    this.ctx.strokeStyle = '#DC1E24';
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

    // Node background
    this.ctx.fillStyle = this.getNodeColor(node);
    this.ctx.fillRect(x, y, width, height);

    // Node border
    this.ctx.strokeStyle = this.getNodeBorderColor(node);
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, width, height);

    // Node text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 12px Roboto, sans-serif';
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
    this.ctx.fillStyle = '#2c3e50';
    this.ctx.font = '10px Roboto, sans-serif';
    this.ctx.fillText(`Level ${node.level}`, x + width / 2, y + height - 8);
  }

  private getNodeColor(node: TreeNode): string {
    if (node.isRoot) return '#DC1E24';
    if (node.isLeaf) return '#27ae60';
    return '#3498db';
  }

  private getNodeBorderColor(node: TreeNode): string {
    if (node === this.hoveredNode) return '#f39c12';
    if (node === this.selectedNode) return '#e74c3c';
    return '#2c3e50';
  }

  private setupEventListeners(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.onWheel.bind(this));
    this.canvas.addEventListener('click', this.onClick.bind(this));
    
    window.addEventListener('resize', this.onResize.bind(this));
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
      window.removeEventListener('resize', this.onResize.bind(this));
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

  fitToScreen(): void {
    if (this.treeNodes.length === 0 || !this.treeBounds) return;
    
    // Use service to calculate optimal zoom
    this.zoom = this.canvasTreeService.getOptimalZoom(this.treeBounds, this.canvasWidth, this.canvasHeight);
    
    this.centerTree();
    this.render();
  }
}
