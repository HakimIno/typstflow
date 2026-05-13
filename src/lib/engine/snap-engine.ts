import { LayoutEngine } from './layout-engine';
import { getPaperDimensions } from '../utils/paper-sizes';
import { parseTypstUnit } from '../utils/units';
import type { ComponentNode, LayoutSchema } from '../../types/schema';

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
  spacingIndicators: SpacingIndicator[];
}

/** Distance indicator between the dragged element and its nearest neighbor on each axis */
export interface SpacingIndicator {
  /** The axis: 'left' | 'right' | 'top' | 'bottom' */
  side: 'left' | 'right' | 'top' | 'bottom';
  /** Distance in mm */
  distance: number;
  /** Start position of the measurement line (mm, on the relevant axis) */
  lineStart: number;
  /** End position of the measurement line (mm) */
  lineEnd: number;
  /** Cross-axis position for the label (mm) */
  crossPos: number;
}

export interface EqualSpacingSnap {
  axis: 'x' | 'y';
  snappedValue: number;
  referenceGap: number;
}

const SNAP_THRESHOLD = 1; // mm - Tighter feel like Figma
const EQUAL_SPACING_THRESHOLD = 1.5; // mm

export const SnapEngine = {
  /**
   * Generates all potential snap points for the current layout context.
   * This should ideally be called once at the start of a drag operation.
   */
  generateSnapPoints(
    schema: LayoutSchema,
    draggedIds: string | string[],
    pageId?: string
  ): { x: SnapPoint[]; y: SnapPoint[] } {
    const pointsX: SnapPoint[] = [];
    const pointsY: SnapPoint[] = [];
    const excludedIds = Array.isArray(draggedIds) ? draggedIds : [draggedIds];

    // 1. Page Points
    const { width: pageWidth, height: pageHeight } = getPaperDimensions(
      schema.page.size,
      schema.page.orientation
    );

    // Current page vertical offset
    const pageIndex = pageId ? schema.pages.findIndex(p => p.id === pageId) : 0;
    const pageAbsY = pageIndex * pageHeight;

    // Page boundaries & center
    pointsX.push({ value: 0, type: 'edge', originId: 'page' });
    pointsX.push({ value: pageWidth, type: 'edge', originId: 'page' });
    pointsX.push({ value: pageWidth / 2, type: 'center', originId: 'page' });

    pointsY.push({ value: pageAbsY, type: 'edge', originId: 'page' });
    pointsY.push({ value: pageAbsY + pageHeight, type: 'edge', originId: 'page' });
    pointsY.push({ value: pageAbsY + pageHeight / 2, type: 'center', originId: 'page' });

    const addComponentPoints = (c: ComponentNode, zoneOffset: number) => {
      if (excludedIds.includes(c.id)) return;

      const cx = c.x || 0;
      const cy = (c.y || 0) + zoneOffset;
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
    // Header is always at absolute 0 for the whole document
    for (const c of schema.zones.header.components) {
      addComponentPoints(c, 0);
    }
    
    // Footer is physically at bottom of each page
    const footerHeight = parseTypstUnit(schema.zones.footer.minHeight) || 20;
    const fOffset = pageAbsY + pageHeight - footerHeight;
    for (const c of schema.zones.footer.components) {
      addComponentPoints(c, fOffset);
    }

    // b) Pages (Optimized: only current page)
    const pagesToProcess = pageId ? schema.pages.filter(p => p.id === pageId) : schema.pages;
    for (const page of pagesToProcess) {
      const bOffset = LayoutEngine.calculateZoneOffset('body', schema, page.id);
      for (const c of page.body.components) {
        addComponentPoints(c, bOffset);
      }
    }

    // c) Groups
    if (schema.groups) {
      for (const group of schema.groups) {
        // Groups usually follow the body flow context
        const bOffset = LayoutEngine.calculateZoneOffset('body', schema, pageId);
        for (const c of group.header.components) {
          addComponentPoints(c, bOffset); 
        }
        for (const c of group.footer.components) {
          addComponentPoints(c, bOffset);
        }
      }
    }

    return { x: pointsX, y: pointsY };
  },

  /**
   * Calculate smart spacing indicators between the dragged element and nearest neighbors.
   */
  calculateSpacingIndicators(
    x: number,
    y: number,
    width: number,
    height: number,
    draggedIds: string | string[],
    schema: LayoutSchema,
    pageId?: string
  ): SpacingIndicator[] {
    const indicators: SpacingIndicator[] = [];
    const excludedIds = Array.isArray(draggedIds) ? draggedIds : [draggedIds];

    // Collect all sibling component bounding boxes with absolute document coordinates
    const siblings: { id: string; x: number; y: number; w: number; h: number }[] = [];

    const collectComponents = (components: ComponentNode[], offset: number) => {
      for (const c of components) {
        if (excludedIds.includes(c.id)) continue;
        siblings.push({
          id: c.id,
          x: c.x || 0,
          y: (c.y || 0) + offset,
          w: c.width || 0,
          h: c.height || 0,
        });
      }
    };

    // a) Global Zones
    collectComponents(schema.zones.header.components, 0);
    
    const { height: pageHeight } = getPaperDimensions(schema.page.size, schema.page.orientation);
    const pageIndex = pageId ? schema.pages.findIndex(p => p.id === pageId) : 0;
    const pageAbsY = pageIndex * pageHeight;
    const footerHeight = parseTypstUnit(schema.zones.footer.minHeight) || 20;
    collectComponents(schema.zones.footer.components, pageAbsY + pageHeight - footerHeight);

    // b) Pages (Optimized: only current page)
    const pagesToProcess = pageId ? schema.pages.filter(p => p.id === pageId) : schema.pages;
    for (const page of pagesToProcess) {
      const bOffset = LayoutEngine.calculateZoneOffset('body', schema, page.id);
      collectComponents(page.body.components, bOffset);
    }

    const dragRight = x + width;
    const dragBottom = y + height;
    const dragCenterY = y + height / 2;
    const dragCenterX = x + width / 2;

    // Find nearest neighbor on each side
    // LEFT: closest sibling whose right edge is to the left of our left edge
    let nearestLeft: typeof siblings[0] | null = null;
    let nearestLeftDist = Infinity;
    // RIGHT: closest sibling whose left edge is to the right of our right edge
    let nearestRight: typeof siblings[0] | null = null;
    let nearestRightDist = Infinity;
    // TOP: closest sibling whose bottom edge is above our top edge
    let nearestTop: typeof siblings[0] | null = null;
    let nearestTopDist = Infinity;
    // BOTTOM: closest sibling whose top edge is below our bottom edge
    let nearestBottom: typeof siblings[0] | null = null;
    let nearestBottomDist = Infinity;

    for (const s of siblings) {
      const sRight = s.x + s.w;
      const sBottom = s.y + s.h;

      // Check Y overlap for horizontal neighbors
      const yOverlap = !(sBottom < y || s.y > dragBottom);
      // Check X overlap for vertical neighbors
      const xOverlap = !(sRight < x || s.x > dragRight);

      if (yOverlap) {
        // Left neighbor
        if (sRight <= x) {
          const dist = x - sRight;
          if (dist < nearestLeftDist) {
            nearestLeftDist = dist;
            nearestLeft = s;
          }
        }
        // Right neighbor
        if (s.x >= dragRight) {
          const dist = s.x - dragRight;
          if (dist < nearestRightDist) {
            nearestRightDist = dist;
            nearestRight = s;
          }
        }
      }

      if (xOverlap) {
        // Top neighbor
        if (sBottom <= y) {
          const dist = y - sBottom;
          if (dist < nearestTopDist) {
            nearestTopDist = dist;
            nearestTop = s;
          }
        }
        // Bottom neighbor
        if (s.y >= dragBottom) {
          const dist = s.y - dragBottom;
          if (dist < nearestBottomDist) {
            nearestBottomDist = dist;
            nearestBottom = s;
          }
        }
      }
    }

    // Generate indicators for neighbors within a reasonable range (< 100mm)
    const MAX_INDICATOR_DIST = 100;

    if (nearestLeft && nearestLeftDist < MAX_INDICATOR_DIST) {
      indicators.push({
        side: 'left',
        distance: Math.round(nearestLeftDist * 10) / 10,
        lineStart: nearestLeft.x + nearestLeft.w,
        lineEnd: x,
        crossPos: dragCenterY,
      });
    }

    if (nearestRight && nearestRightDist < MAX_INDICATOR_DIST) {
      indicators.push({
        side: 'right',
        distance: Math.round(nearestRightDist * 10) / 10,
        lineStart: dragRight,
        lineEnd: nearestRight.x,
        crossPos: dragCenterY,
      });
    }

    if (nearestTop && nearestTopDist < MAX_INDICATOR_DIST) {
      indicators.push({
        side: 'top',
        distance: Math.round(nearestTopDist * 10) / 10,
        lineStart: nearestTop.y + nearestTop.h,
        lineEnd: y,
        crossPos: dragCenterX,
      });
    }

    if (nearestBottom && nearestBottomDist < MAX_INDICATOR_DIST) {
      indicators.push({
        side: 'bottom',
        distance: Math.round(nearestBottomDist * 10) / 10,
        lineStart: dragBottom,
        lineEnd: nearestBottom.y,
        crossPos: dragCenterX,
      });
    }

    return indicators;
  },

  /**
   * Detect equal-spacing opportunities.
   * If A-B gap = 10mm, snap C so that B-C gap = 10mm too.
   */
  findEqualSpacingSnap(
    x: number,
    y: number,
    width: number,
    height: number,
    draggedIds: string | string[],
    schema: LayoutSchema,
    pageId?: string
  ): EqualSpacingSnap[] {
    const snaps: EqualSpacingSnap[] = [];
    const siblings: { x: number; y: number; w: number; h: number }[] = [];
    
    const draggedIdArray = Array.isArray(draggedIds) ? draggedIds : [draggedIds];

    const collectComponents = (components: ComponentNode[]) => {
      for (const c of components) {
        if (draggedIdArray.includes(c.id)) continue;
        siblings.push({ x: c.x || 0, y: c.y || 0, w: c.width || 0, h: c.height || 0 });
      }
    };

    const page = schema.pages.find((p) => p.id === pageId);
    if (page) collectComponents(page.body.components);
    collectComponents(schema.zones.header.components);
    collectComponents(schema.zones.footer.components);

    if (siblings.length < 1) return snaps;

    // 1. Collect gaps between ADJACENT siblings (O(N log N) optimization)
    const existingGapsX = new Set<number>();
    const existingGapsY = new Set<number>();

    if (siblings.length >= 2) {
      const sortedX = [...siblings].sort((a, b) => a.x - b.x);
      for (let i = 0; i < sortedX.length - 1; i++) {
        const gap = sortedX[i + 1].x - (sortedX[i].x + sortedX[i].w);
        if (gap > 0.5 && gap < 150) existingGapsX.add(Number(gap.toFixed(2)));
      }

      const sortedY = [...siblings].sort((a, b) => a.y - b.y);
      for (let i = 0; i < sortedY.length - 1; i++) {
        const gap = sortedY[i + 1].y - (sortedY[i].y + sortedY[i].h);
        if (gap > 0.5 && gap < 150) existingGapsY.add(Number(gap.toFixed(2)));
      }
    }

    for (const s of siblings) {
      for (const gap of existingGapsX) {
        const candAfter = s.x + s.w + gap;
        if (Math.abs(x - candAfter) < EQUAL_SPACING_THRESHOLD) {
          snaps.push({ axis: 'x', snappedValue: candAfter, referenceGap: gap });
        }
        const candBefore = s.x - width - gap;
        if (Math.abs(x - candBefore) < EQUAL_SPACING_THRESHOLD) {
          snaps.push({ axis: 'x', snappedValue: candBefore, referenceGap: gap });
        }
      }

      for (const gap of existingGapsY) {
        const candBelow = s.y + s.h + gap;
        if (Math.abs(y - candBelow) < EQUAL_SPACING_THRESHOLD) {
          snaps.push({ axis: 'y', snappedValue: candBelow, referenceGap: gap });
        }
        const candAbove = s.y - height - gap;
        if (Math.abs(y - candAbove) < EQUAL_SPACING_THRESHOLD) {
          snaps.push({ axis: 'y', snappedValue: candAbove, referenceGap: gap });
        }
      }
    }

    return snaps;
  },

  calculateSnap(
    x: number, // current candidate x (mm)
    y: number, // current candidate y (mm)
    width: number,
    height: number,
    draggedIds: string | string[],
    schema: LayoutSchema,
    isAltKeyPressed: boolean,
    pageId?: string,
    cachedPoints?: { x: SnapPoint[]; y: SnapPoint[] }
  ): SnapResult {
    if (isAltKeyPressed) {
      return { snappedX: x, snappedY: y, activeGuidesX: [], activeGuidesY: [], spacingIndicators: [] };
    }

    const points = cachedPoints || this.generateSnapPoints(schema, draggedIds, pageId);

    let snappedX = x;
    let snappedY = y;
    const activeGuidesX: number[] = [];
    const activeGuidesY: number[] = [];

    const GRID_SIZE = 1.0; // 1mm for crisp fallback

    // --- Equal Spacing Snap (higher priority) ---
    const equalSnaps = this.findEqualSpacingSnap(x, y, width, height, draggedIds, schema, pageId);
    let equalSnapAppliedX = false;
    let equalSnapAppliedY = false;
    for (const es of equalSnaps) {
      if (es.axis === 'x' && !equalSnapAppliedX) {
        snappedX = es.snappedValue;
        equalSnapAppliedX = true;
      }
      if (es.axis === 'y' && !equalSnapAppliedY) {
        snappedY = es.snappedValue;
        equalSnapAppliedY = true;
      }
    }

    // --- Edge/Center Snap ---
    // Snap X
    if (!equalSnapAppliedX) {
      const draggedPointsX = [
        { val: x, name: 'left' },
        { val: x + width, name: 'right' },
        { val: x + width / 2, name: 'center' },
      ];

      let bestDist = SNAP_THRESHOLD;
      let bestSnapValue = x;
      let foundX = false;

      for (const dp of draggedPointsX) {
        for (const sp of points.x) {
          const dist = Math.abs(dp.val - sp.value);
          if (dist < bestDist) {
            bestDist = dist;
            if (dp.name === 'left') bestSnapValue = sp.value;
            if (dp.name === 'right') bestSnapValue = sp.value - width;
            if (dp.name === 'center') bestSnapValue = sp.value - width / 2;
            foundX = true;
          }
        }
      }

      if (foundX) {
        snappedX = bestSnapValue;
        const finalLeft = snappedX;
        const finalRight = snappedX + width;
        const finalCenter = snappedX + width / 2;
        for (const sp of points.x) {
          if (
            Math.abs(sp.value - finalLeft) < 0.01 ||
            Math.abs(sp.value - finalRight) < 0.01 ||
            Math.abs(sp.value - finalCenter) < 0.01
          ) {
            if (!activeGuidesX.includes(sp.value)) activeGuidesX.push(sp.value);
          }
        }
      } else {
        snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
      }
    }

    // Snap Y
    if (!equalSnapAppliedY) {
      const draggedPointsY = [
        { val: y, name: 'top' },
        { val: y + height, name: 'bottom' },
        { val: y + height / 2, name: 'center' },
      ];

      let bestDist = SNAP_THRESHOLD;
      let bestSnapValue = y;
      let foundY = false;

      for (const dp of draggedPointsY) {
        for (const sp of points.y) {
          const dist = Math.abs(dp.val - sp.value);
          if (dist < bestDist) {
            bestDist = dist;
            if (dp.name === 'top') bestSnapValue = sp.value;
            if (dp.name === 'bottom') bestSnapValue = sp.value - height;
            if (dp.name === 'center') bestSnapValue = sp.value - height / 2;
            foundY = true;
          }
        }
      }

      if (foundY) {
        snappedY = bestSnapValue;
        const finalTop = snappedY;
        const finalBottom = snappedY + height;
        const finalCenter = snappedY + height / 2;
        for (const sp of points.y) {
          if (
            Math.abs(sp.value - finalTop) < 0.01 ||
            Math.abs(sp.value - finalBottom) < 0.01 ||
            Math.abs(sp.value - finalCenter) < 0.01
          ) {
            if (!activeGuidesY.includes(sp.value)) activeGuidesY.push(sp.value);
          }
        }
      } else {
        snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE;
      }
    }

    const spacingIndicators = this.calculateSpacingIndicators(snappedX, snappedY, width, height, draggedIds, schema, pageId);

    return { 
      snappedX, 
      snappedY, 
      activeGuidesX, 
      activeGuidesY,
      spacingIndicators 
    };
  },
};

