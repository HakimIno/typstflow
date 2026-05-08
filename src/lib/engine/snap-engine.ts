import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import type { ComponentNode, LayoutSchema } from '@/types/schema';

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

  /**
   * Calculate smart spacing indicators between the dragged element and nearest neighbors.
   */
  calculateSpacingIndicators(
    x: number,
    y: number,
    width: number,
    height: number,
    draggedId: string,
    schema: LayoutSchema,
    pageId?: string
  ): SpacingIndicator[] {
    const indicators: SpacingIndicator[] = [];

    // Collect all sibling component bounding boxes
    const siblings: { id: string; x: number; y: number; w: number; h: number }[] = [];

    const collectComponents = (components: ComponentNode[]) => {
      for (const c of components) {
        if (c.id === draggedId) continue;
        siblings.push({
          id: c.id,
          x: c.x || 0,
          y: c.y || 0,
          w: c.width || 0,
          h: c.height || 0,
        });
      }
    };

    // Collect from active page body
    const page = schema.pages.find((p) => p.id === pageId);
    if (page) collectComponents(page.body.components);
    // Also from global zones
    collectComponents(schema.zones.header.components);
    collectComponents(schema.zones.footer.components);

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
    draggedId: string,
    schema: LayoutSchema,
    pageId?: string
  ): EqualSpacingSnap[] {
    const snaps: EqualSpacingSnap[] = [];
    const siblings: { x: number; y: number; w: number; h: number }[] = [];

    const collectComponents = (components: ComponentNode[]) => {
      for (const c of components) {
        if (c.id === draggedId) continue;
        siblings.push({ x: c.x || 0, y: c.y || 0, w: c.width || 0, h: c.height || 0 });
      }
    };

    const page = schema.pages.find((p) => p.id === pageId);
    if (page) collectComponents(page.body.components);

    if (siblings.length < 2) return snaps;

    // Sort by X for horizontal equal spacing
    const sortedX = [...siblings].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sortedX.length - 1; i++) {
      const gapBetween = sortedX[i + 1].x - (sortedX[i].x + sortedX[i].w);
      if (gapBetween <= 0) continue;

      // Check: can we place the dragged element with the same gap after the last?
      const candidateX = sortedX[sortedX.length - 1].x + sortedX[sortedX.length - 1].w + gapBetween;
      if (Math.abs(x - candidateX) < EQUAL_SPACING_THRESHOLD) {
        snaps.push({ axis: 'x', snappedValue: candidateX, referenceGap: gapBetween });
      }
      // Check: same gap before the first
      const candidateXBefore = sortedX[0].x - width - gapBetween;
      if (Math.abs(x - candidateXBefore) < EQUAL_SPACING_THRESHOLD) {
        snaps.push({ axis: 'x', snappedValue: candidateXBefore, referenceGap: gapBetween });
      }
    }

    // Sort by Y for vertical equal spacing
    const sortedY = [...siblings].sort((a, b) => a.y - b.y);
    for (let i = 0; i < sortedY.length - 1; i++) {
      const gapBetween = sortedY[i + 1].y - (sortedY[i].y + sortedY[i].h);
      if (gapBetween <= 0) continue;

      const candidateY = sortedY[sortedY.length - 1].y + sortedY[sortedY.length - 1].h + gapBetween;
      if (Math.abs(y - candidateY) < EQUAL_SPACING_THRESHOLD) {
        snaps.push({ axis: 'y', snappedValue: candidateY, referenceGap: gapBetween });
      }
      const candidateYBefore = sortedY[0].y - height - gapBetween;
      if (Math.abs(y - candidateYBefore) < EQUAL_SPACING_THRESHOLD) {
        snaps.push({ axis: 'y', snappedValue: candidateYBefore, referenceGap: gapBetween });
      }
    }

    return snaps;
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

    // --- Equal Spacing Snap (higher priority) ---
    const equalSnaps = this.findEqualSpacingSnap(x, y, width, height, draggedId, schema, pageId);
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
    // Snap X (only if not already equal-spaced)
    if (!equalSnapAppliedX) {
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
    }

    // Snap Y (only if not already equal-spaced)
    if (!equalSnapAppliedY) {
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
    }

    return { snappedX, snappedY, activeGuidesX, activeGuidesY };
  },
};
