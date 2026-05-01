import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import type { LayoutSchema, ComponentNode } from '@/types/schema';

export interface SnapPoint {
  value: number; // mm
  type: 'edge' | 'center';
  originId: string; // 'page' or component id
}

export interface SnapResult {
  snappedX: number;
  snappedY: number;
  activeGuidesX: number[];
  activeGuidesY: number[];
}

const SNAP_THRESHOLD = 1; // mm - Tighter feel like Figma

export const SnapEngine = {
  /**
   * Generates all potential snap points for the current layout context.
   * This should ideally be called once at the start of a drag operation.
   */
  generateSnapPoints(
    schema: LayoutSchema,
    draggedId: string,
    pageId?: string
  ): { x: SnapPoint[]; y: SnapPoint[] } {
    const pointsX: SnapPoint[] = [];
    const pointsY: SnapPoint[] = [];

    // 1. Page Points
    const { width: pageWidth, height: pageHeight } = getPaperDimensions(
      schema.page.size,
      schema.page.orientation
    );

    pointsX.push({ value: 0, type: 'edge', originId: 'page' });
    pointsX.push({ value: pageWidth, type: 'edge', originId: 'page' });
    pointsX.push({ value: pageWidth / 2, type: 'center', originId: 'page' });

    pointsY.push({ value: 0, type: 'edge', originId: 'page' });
    pointsY.push({ value: pageHeight, type: 'edge', originId: 'page' });
    pointsY.push({ value: pageHeight / 2, type: 'center', originId: 'page' });

    // 2. Component Points
    const addComponentPoints = (c: ComponentNode) => {
      if (c.id === draggedId) return;

      const cx = c.x || 0;
      const cy = c.y || 0;
      const cw = c.width || 0;
      const ch = c.height || 0;

      pointsX.push({ value: cx, type: 'edge', originId: c.id });
      pointsX.push({ value: cx + cw, type: 'edge', originId: c.id });
      pointsX.push({ value: cx + cw / 2, type: 'center', originId: c.id });

      pointsY.push({ value: cy, type: 'edge', originId: c.id });
      pointsY.push({ value: cy + ch, type: 'edge', originId: c.id });
      pointsY.push({ value: cy + ch / 2, type: 'center', originId: c.id });
    };

    // a) Global Zones (Header, Footer)
    for (const zone of Object.values(schema.zones)) {
      for (const c of zone.components) {
        addComponentPoints(c);
      }
    }

    // b) Pages
    const targetPages = pageId ? schema.pages.filter((p) => p.id === pageId) : schema.pages;
    for (const page of targetPages) {
      for (const c of page.body.components) {
        addComponentPoints(c);
      }
    }

    return { x: pointsX, y: pointsY };
  },

  calculateSnap(
    x: number, // current candidate x (mm)
    y: number, // current candidate y (mm)
    width: number,
    height: number,
    draggedId: string,
    schema: LayoutSchema,
    isAltKeyPressed: boolean,
    pageId?: string,
    cachedPoints?: { x: SnapPoint[]; y: SnapPoint[] }
  ): SnapResult {
    if (isAltKeyPressed) {
      return { snappedX: x, snappedY: y, activeGuidesX: [], activeGuidesY: [] };
    }

    const points = cachedPoints || this.generateSnapPoints(schema, draggedId, pageId);

    let snappedX = x;
    let snappedY = y;
    const activeGuidesX: number[] = [];
    const activeGuidesY: number[] = [];

    const GRID_SIZE = 0.1;

    // Snap X
    const draggedPointsX = [
      { val: x, name: 'left' },
      { val: x + width, name: 'right' },
      { val: x + width / 2, name: 'center' },
    ];

    let foundX = false;
    for (const dp of draggedPointsX) {
      for (const sp of points.x) {
        if (Math.abs(dp.val - sp.value) < SNAP_THRESHOLD) {
          if (dp.name === 'left') snappedX = sp.value;
          if (dp.name === 'right') snappedX = sp.value - width;
          if (dp.name === 'center') snappedX = sp.value - width / 2;
          activeGuidesX.push(sp.value);
          foundX = true;
          break;
        }
      }
      if (foundX) break;
    }

    // Grid Snap X fallback
    if (!foundX) {
      snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
    }

    // Snap Y
    const draggedPointsY = [
      { val: y, name: 'top' },
      { val: y + height, name: 'bottom' },
      { val: y + height / 2, name: 'center' },
    ];

    let foundY = false;
    for (const dp of draggedPointsY) {
      for (const sp of points.y) {
        if (Math.abs(dp.val - sp.value) < SNAP_THRESHOLD) {
          if (dp.name === 'top') snappedY = sp.value;
          if (dp.name === 'bottom') snappedY = sp.value - height;
          if (dp.name === 'center') snappedY = sp.value - height / 2;
          activeGuidesY.push(sp.value);
          foundY = true;
          break;
        }
      }
      if (foundY) break;
    }

    // Grid Snap Y fallback
    if (!foundY) {
      snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE;
    }

    return { snappedX, snappedY, activeGuidesX, activeGuidesY };
  },
};
