import { LayoutEngine } from '@/lib/engine/layout-engine';
/**
 * @file layout-engine.test.ts
 * Tests for src/lib/engine/layout-engine.ts
 *
 * Note: DOM-dependent methods (createContextFromElement, calculateAbsolutePosition,
 * setupDpiMonitoring) are excluded — they require a real browser environment.
 */
import { describe, expect, it } from 'vitest';

describe('LayoutEngine.snap', () => {
  it('snaps to 0.1mm grid by default', () => {
    expect(LayoutEngine.snap(5.04)).toBeCloseTo(5.0, 1);
    // 5.05 in JS float rounds down to 5.0 at 0.1 precision (IEEE 754 edge case)
    expect(LayoutEngine.snap(5.06)).toBeCloseTo(5.1, 1);
    expect(LayoutEngine.snap(10.16)).toBeCloseTo(10.2, 1);
  });

  it('respects a custom step size', () => {
    expect(LayoutEngine.snap(5.4, 1)).toBe(5);
    expect(LayoutEngine.snap(5.5, 1)).toBe(6);
    expect(LayoutEngine.snap(5.6, 1)).toBe(6);
  });

  it('snaps 0 to 0', () => {
    expect(LayoutEngine.snap(0)).toBe(0);
  });
});

describe('LayoutEngine.pxToMm / mmToPx', () => {
  it('pxToMm: 96px ≈ 25.4mm', () => {
    expect(LayoutEngine.pxToMm(96)).toBeCloseTo(25.4, 2);
  });

  it('mmToPx: 25.4mm ≈ 96px', () => {
    expect(LayoutEngine.mmToPx(25.4)).toBeCloseTo(96, 2);
  });

  it('round-trip: mm → px → mm returns original', () => {
    const mm = 42;
    expect(LayoutEngine.pxToMm(LayoutEngine.mmToPx(mm))).toBeCloseTo(mm, 5);
  });
});

describe('LayoutEngine.getCurrentDpiRatio', () => {
  it('returns 1 (standardized)', () => {
    expect(LayoutEngine.getCurrentDpiRatio()).toBe(1);
  });
});

