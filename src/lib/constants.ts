/*
 * Standard DPI mapping for web displays.
 * Browser CSS units (cm, mm, in) are based on 96 DPI (96px = 1 inch).
 * We use this fixed ratio to map Designer pixels to PDF millimeters accurately,
 * regardless of the physical screen resolution or browser zoom (which handles scaling automatically).
 */

const DPI = 96;
const MM_PER_INCH = 25.4;

/**
 * Converts millimeters to logical CSS pixels.
 */
export function mmToPx(mm: number): number {
  return mm * (DPI / MM_PER_INCH);
}

/**
 * Converts logical CSS pixels to millimeters.
 */
export function pxToMm(px: number): number {
  return px / (DPI / MM_PER_INCH);
}

// Re-export legacy/helper names for backward compatibility if needed,
// but pointing to the new stable logic.
export const mmToPxAtCurrentDpi = mmToPx;
export const pxToMmAtCurrentDpi = pxToMm;

export function getDpiRatio(): number {
  return 1; // Standardized logical ratio
}

export function updateDpiRatio(): void {
  // No-op: we now rely on standard logical pixels
}

export const SNAP_GRID_MM = 0.1;
