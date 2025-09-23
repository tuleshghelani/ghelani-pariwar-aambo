# Canvas Tree Component

A premium, interactive family tree visualization component built with HTML5 Canvas, featuring zoom, pan, and professional styling.

## Features

### 🎯 Core Functionality
- **Interactive Canvas Rendering**: High-performance HTML5 Canvas-based tree visualization
- **Zoom Controls**: Mouse wheel zoom with configurable min/max limits (10% - 300%)
- **Pan Navigation**: Drag to pan around the tree
- **Node Selection**: Click nodes to select and highlight them
- **Responsive Design**: Optimized for mobile, tablet, and desktop devices

### 🎨 Visual Design
- **Professional Theme**: Integrated with the application's red (#DC1E24) and blue-gray (#2c3e50) color scheme
- **Node Styling**: Different colors for root, intermediate, and leaf nodes
- **Smooth Animations**: Hover effects and transitions
- **Curved Connections**: Beautiful curved lines connecting parent-child relationships
- **Glass Morphism**: Modern frosted glass effect for control panels

### ⚡ Performance Optimizations
- **Frame Rate Control**: 60fps rendering with requestAnimationFrame
- **Large Dataset Support**: Performance recommendations for trees with 100+ nodes
- **Memory Efficient**: Optimized rendering and cleanup
- **Responsive Rendering**: Only renders when necessary

### 🎮 User Controls
- **Zoom In/Out**: Dedicated buttons with smooth animations
- **Reset Zoom**: Return to default zoom level
- **Fit to Screen**: Automatically scale tree to fit canvas
- **Real-time Zoom Display**: Shows current zoom percentage

### 📱 Responsive Features
- **Mobile Optimized**: Touch-friendly controls and gestures
- **Tablet Support**: Optimized layout for medium screens
- **Desktop Enhanced**: Full feature set with keyboard shortcuts
- **Accessibility**: ARIA labels and screen reader support

## Usage

```html
<app-canvas-tree [personData]="personData"></app-canvas-tree>
```

### Input Properties
- `personData: Person | null` - The family tree data structure

### Data Structure
The component expects a `Person` object with the following structure:

```typescript
interface Person {
  id: string;
  name: string;
  children?: Person[];
}
```

## Technical Implementation

### Architecture
- **Component**: `CanvasTreeComponent` - Main visualization component
- **Service**: `CanvasTreeService` - Tree layout calculations and optimizations
- **Models**: `TreeNode`, `TreeConnection` - Data structures for rendering

### Key Classes

#### CanvasTreeComponent
- Handles user interactions (mouse, touch, wheel)
- Manages canvas rendering and animations
- Provides public methods for external control

#### CanvasTreeService
- Calculates optimal tree layouts
- Handles performance optimizations
- Provides tree statistics and recommendations

### Performance Features
- **Virtualization Ready**: Framework for handling large datasets
- **Batch Rendering**: Optimized rendering cycles
- **Memory Management**: Proper cleanup and resource management
- **Performance Monitoring**: Built-in performance recommendations

## Styling

The component uses SCSS with the following design principles:
- **Professional Color Scheme**: Red and blue-gray theme
- **Glass Morphism**: Modern frosted glass effects
- **Responsive Breakpoints**: Mobile-first design approach
- **Accessibility**: High contrast and reduced motion support
- **Dark Mode**: Automatic dark mode detection

## Browser Support

- **Modern Browsers**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **Mobile Browsers**: iOS Safari 12+, Chrome Mobile 60+
- **Canvas Support**: Full HTML5 Canvas API support required

## Accessibility

- **ARIA Labels**: Proper labeling for screen readers
- **Keyboard Navigation**: Focus management and keyboard shortcuts
- **High Contrast**: Support for high contrast mode
- **Reduced Motion**: Respects user's motion preferences

## Performance Recommendations

For trees with more than 100 nodes, consider:
- Implementing virtualization
- Using batch rendering
- Limiting visible nodes
- Implementing lazy loading

The service provides automatic performance recommendations based on tree size.

## Future Enhancements

- **Export Functionality**: PNG/SVG export capabilities
- **Search and Filter**: Node search and filtering
- **Custom Styling**: User-customizable themes
- **Animation Effects**: Smooth transitions and animations
- **Touch Gestures**: Enhanced mobile touch support
