import {
  SNAP_GRID_MM,
  getDpiRatio,
  mmToPxAtCurrentDpi,
  pxToMmAtCurrentDpi,
  updateDpiRatio,
} from '../constants';
import { parseTypstUnit } from '../utils/units';

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
    // 1. Find the specific paper container or default to the first one
    const selector = pageId
      ? `[data-paper-container][data-page-id="${pageId}"]`
      : '[data-paper-container]';
    const container = document.querySelector(selector) as HTMLElement;
    if (!container) return { x: 0, y: 0, rawX: 0, rawY: 0 };

    // 2. Find the scrollable parent
    const scrollParent = container.closest('.overflow-auto') as HTMLElement;

    // 3. Read zoom scale explicitly from data attribute (set by Canvas.tsx)
    const explicitZoom = Number.parseFloat(container.dataset.zoom || '1');

    // 4. Create context with explicit scale
    const context = this.createContextFromElement(container, explicitZoom);

    // Add scroll info from parent if needed (createContextFromElement uses element's own scroll)
    if (scrollParent) {
      context.scrollLeft = scrollParent.scrollLeft;
      context.scrollTop = scrollParent.scrollTop;
    }

    // 5. Use base drop calculation
    return this.calculateDropPosition(clientX, clientY, context, dragOffsetX, dragOffsetY);
  },

  /**
   * Calculates the cumulative Y offset (mm) from the top of the page to the start of a specific zone.
   * Now includes support for dynamic grouping bands.
   */
  calculateZoneOffset(zoneKey: string, schema: any, pageId?: string): number {
    let offset = 0;

    // Order: Header -> [Group Headers] -> Body -> [Group Footers] -> Footer
    if (zoneKey === 'header') return 0;

    // 1. Report Header
    offset += parseTypstUnit(schema.zones.header.minHeight || '0mm');

    // 2. Group Headers (if target is body or footer)
    if (zoneKey === 'body' || zoneKey === 'footer') {
      for (const group of schema.groups || []) {
        offset += parseTypstUnit(group.header.minHeight || '0mm');
      }
    }

    if (zoneKey === 'body') return offset;

    // 3. Detail Band (Body)
    const page = pageId ? schema.pages.find((p: any) => p.id === pageId) : schema.pages[0];
    const bodyHeight = page ? parseTypstUnit(page.body.minHeight || '0mm') : 0;
    offset += bodyHeight;

    // 4. Group Footers
    if (zoneKey === 'footer') {
      for (const group of schema.groups || []) {
        offset += parseTypstUnit(group.footer.minHeight || '0mm');
      }
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
    let offset = parseTypstUnit(schema.zones.header.minHeight || '0mm');

    if (groupType === 'header') {
      for (const group of schema.groups || []) {
        if (group.id === groupId) return offset;
        offset += parseTypstUnit(group.header.minHeight || '0mm');
      }
    } else {
      // Header + All Group Headers + Body
      for (const group of schema.groups || []) {
        offset += parseTypstUnit(group.header.minHeight || '0mm');
      }
      const page = pageId ? schema.pages.find((p: any) => p.id === pageId) : schema.pages[0];
      offset += page ? parseTypstUnit(page.body.minHeight || '0mm') : 0;

      // Group Footers are rendered in REVERSE order in Canvas.tsx
      const reversedGroups = [...(schema.groups || [])].reverse();
      for (const group of reversedGroups) {
        if (group.id === groupId) return offset;
        offset += parseTypstUnit(group.footer.minHeight || '0mm');
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
};
