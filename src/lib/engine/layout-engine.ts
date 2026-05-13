import {
  SNAP_GRID_MM,
  getDpiRatio,
  mmToPxAtCurrentDpi,
  pxToMmAtCurrentDpi,
  updateDpiRatio,
} from '../constants';
import { parseTypstUnit } from '../utils/units';
import { getPaperDimensions } from '../utils/paper-sizes';

/**
 * Enhanced coordinate system information for accurate position calculations.
 * Includes scroll offsets and transform information.
 */
export interface CoordinateContext {
  /** The bounding rectangle of the container (from getBoundingClientRect) */
  rect: DOMRect;
  /** Current horizontal scroll position of the container */
  scrollLeft?: number;
  /** Current vertical scroll position of the container */
  scrollTop?: number;
  /** Optional scale transform applied to the container */
  scale?: number;
}

/**
 * Result of a position calculation with both snapped and raw coordinates.
 */
export interface PositionResult {
  /** X coordinate snapped to grid (in mm) */
  x: number;
  /** Y coordinate snapped to grid (in mm) */
  y: number;
  /** Raw X coordinate before snapping (in mm) */
  rawX: number;
  /** Raw Y coordinate before snapping (in mm) */
  rawY: number;
}

/**
 * High-performance Coordinate & Layout Engine for TypstFlow.
 *
 * FEATURES:
 * - Standard 96 DPI conversion (matches browser CSS units)
 * - Scroll compensation for accurate positioning in scrollable containers
 * - CSS transform awareness
 * - Grid snapping for precise alignment
 * - Cached calculations for performance
 *
 * NOTE: We use standardized 96 DPI for consistency between design view and PDF output.
 * Browser zoom handles display scaling automatically, so we keep logical pixels constant.
 *
 * @example
 * ```ts
 * const context = LayoutEngine.createContextFromElement(containerElement);
 * const position = LayoutEngine.calculateDropPosition(clientX, clientY, context);
 * ```
 */
