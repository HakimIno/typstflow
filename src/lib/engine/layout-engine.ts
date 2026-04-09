import { MM_PER_PX, PX_PER_MM, SNAP_GRID_MM } from '../constants';

/**
 * High-performance Coordinate & Layout Engine for TypstFlow.
 * Centralizes all coordinate math, snapping, and alignment logic.
 */
export const LayoutEngine = {
  /**
   * Converts screen pixels to physical millimeters at 96 DPI.
   */
  pxToMm(px: number): number {
    return px * MM_PER_PX;
  },

  /**
   * Converts physical millimeters to screen pixels at 96 DPI.
   */
  mmToPx(mm: number): number {
    return mm * PX_PER_MM;
  },

  /**
   * Snaps a value to the defined grid (default 1mm).
   */
  snap(value: number, step: number = SNAP_GRID_MM): number {
    return Math.round(value / step) * step;
  },

  /**
   * Calculates the position of a component relative to its container,
   * applying snapping and bounds checking.
   */
  calculateDropPosition(
    clientX: number,
    clientY: number,
    containerRect: DOMRect,
    dragOffsetX = 0,
    dragOffsetY = 0
  ): { x: number; y: number; rawX: number; rawY: number } {
    const rawX = LayoutEngine.pxToMm(clientX - containerRect.left - dragOffsetX);
    const rawY = LayoutEngine.pxToMm(clientY - containerRect.top - dragOffsetY);

    return {
      x: Math.max(0, LayoutEngine.snap(rawX)),
      y: Math.max(0, LayoutEngine.snap(rawY)),
      rawX,
      rawY,
    };
  },
};
