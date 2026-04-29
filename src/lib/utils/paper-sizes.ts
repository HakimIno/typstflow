/**
 * Paper Size Registry — Single Source of Truth
 *
 * All paper dimensions in millimeters (portrait orientation).
 * For landscape, swap width and height.
 *
 * Supports all standard Typst paper sizes.
 */

export interface PaperDimensions {
  /** Width in mm (portrait) */
  width: number;
  /** Height in mm (portrait) */
  height: number;
}

const PAPER_SIZES: Record<string, PaperDimensions> = {
  // ISO A Series
  A0: { width: 841, height: 1189 },
  A1: { width: 594, height: 841 },
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  A6: { width: 105, height: 148 },
  // ISO B Series
  B4: { width: 250, height: 353 },
  B5: { width: 176, height: 250 },
  // North American
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
  Tabloid: { width: 279.4, height: 431.8 },
  // JIS (Japan)
  'JIS-B4': { width: 257, height: 364 },
  'JIS-B5': { width: 182, height: 257 },
};

/**
 * Get paper dimensions for a given paper size and orientation.
 * Returns dimensions in millimeters.
 *
 * @param size - Paper size name (e.g. "A4", "Letter", "Legal")
 * @param orientation - "portrait" or "landscape"
 * @returns { width, height } in mm
 *
 * @example
 * ```ts
 * const { width, height } = getPaperDimensions("A4", "portrait");
 * // width = 210, height = 297
 *
 * const { width, height } = getPaperDimensions("Letter", "landscape");
 * // width = 279.4, height = 215.9
 * ```
 */
export function getPaperDimensions(size: string, orientation = 'portrait'): PaperDimensions {
  // Case-insensitive lookup
  const key = Object.keys(PAPER_SIZES).find((k) => k.toLowerCase() === size.toLowerCase());
  const base = key ? PAPER_SIZES[key] : PAPER_SIZES.A4; // fallback to A4

  if (orientation === 'landscape') {
    return { width: base.height, height: base.width };
  }
  return { ...base };
}

/**
 * Get paper width in mm for a given size and orientation.
 */
export function getPaperWidth(size: string, orientation = 'portrait'): number {
  return getPaperDimensions(size, orientation).width;
}

/**
 * Get paper height in mm for a given size and orientation.
 */
export function getPaperHeight(size: string, orientation = 'portrait'): number {
  return getPaperDimensions(size, orientation).height;
}