export const LayoutEngine = {
  /**
   * Converts screen pixels to physical millimeters.
   * Uses standard 96 DPI conversion (96px = 1 inch = 25.4mm).
   * This ensures consistent positioning between design view and PDF output.
   *
   * @param px - Pixel value to convert
   * @returns Equivalent value in millimeters
   */
  pxToMm(px: number): number {
    return pxToMmAtCurrentDpi(px);
  },

  /**
   * Converts physical millimeters to screen pixels.
   * Reverse of pxToMm using standard 96 DPI.
   *
   * @param mm - Millimeter value to convert
   * @returns Equivalent value in pixels
   */
  mmToPx(mm: number): number {
    return mmToPxAtCurrentDpi(mm);
  },

  /**
   * Gets the DPI ratio being used for conversions.
   * Always returns 1.0 as we use standard 96 DPI.
   *
   * @returns DPI ratio (always 1.0)
   */
  getCurrentDpiRatio(): number {
    return getDpiRatio();
  },

  /**
   * Snaps a value to the defined grid.
   *
   * @param value - Value to snap (in mm)
   * @param step - Grid step size in mm (default: 0.1mm)
   * @returns Snapped value
   */
  snap(value: number, step: number = SNAP_GRID_MM): number {
    return Math.round(value / step) * step;
  },

  /**
   * Calculates the drop position of a component with full scroll and DPI compensation.
   *
   * This method handles:
   * - Scroll offsets (both horizontal and vertical)
   * - DPI/browser zoom automatically
   * - CSS scale transforms
   * - Grid snapping
   * - Bounds checking
   *
   * @param clientX - Mouse X position in viewport coordinates
   * @param clientY - Mouse Y position in viewport coordinates
   * @param context - Coordinate context including rect and scroll info
   * @param dragOffsetX - Horizontal offset from drag handle to component edge (px)
   * @param dragOffsetY - Vertical offset from drag handle to component edge (px)
   * @returns Position object with snapped and raw coordinates (in mm)
   *
   * @example
   * ```ts
   * const context = {
   *   rect: container.getBoundingClientRect(),
   *   scrollLeft: container.scrollLeft,
   *   scrollTop: container.scrollTop,
   *   scale: 1
   * };
   * const pos = LayoutEngine.calculateDropPosition(
   *   event.clientX,
   *   event.clientY,
   *   context,
   *   dragOffsetX,
   *   dragOffsetY
   * );
   * console.log(`Dropped at ${pos.x}mm, ${pos.y}mm`);
   * ```
   */
  calculateDropPosition(
    clientX: number,
    clientY: number,
    context: CoordinateContext,
    dragOffsetX = 0,
    dragOffsetY = 0
  ): PositionResult {
    const { rect, scale = 1 } = context;

    // Adjust for scale transform if present
    const effectiveScale = scale > 0 ? scale : 1;

    // Calculate position relative to container
    // When using getBoundingClientRect(), the rect already accounts for viewport-relative scroll.
    // The distance between the cursor and the element's edge is direct: (clientX - rect.left).
    const relativeX = (clientX - rect.left - dragOffsetX) / effectiveScale;
    const relativeY = (clientY - rect.top - dragOffsetY) / effectiveScale;

    // Convert to millimeters (automatically handles DPI/zoom)
    const rawX = LayoutEngine.pxToMm(relativeX);
    const rawY = LayoutEngine.pxToMm(relativeY);

    // Snap to grid and ensure non-negative
    return {
      x: Math.max(0, LayoutEngine.snap(rawX)),
      y: Math.max(0, LayoutEngine.snap(rawY)),
      rawX,
      rawY,
    };
  },

  /**
   * Creates a CoordinateContext from a DOM element.
   * This is a convenience method to avoid calling multiple DOM APIs.
   *
   * @param element - The container element
   * @param scale - Optional scale transform (default: reads from computed style)
   * @returns CoordinateContext with all necessary information
   *
   * @example
   * ```ts
   * const context = LayoutEngine.createContextFromElement(containerElement);
   * const position = LayoutEngine.calculateDropPosition(clientX, clientY, context);
   * ```
   */
  createContextFromElement(element: HTMLElement, scale?: number): CoordinateContext {
    const rect = element.getBoundingClientRect();

    // Auto-detect scale from transform if not provided
    let detectedScale = scale;
    if (detectedScale === undefined) {
      const transform = window.getComputedStyle(element).transform;
      if (transform && transform !== 'none') {
        // Parse matrix(a, b, c, d, e, f) to get scale
        const matrix = transform.match(/matrix\(([^)]+)\)/);
        if (matrix) {
          const values = matrix[1].split(',').map((v) => Number.parseFloat(v.trim()));
          // ScaleX is the first value (a), scaleY is the fourth (d)
          // Use average for uniform scale
          detectedScale = (values[0] + values[3]) / 2;
        }
      }
    }

    return {
      rect,
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
      scale: detectedScale ?? 1,
    };
  },

  /**
   * High-level method to calculate component position relative to the main drafting container.
   * This handles the complex coordinate mapping between viewport screen space and
   * scrollable millimeter-based page space.
   */
  calculateAbsolutePosition(
    clientX: number,
    clientY: number,
    dragOffsetX = 0,
    dragOffsetY = 0,
    pageId?: string
  ): PositionResult {
    const selector = pageId
      ? `[data-paper-container][data-page-id="${pageId}"]`
      : '[data-paper-container]';
    const container = document.querySelector(selector) as HTMLElement;
    if (!container) return { x: 0, y: 0, rawX: 0, rawY: 0 };
    const scrollParent = container.closest('.overflow-auto') as HTMLElement;
    return this.calculateAbsolutePositionWithElement(
      clientX,
      clientY,
      dragOffsetX,
      dragOffsetY,
      container,
      scrollParent ?? null
    );
  },

  /** Hot-path variant — accepts cached element refs to avoid per-frame DOM queries. */
  calculateAbsolutePositionWithElement(
    clientX: number,
    clientY: number,
    dragOffsetX: number,
    dragOffsetY: number,
    container: HTMLElement,
    scrollParent: HTMLElement | null
  ): PositionResult {
    const explicitZoom = Number.parseFloat(container.dataset.zoom || '1');
    const context = this.createContextFromElement(container, explicitZoom);
    if (scrollParent) {
      context.scrollLeft = scrollParent.scrollLeft;
      context.scrollTop = scrollParent.scrollTop;
    }
    return this.calculateDropPosition(clientX, clientY, context, dragOffsetX, dragOffsetY);
  },

  calculateZoneOffset(zoneKey: string, schema: any, pageId?: string): number {
    if (zoneKey === 'header') return 0;

    const isFirstPage = !pageId || pageId === schema.pages[0]?.id;
    const isHeaderRepeated = schema.zones.header?.repeatOnEveryPage === true;

    // For footer, it is visually anchored to the bottom of the page
    // because the Body zone is `flex: 1`.
    if (zoneKey === 'footer') {
      const { height: pageHeightMm } = getPaperDimensions(
        schema.page.size,
        schema.page.orientation
      );
      
      // Determine if footer is actually shown on this page
      const pageIndex = schema.pages.findIndex((p: any) => p.id === pageId);
      const pIdx = pageIndex >= 0 ? pageIndex : 0;
      const isFooterRepeated = schema.zones.footer?.repeatOnEveryPage === true;
      const showOnLastPageOnly = schema.zones.footer?.showOnLastPageOnly === true;
      const isLastPage = pIdx === schema.pages.length - 1;
      
      const isFooterVisible = isFooterRepeated || (showOnLastPageOnly && isLastPage) || (!isFooterRepeated && !showOnLastPageOnly && pIdx === 0);
      
      if (!isFooterVisible) return 0; // Or pageHeightMm, if it's hidden it shouldn't accept drops realistically.
      
      const footerHeight = parseTypstUnit(schema.zones.footer?.minHeight || '0mm');
      return pageHeightMm - footerHeight;
    }

    let offset = 0;

    // 1. Report Header (Only on first page unless repeated)
    if (isHeaderRepeated || isFirstPage) {
      offset += parseTypstUnit(schema.zones.header?.minHeight || '0mm');
    }

    // 2. Group Headers
    if (zoneKey === 'body') {
      for (const group of schema.groups || []) {
        offset += parseTypstUnit(group.header?.minHeight || '0mm');
      }
      return offset;
    }

    return offset;
  },

  /**
   * Calculates the specific Y offset for a grouping band.
   */
  calculateBandOffset(
    groupId: string,
    groupType: 'header' | 'footer',
    schema: any,
    pageId?: string
  ): number {
    const isFirstPage = !pageId || pageId === schema.pages[0]?.id;
    const isHeaderRepeated = schema.zones.header?.repeatOnEveryPage === true;

    let offset = 0;
    if (isHeaderRepeated || isFirstPage) {
      offset += parseTypstUnit(schema.zones.header?.minHeight || '0mm');
    }

    if (groupType === 'header') {
      for (const group of schema.groups || []) {
        if (group.id === groupId) return offset;
        offset += parseTypstUnit(group.header?.minHeight || '0mm');
      }
    } else {
      // Group Footers are anchored to the bottom of the page, stacked above the main Footer
      const { height: pageHeightMm } = getPaperDimensions(
        schema.page.size,
        schema.page.orientation
      );
      
      let bottomOffset = pageHeightMm;
      
      // Subtract the main Footer height if it's visible on this page
      const pageIndex = schema.pages.findIndex((p: any) => p.id === pageId);
      const pIdx = pageIndex >= 0 ? pageIndex : 0;
      const isFooterRepeated = schema.zones.footer?.repeatOnEveryPage === true;
      const showOnLastPageOnly = schema.zones.footer?.showOnLastPageOnly === true;
      const isLastPage = pIdx === schema.pages.length - 1;
      
      const isFooterVisible = isFooterRepeated || (showOnLastPageOnly && isLastPage) || (!isFooterRepeated && !showOnLastPageOnly && pIdx === 0);
      
      if (isFooterVisible) {
        bottomOffset -= parseTypstUnit(schema.zones.footer?.minHeight || '0mm');
      }

      // Group Footers are rendered in REVERSE order in Canvas.tsx
      const reversedGroups = [...(schema.groups || [])].reverse();
      for (const group of reversedGroups) {
        const groupFooterHeight = parseTypstUnit(group.footer?.minHeight || '0mm');
        bottomOffset -= groupFooterHeight;
        if (group.id === groupId) return bottomOffset;
      }
    }

    return offset;
  },

  /**
   * Validates if a position is within bounds.
   *
   * @param x - X coordinate in mm
   * @param y - Y coordinate in mm
   * @param containerWidth - Container width in mm
   * @param containerHeight - Container height in mm
   * @returns true if position is within bounds
   */
  isPositionInBounds(
    x: number,
    y: number,
    containerWidth: number,
    containerHeight: number
  ): boolean {
    return x >= 0 && y >= 0 && x <= containerWidth && y <= containerHeight;
  },

  /**
   * Calculates the distance between two points in millimeters.
   *
   * @param x1 - First point X (mm)
   * @param y1 - First point Y (mm)
   * @param x2 - Second point X (mm)
   * @param y2 - Second point Y (mm)
   * @returns Distance in mm
   */
  distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /**
   * Finds the nearest snap point for a given value.
   * Useful for showing snap guides or indicators.
   *
   * @param value - Value to find snap point for (mm)
   * @param step - Grid step size (mm)
   * @returns The nearest snapped value
   */
  findNearestSnapPoint(value: number, step: number = SNAP_GRID_MM): number {
    return Math.round(value / step) * step;
  },

  /**
   * Sets up automatic DPI change monitoring.
   * Call this once during app initialization to keep position calculations accurate
   * when the user zooms the browser or moves between displays.
   *
   * @returns Cleanup function to remove event listeners
   *
   * @example
   * ```ts
   * useEffect(() => {
   *   const cleanup = LayoutEngine.setupDpiMonitoring();
   *   return cleanup;
   * }, []);
   * ```
   */
  setupDpiMonitoring(): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    let resizeTimeout: number | undefined;

    const handleResize = () => {
      // Debounce to avoid excessive calculations
      if (resizeTimeout) {
        window.clearTimeout(resizeTimeout);
      }

      resizeTimeout = window.setTimeout(() => {
        updateDpiRatio();
        // Force re-render of any components using LayoutEngine
        window.dispatchEvent(new CustomEvent('layoutEngine-dpi-changed'));
      }, 150);
    };

    // Listen for resize events (covers browser zoom and display changes)
    window.addEventListener('resize', handleResize);

    // Also listen for the specific zoom event (Chrome)
    if ('visualViewport' in window) {
      window.visualViewport?.addEventListener('resize', handleResize);
    }

    // Return cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      if ('visualViewport' in window) {
        window.visualViewport?.removeEventListener('resize', handleResize);
      }
      if (resizeTimeout) {
        window.clearTimeout(resizeTimeout);
      }
    };
  },

  /**
   * Gets information about the current coordinate system for debugging.
   *
   * @returns Object with DPI and coordinate system info
   */
  getDebugInfo(): {
    dpiRatio: number;
    baseDpi: number;
    effectiveDpi: number;
    pxPerMm: number;
    mmPerPx: number;
  } {
    const dpiRatio = getDpiRatio();
    return {
      dpiRatio,
      baseDpi: 96,
      effectiveDpi: 96 * dpiRatio,
      pxPerMm: mmToPxAtCurrentDpi(1),
      mmPerPx: pxToMmAtCurrentDpi(1),
    };
  },

  /**
   * Calculates magnetic snap positions relative to other components and page boundaries.
   * Supports snapping to edges (Left, Right, Top, Bottom) and Centers.
   *
   * @param rect - The bounding box of the dragging component(s)
   * @param targets - Bounding boxes of other potential snap targets
   * @param threshold - Snap distance threshold in mm (default: 2mm)
   * @returns Snapped coordinates and active guide positions
   */
  calculateMagneticSnap(
    rect: { x: number; y: number; width: number; height: number },
    targets: { x: number; y: number; width: number; height: number }[],
    threshold: number = 2
  ) {
    const guides = { vertical: [] as number[], horizontal: [] as number[] };
    let snappedX = rect.x;
    let snappedY = rect.y;

    // My snap points: [Left, CenterH, Right]
    const myX = [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
    // My snap points: [Top, CenterV, Bottom]
    const myY = [rect.y, rect.y + rect.height / 2, rect.y + rect.height];

    let minDX = threshold;
    let minDY = threshold;
    let xSnapped = false;
    let ySnapped = false;

    for (const t of targets) {
      // Target points: [Left, CenterH, Right]
      const tX = [t.x, t.x + t.width / 2, t.x + t.width];
      // Target points: [Top, CenterV, Bottom]
      const tY = [t.y, t.y + t.height / 2, t.y + t.height];

      // Check vertical guides (X alignment)
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const dx = Math.abs(myX[i] - tX[j]);
          if (dx <= minDX) {
            if (dx < minDX || !xSnapped) {
              minDX = dx;
              xSnapped = true;
              // Adjust snappedX so that our point 'i' aligns with target point 'j'
              snappedX = tX[j] - (i === 1 ? rect.width / 2 : i === 2 ? rect.width : 0);
              guides.vertical = [tX[j]];
            } else if (dx === minDX) {
              if (!guides.vertical.includes(tX[j])) {
                guides.vertical.push(tX[j]);
              }
            }
          }
        }
      }

      // Check horizontal guides (Y alignment)
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const dy = Math.abs(myY[i] - tY[j]);
          if (dy <= minDY) {
            if (dy < minDY || !ySnapped) {
              minDY = dy;
              ySnapped = true;
              // Adjust snappedY so that our point 'i' aligns with target point 'j'
              snappedY = tY[j] - (i === 1 ? rect.height / 2 : i === 2 ? rect.height : 0);
              guides.horizontal = [tY[j]];
            } else if (dy === minDY) {
              if (!guides.horizontal.includes(tY[j])) {
                guides.horizontal.push(tY[j]);
              }
            }
          }
        }
      }
    }

    return { x: snappedX, y: snappedY, guides };
  },
};
