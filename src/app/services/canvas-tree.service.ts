import { Injectable } from '@angular/core';
import { Person } from '../models/person.model';
import { TreeNode, TreeConnection } from '../components/canvas-tree/canvas-tree.component';

export interface TreeLayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  levelSpacing: number;
  siblingSpacing: number;
  minCanvasWidth: number;
  minCanvasHeight: number;
}

export interface TreeBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

@Injectable({
  providedIn: 'root'
})
export class CanvasTreeService {
  private readonly defaultConfig: TreeLayoutConfig = {
    nodeWidth: 120,
    nodeHeight: 60,
    levelSpacing: 120,
    siblingSpacing: 150,
    minCanvasWidth: 800,
    minCanvasHeight: 600
  };

  /**
   * Build complete tree structure from Person data
   */
  buildTreeStructure(personData: Person, config: TreeLayoutConfig = this.defaultConfig): {
    nodes: TreeNode[];
    connections: TreeConnection[];
    bounds: TreeBounds;
  } {
    const nodes: TreeNode[] = [];
    const connections: TreeConnection[] = [];
    
    // Create root node
    const rootNode = this.createTreeNode(personData, 0, 0, 0, config);
    // Flatten nodes so we can render and compute bounds correctly
    this.flattenNodes(rootNode, nodes);
    
    // Calculate layout
    this.calculateOptimalLayout(rootNode, config);
    
    // Build connections
    this.buildConnections(rootNode, connections);
    
    // Calculate bounds
    const bounds = this.calculateTreeBounds(nodes);
    
    return { nodes, connections, bounds };
  }

  /**
   * Create a TreeNode from Person data
   */
  private createTreeNode(
    person: Person, 
    level: number, 
    x: number, 
    y: number, 
    config: TreeLayoutConfig
  ): TreeNode {
    const node: TreeNode = {
      id: person.id,
      name: person.name,
      x,
      y,
      width: config.nodeWidth,
      height: config.nodeHeight,
      level,
      children: [],
      isRoot: level === 0,
      isLeaf: !person.children || person.children.length === 0
    };

    if (person.children) {
      person.children.forEach(child => {
        const childNode = this.createTreeNode(child, level + 1, 0, 0, config);
        childNode.parent = node;
        node.children.push(childNode);
      });
    }

    return node;
  }

  /**
   * Calculate optimal tree layout using improved algorithm
   */
  private calculateOptimalLayout(rootNode: TreeNode, config: TreeLayoutConfig): void {
    // First pass: calculate subtree widths
    this.calculateSubtreeWidths(rootNode, config);
    
    // Second pass: position nodes
    // Place the root at origin; container will center later
    rootNode.x = 0;
    rootNode.y = 0;
    this.positionNodes(rootNode, config);
  }

  /**
   * Calculate width of each subtree for better spacing
   */
  private calculateSubtreeWidths(node: TreeNode, config: TreeLayoutConfig): number {
    if (node.children.length === 0) {
      return config.nodeWidth;
    }

    let totalWidth = 0;
    node.children.forEach(child => {
      totalWidth += this.calculateSubtreeWidths(child, config);
    });

    // Add spacing between children
    if (node.children.length > 1) {
      totalWidth += (node.children.length - 1) * config.siblingSpacing;
    }

    return Math.max(totalWidth, config.nodeWidth);
  }

  /**
   * Position nodes based on calculated widths
   */
  private positionNodes(node: TreeNode, config: TreeLayoutConfig): void {
    if (node.children.length === 0) {
      return;
    }

    // Calculate children positions
    let currentX = node.x - this.getSubtreeWidth(node, config) / 2 + config.nodeWidth / 2;
    
    node.children.forEach(child => {
      const childSubtreeWidth = this.getSubtreeWidth(child, config);
      child.x = currentX + childSubtreeWidth / 2 - config.nodeWidth / 2;
      child.y = node.y + config.levelSpacing;
      
      currentX += childSubtreeWidth + config.siblingSpacing;
      
      // Recursively position grandchildren
      this.positionNodes(child, config);
    });
  }

  /**
   * Get subtree width for a node
   */
  private getSubtreeWidth(node: TreeNode, config: TreeLayoutConfig): number {
    if (node.children.length === 0) {
      return node.width;
    }

    let totalWidth = 0;
    node.children.forEach(child => {
      totalWidth += this.getSubtreeWidth(child, config);
    });

    if (node.children.length > 1) {
      totalWidth += (node.children.length - 1) * config.siblingSpacing;
    }

    return totalWidth;
  }