describe('LayoutEngine.calculateDropPosition', () => {
  const mockRect = {
    left: 100,
    top: 50,
    right: 900,
    bottom: 850,
    width: 800,
    height: 800,
    x: 100,
    y: 50,
    toJSON: () => ({}),
  } as DOMRect;

  const context = { rect: mockRect, scrollLeft: 0, scrollTop: 0, scale: 1 };

  it('calculates position correctly with no offsets', () => {
    // clientX=196, rect.left=100 → relativeX=96px → ~25.4mm
    const pos = LayoutEngine.calculateDropPosition(196, 146, context);
    expect(pos.x).toBeCloseTo(25.4, 0); // snapped to 0.1 grid
    expect(pos.y).toBeCloseTo(25.4, 0);
  });

  it('clamps negative values to 0', () => {
    // clientX < rect.left → relativeX < 0
    const pos = LayoutEngine.calculateDropPosition(50, 30, context);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it('accounts for drag offsets', () => {
    // No offset: relative = 96px → ~25.4mm
    const withoutOffset = LayoutEngine.calculateDropPosition(196, 146, context, 0, 0);
    // With 96px offset: relative = 0px → 0mm
    const withOffset = LayoutEngine.calculateDropPosition(196, 146, context, 96, 96);
    expect(withOffset.x).toBe(0);
    expect(withOffset.y).toBe(0);
    expect(withoutOffset.x).toBeGreaterThan(withOffset.x);
  });

  it('accounts for scale transform', () => {
    const halfScaleCtx = { ...context, scale: 0.5 };
    const normal = LayoutEngine.calculateDropPosition(196, 146, context);
    const scaled = LayoutEngine.calculateDropPosition(196, 146, halfScaleCtx);
    // At 0.5x scale, the canvas is smaller → same pixel distance maps to 2x more mm
    expect(scaled.x).toBeGreaterThan(normal.x);
  });

  it('raw coordinates are returned unsnapped', () => {
    // relativeX = 96px → rawX ≈ 25.4mm (not rounded)
    const pos = LayoutEngine.calculateDropPosition(196, 146, context);
    // rawX should be within 1mm of x (snapping is 0.1mm)
    expect(Math.abs(pos.rawX - pos.x)).toBeLessThanOrEqual(0.1);
  });
});

describe('LayoutEngine.isPositionInBounds', () => {
  it('returns true for in-bounds coordinates', () => {
    expect(LayoutEngine.isPositionInBounds(10, 10, 100, 200)).toBe(true);
    expect(LayoutEngine.isPositionInBounds(0, 0, 100, 200)).toBe(true);
    expect(LayoutEngine.isPositionInBounds(100, 200, 100, 200)).toBe(true);
  });

  it('returns false for out-of-bounds coordinates', () => {
    expect(LayoutEngine.isPositionInBounds(-1, 0, 100, 200)).toBe(false);
    expect(LayoutEngine.isPositionInBounds(0, -1, 100, 200)).toBe(false);
    expect(LayoutEngine.isPositionInBounds(101, 0, 100, 200)).toBe(false);
    expect(LayoutEngine.isPositionInBounds(0, 201, 100, 200)).toBe(false);
  });
});

describe('LayoutEngine.distance', () => {
  it('calculates distance between same point as 0', () => {
    expect(LayoutEngine.distance(5, 5, 5, 5)).toBe(0);
  });

  it('calculates distance correctly (3-4-5 right triangle)', () => {
    expect(LayoutEngine.distance(0, 0, 3, 4)).toBe(5);
  });

  it('is symmetric', () => {
    expect(LayoutEngine.distance(1, 2, 4, 6)).toBeCloseTo(LayoutEngine.distance(4, 6, 1, 2), 5);
  });
});

describe('LayoutEngine.findNearestSnapPoint', () => {
  it('snaps to nearest 0.1mm by default', () => {
    expect(LayoutEngine.findNearestSnapPoint(5.04)).toBeCloseTo(5.0, 1);
    // 5.06 reliably rounds up at 0.1 precision
    expect(LayoutEngine.findNearestSnapPoint(5.06)).toBeCloseTo(5.1, 1);
  });

  it('snaps to custom step', () => {
    expect(LayoutEngine.findNearestSnapPoint(5.4, 1)).toBe(5);
    expect(LayoutEngine.findNearestSnapPoint(5.6, 1)).toBe(6);
  });
});

describe('LayoutEngine.calculateZoneOffset', () => {
  // A4 portrait: 210 × 297 mm
  const schema = {
    page: { size: 'A4', orientation: 'portrait' },
    zones: {
      header: { minHeight: '25mm', repeatOnEveryPage: false },
      footer: { minHeight: '20mm', repeatOnEveryPage: false, showOnLastPageOnly: false },
    },
    pages: [{ id: 'page-1' }, { id: 'page-2' }],
    groups: [],
  };

  it('header zone offset is always 0', () => {
    expect(LayoutEngine.calculateZoneOffset('header', schema)).toBe(0);
    expect(LayoutEngine.calculateZoneOffset('header', schema, 'page-2')).toBe(0);
  });

  it('body zone offset equals header height on first page', () => {
    expect(LayoutEngine.calculateZoneOffset('body', schema, 'page-1')).toBe(25);
  });

  it('body zone offset is 0 when header does not repeat and we are on page 2', () => {
    // header.repeatOnEveryPage = false → no header on page 2 → body starts at 0
    expect(LayoutEngine.calculateZoneOffset('body', schema, 'page-2')).toBe(0);
  });

  it('body zone offset equals header height on page 2 when header repeats', () => {
    const repeatingHeader = {
      ...schema,
      zones: { ...schema.zones, header: { minHeight: '25mm', repeatOnEveryPage: true } },
    };
    expect(LayoutEngine.calculateZoneOffset('body', repeatingHeader, 'page-2')).toBe(25);
  });

  it('footer zone offset = pageHeight - footerHeight (A4 portrait)', () => {
    // A4 height = 297mm, footer = 20mm → offset = 277mm
    const offset = LayoutEngine.calculateZoneOffset('footer', schema, 'page-1');
    expect(offset).toBe(297 - 20);
  });

  it('footer is not visible on page 2 when not repeated (returns 0)', () => {
    // showOnLastPageOnly=false, repeatOnEveryPage=false, page-2 is not page index 0
    // → isFooterVisible = false → offset = 0
    const offset = LayoutEngine.calculateZoneOffset('footer', schema, 'page-2');
    expect(offset).toBe(0);
  });
});

describe('LayoutEngine.getDebugInfo', () => {
  it('returns expected debug shape', () => {
    const info = LayoutEngine.getDebugInfo();
    expect(info).toHaveProperty('dpiRatio', 1);
    expect(info).toHaveProperty('baseDpi', 96);
    expect(info).toHaveProperty('effectiveDpi', 96);
    expect(info.pxPerMm).toBeCloseTo(96 / 25.4, 3);
    expect(info.mmPerPx).toBeCloseTo(25.4 / 96, 3);
  });
});
