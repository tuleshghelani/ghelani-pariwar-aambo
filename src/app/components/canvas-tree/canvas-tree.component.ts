import { Component, ElementRef, Input, OnInit, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Person } from '../../models/person.model';

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
  
  // Node styling
  private readonly nodeWidth: number = 180;
  private readonly nodeHeight: number = 60;
  private readonly horizontalSpacing: number = 50;
  private readonly verticalSpacing: number = 80;
  private readonly cornerRadius: number = 8;
  
  // Colors
  private readonly rootNodeColor: string = '#f5f7fa';
  private readonly nodeColor: string = '#ffffff';
  private readonly lineColor: string = '#007bff';
  private readonly textColor: string = '#343a40';
  private readonly idColor: string = '#007bff';
  
  constructor() {}
  
  ngOnInit(): void {}
  
  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    
    // Set initial canvas size
    this.resizeCanvas();
    
    // Set initial cursor style
    canvas.style.cursor = 'grab';
    
    // Draw the tree when data is available
    if (this.personData) {
      this.drawTree();
    }
  }
  
  // Zoom control methods
  zoomIn(): void {
    this.scale *= 1.2;
    this.drawTree();
  }
  
  zoomOut(): void {
    this.scale *= 0.8;
    if (this.scale < 0.2) this.scale = 0.2; // Prevent zooming out too far
    this.drawTree();
  }
  
  resetView(): void {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.drawTree();
  }
  
  @HostListener('window:resize')
  onResize(): void {
    this.resizeCanvas();
    this.drawTree();
  }
  
  @HostListener('wheel', ['$event'])
  onMouseWheel(event: WheelEvent): void {
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
    this.isDragging = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.canvasRef.nativeElement.style.cursor = 'grabbing';
  }
  
  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
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
    this.isDragging = false;
    this.canvasRef.nativeElement.style.cursor = 'grab';
  }
  
  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement;
    
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }
  }
  
  private drawTree(): void {
    if (!this.ctx || !this.personData) return;
    
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
    
    // Draw from root node
    this.drawNode(this.personData, startX, 50, 0, treeDimensions);
    
    // Restore state
    this.ctx.restore();
  }
  
  private calculateTreeDimensions(person: Person): { width: number, height: number, levelWidths: Map<number, number> } {
    const levelWidths = new Map<number, number>();
    const levelCounts = new Map<number, number>();
    
    // Calculate width needed for each level
    const calculateLevelWidths = (node: Person, level: number): void => {
      if (!levelCounts.has(level)) {
        levelCounts.set(level, 0);
        levelWidths.set(level, 0);
      }
      
      levelCounts.set(level, levelCounts.get(level)! + 1);
      
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => calculateLevelWidths(child, level + 1));
      }
    };
    
    calculateLevelWidths(person, 0);
    
    // Calculate total width and height
    let maxWidth = 0;
    let maxLevel = 0;
    
    levelCounts.forEach((count, level) => {
      const levelWidth = count * this.nodeWidth + (count - 1) * this.horizontalSpacing;
      levelWidths.set(level, levelWidth);
      maxWidth = Math.max(maxWidth, levelWidth);
      maxLevel = Math.max(maxLevel, level);
    });
    
    const height = (maxLevel + 1) * (this.nodeHeight + this.verticalSpacing);
    
    return { width: maxWidth, height, levelWidths };
  }
  
  private drawNode(person: Person, x: number, y: number, level: number, dimensions: { width: number, levelWidths: Map<number, number> }): number {
    if (!person) return 0;
    
    const isRoot = level === 0;
    const levelWidth = dimensions.levelWidths.get(level) || 0;
    
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
    const childrenWidth = childrenCount * this.nodeWidth + (childrenCount - 1) * this.horizontalSpacing;
    
    // Center children under parent
    let childX = x + (this.nodeWidth - childrenWidth) / 2;
    
    // Draw connector line from parent to middle point above children
    const parentBottomX = x + this.nodeWidth / 2;
    const parentBottomY = y + this.nodeHeight;
    const connectorY = y + this.nodeHeight + this.verticalSpacing / 2;
    
    this.ctx.strokeStyle = this.lineColor;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(parentBottomX, parentBottomY);
    this.ctx.lineTo(parentBottomX, connectorY);
    this.ctx.stroke();
    
    // Draw horizontal connector line if multiple children
    if (childrenCount > 1) {
      const leftmostChildX = childX + this.nodeWidth / 2;
      const rightmostChildX = childX + childrenWidth - this.nodeWidth / 2;
      
      this.ctx.beginPath();
      this.ctx.moveTo(leftmostChildX, connectorY);
      this.ctx.lineTo(rightmostChildX, connectorY);
      this.ctx.stroke();
    }
    
    // Draw children and vertical connectors to each child
    person.children.forEach(child => {
      // Draw vertical connector to this child
      const childTopX = childX + this.nodeWidth / 2;
      
      this.ctx.beginPath();
      this.ctx.moveTo(childTopX, connectorY);
      this.ctx.lineTo(childTopX, nextY);
      this.ctx.stroke();
      
      // Draw child node and its children
      const childWidth = this.drawNode(child, childX, nextY, nextLevel, dimensions);
      childX += childWidth + this.horizontalSpacing;
    });
    
    return Math.max(this.nodeWidth, childrenWidth);
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