  /**
   * Build connections between nodes
   */
  private buildConnections(node: TreeNode, connections: TreeConnection[]): void {
    node.children.forEach(child => {
      const connection: TreeConnection = {
        from: node,
        to: child,
        path: this.createConnectionPath(node, child)
      };
      connections.push(connection);
      
      // Recursively build connections for grandchildren
      this.buildConnections(child, connections);
    });
  }

  /**
   * Create SVG path for connection between nodes
   */
  private createConnectionPath(from: TreeNode, to: TreeNode): string {
    const fromX = from.x + from.width / 2;
    const fromY = from.y + from.height;
    const toX = to.x + to.width / 2;
    const toY = to.y;

    // Create smooth curved path
    const controlPointY = fromY + (toY - fromY) * 0.3;
    return `M ${fromX} ${fromY} Q ${fromX} ${controlPointY} ${toX} ${toY}`;
  }

  /**
   * Calculate tree bounds
   */
  private calculateTreeBounds(nodes: TreeNode[]): TreeBounds {
    if (nodes.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    }

    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x + n.width));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y + n.height));

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Flatten a tree into an array of nodes
   */
  private flattenNodes(node: TreeNode, out: TreeNode[]): void {
    out.push(node);
    node.children.forEach(child => this.flattenNodes(child, out));
  }

  /**
   * Center tree in canvas
   */
  centerTreeInCanvas(nodes: TreeNode[], canvasWidth: number, canvasHeight: number): void {
    if (nodes.length === 0) return;

    const bounds = this.calculateTreeBounds(nodes);
    const offsetX = (canvasWidth - bounds.width) / 2 - bounds.minX;
    const offsetY = (canvasHeight - bounds.height) / 2 - bounds.minY;

    nodes.forEach(node => {
      node.x += offsetX;
      node.y += offsetY;
    });
  }

  /**
   * Get optimal zoom level to fit tree in canvas
   */
  getOptimalZoom(bounds: TreeBounds, canvasWidth: number, canvasHeight: number, padding: number = 50): number {
    const scaleX = (canvasWidth - padding * 2) / bounds.width;
    const scaleY = (canvasHeight - padding * 2) / bounds.height;
    return Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%
  }

  /**
   * Check if tree is too large for canvas
   */
  isTreeTooLarge(bounds: TreeBounds, canvasWidth: number, canvasHeight: number): boolean {
    return bounds.width > canvasWidth * 2 || bounds.height > canvasHeight * 2;
  }

  /**
   * Get performance recommendations based on tree size
   */
  getPerformanceRecommendations(nodeCount: number): {
    shouldUseVirtualization: boolean;
    recommendedBatchSize: number;
    maxVisibleNodes: number;
  } {
    return {
      shouldUseVirtualization: nodeCount > 100,
      recommendedBatchSize: Math.min(50, Math.max(10, Math.floor(nodeCount / 10))),
      maxVisibleNodes: 200
    };
  }

  /**
   * Optimize tree for large datasets
   */
  optimizeForLargeDataset(nodes: TreeNode[], maxVisibleNodes: number = 200): TreeNode[] {
    if (nodes.length <= maxVisibleNodes) {
      return nodes;
    }

    // Keep root and first few levels visible
    const visibleNodes: TreeNode[] = [];
    const levelsToShow = Math.floor(Math.log2(maxVisibleNodes));
    
    nodes.forEach(node => {
      if (node.level <= levelsToShow) {
        visibleNodes.push(node);
      }
    });

    return visibleNodes;
  }

  /**
   * Get node statistics
   */
  getTreeStatistics(nodes: TreeNode[]): {
    totalNodes: number;
    maxDepth: number;
    averageChildrenPerNode: number;
    leafNodes: number;
  } {
    const totalNodes = nodes.length;
    const maxDepth = Math.max(...nodes.map(n => n.level));
    const leafNodes = nodes.filter(n => n.isLeaf).length;
    const nodesWithChildren = nodes.filter(n => n.children.length > 0);
    const totalChildren = nodesWithChildren.reduce((sum, n) => sum + n.children.length, 0);
    const averageChildrenPerNode = nodesWithChildren.length > 0 ? totalChildren / nodesWithChildren.length : 0;

    return {
      totalNodes,
      maxDepth,
      averageChildrenPerNode,
      leafNodes
    };
  }
}
