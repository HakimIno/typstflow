/**
 * Detects the actual DPI/PPI ratio of the current display and browser zoom level.
 * This accounts for:
 * - High DPI screens (Retina, 4K, etc.)
 * - Browser zoom level (Ctrl +/-)
 * - System DPI scaling (Windows 125%/150%)
 *
 * Uses a combination of devicePixelRatio and CSS media queries to get accurate results.
 */
function detectDpiRatio(): number {
  if (typeof window === 'undefined') return 1;

  // Start with device pixel ratio (handles Retina/High DPI)
  let ratio = window.devicePixelRatio || 1;

  // Adjust for browser zoom using matchMedia
  // This is more accurate than devicePixelRatio alone
  const zoomChecks = [
    { query: '(min-resolution: 1.25dppx)', ratio: 1.25 },
    { query: '(min-resolution: 1.5dppx)', ratio: 1.5 },
    { query: '(min-resolution: 2dppx)', ratio: 2 },
    { query: '(min-resolution: 3dppx)', ratio: 3 },
  ];

  for (const { query, ratio: zoomRatio } of zoomChecks) {
    if (window.matchMedia(query).matches) {
      ratio = Math.max(ratio, zoomRatio);
      break;
    }
  }

  // Fallback: Compare client vs inner dimensions to detect browser zoom
  if (window.innerWidth && document.documentElement) {
    const clientWidth = document.documentElement.clientWidth;
    if (clientWidth > 0) {
      const zoomFromClient = window.innerWidth / clientWidth;
      // Only use if it's reasonable (between 0.25x and 4x zoom)
      if (zoomFromClient >= 0.25 && zoomFromClient <= 4) {
        ratio = Math.max(ratio, zoomFromClient);
      }
    }
  }

  return ratio;
}

/**
 * Cached DPI ratio to avoid repeated calculations.
 * Update this if window is resized significantly.
 */
let cachedDpiRatio = detectDpiRatio();

/**
 * Base DPI for standard displays (96 DPI is the web standard).
 * All conversions are based on this as the reference point.
 */
const BASE_DPI = 96;

/**
 * Current DPI ratio considering display and browser zoom.
 * Call updateDpiRatio() after major display changes.
 */
export function getDpiRatio(): number {
  return cachedDpiRatio;
}

/**
 * Updates the cached DPI ratio. Call this after:
 * - Browser zoom changes (Ctrl +/-)
 * - Moving between displays with different DPI
 * - System DPI changes
 */
export function updateDpiRatio(): void {
  cachedDpiRatio = detectDpiRatio();
}

/**
 * Converts millimeters to pixels at the CURRENT detected DPI.
 * This automatically handles:
 * - High DPI screens (Retina displays)
 * - Browser zoom level
 * - System DPI scaling
 */
export function mmToPxAtCurrentDpi(mm: number): number {
  return mm * (BASE_DPI / 25.4) * cachedDpiRatio;
}

/**
 * Converts pixels to millimeters at the CURRENT detected DPI.
 * Reverse of mmToPxAtCurrentDpi.
 */
export function pxToMmAtCurrentDpi(px: number): number {
  return px / ((BASE_DPI / 25.4) * cachedDpiRatio);
}

// Legacy constants for backward compatibility (deprecated)
// @deprecated Use mmToPxAtCurrentDpi() or pxToMmAtCurrentDpi() instead
export const PX_PER_MM = 96 / 25.4;
export const MM_PER_PX = 25.4 / 96;

export const SNAP_GRID_MM = 0.1;
