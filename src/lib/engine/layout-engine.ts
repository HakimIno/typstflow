import { MM_PER_PX, PX_PER_MM, SNAP_GRID_MM } from '../constants';

/**
 * High-performance Coordinate & Layout Engine for TypstFlow.
 * Centralizes all coordinate math, snapping, and alignment logic.
 */
export class LayoutEngine {
  /**
   * Converts screen pixels to physical millimeters at 96 DPI.
   */
  static pxToMm(px: number): number {
    return px * MM_PER_PX;
  }

  /**
   * Converts physical millimeters to screen pixels at 96 DPI.
   */
  static mmToPx(mm: number): number {
    return mm * PX_PER_MM;
  }

  /**
   * Snaps a value to the defined grid (default 1mm).
   */
  static snap(value: number, step: number = SNAP_GRID_MM): number {
    return Math.round(value / step) * step;
  }

  /**
   * Calculates the position of a component relative to its container, 
   * applying snapping and bounds checking.
   */
  static calculateDropPosition(
    clientX: number, 
    clientY: number, 
    containerRect: DOMRect,
    dragOffsetX: number = 0,
    dragOffsetY: number = 0
  ): { x: number, y: number } {
    const rawX = this.pxToMm(clientX - containerRect.left - dragOffsetX);
    const rawY = this.pxToMm(clientY - containerRect.top - dragOffsetY);

    return {
      x: Math.max(0, this.snap(rawX)),
      y: Math.max(0, this.snap(rawY))
    };
  }
}
