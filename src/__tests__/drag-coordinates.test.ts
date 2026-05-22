/**
 * @file drag-coordinates.test.ts
 *
 * Comprehensive tests for the drag-and-drop coordinate system.
 *
 * The system has one critical invariant:
 *   ty = mmToPx(snap.y - initialAbsoluteY)  must equal 0 at drag start.
 *
 * This holds only when initialAbsoluteY = component.y (zone-local) + zoneOffset.
 * The old bug used zone-local y directly, causing a jump equal to zoneOffset at drag start.
 */

import {
  getComponentById,
  getComponentPosition,
} from '@/components/designer/component-wrapper/utils';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import type { CoordinateContext } from '@/lib/engine/layout-engine';
import { describe, expect, it } from 'vitest';

// ─── Shared test schema ───────────────────────────────────────────────────────

// A4 portrait: 210 × 297 mm
const A4_H = 297;
const HEADER_H = 20; // mm
const FOOTER_H = 15; // mm

const makeSchema = () => ({
  page: { size: 'A4', orientation: 'portrait' },
  zones: {
    header: {
      minHeight: `${HEADER_H}mm`,
      repeatOnEveryPage: true,
      components: [{ id: 'h1', type: 'text', x: 10, y: 5, width: 50, height: 8 }],
    },
    footer: {
      minHeight: `${FOOTER_H}mm`,
      repeatOnEveryPage: true,
      showOnLastPageOnly: false,
      components: [{ id: 'f1', type: 'text', x: 10, y: 3, width: 50, height: 6 }],
    },
  },
  pages: [
    {
      id: 'page-1',
      body: {
        components: [
          { id: 'b1', type: 'text', x: 30, y: 15, width: 60, height: 10 },
          { id: 'b2', type: 'image', x: 0, y: 50, width: 100, height: 30 },
        ],
      },
    },
    {
      id: 'page-2',
      body: {
        components: [{ id: 'b3', type: 'text', x: 5, y: 8, width: 40, height: 10 }],
      },
    },
  ],
  groups: [],
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a CoordinateContext that mimics a paper container positioned at
 * (paperLeft, paperTop) in the viewport, at the given zoom level.
 *
 * `getBoundingClientRect()` on a `transform: scale(zoom) origin-top-left` element
 * returns left/top unchanged (origin is top-left) but width/height scaled.
 */
function makePaperContext(paperLeft: number, paperTop: number, zoom: number): CoordinateContext {
  const logicalW = LayoutEngine.mmToPx(210); // A4 width in logical px
  const logicalH = LayoutEngine.mmToPx(297); // A4 height in logical px
  return {
    rect: {
      left: paperLeft,
      top: paperTop,
      right: paperLeft + logicalW * zoom,
      bottom: paperTop + logicalH * zoom,
      width: logicalW * zoom,
      height: logicalH * zoom,
      x: paperLeft,
      y: paperTop,
      toJSON: () => ({}),
    } as DOMRect,
    scale: zoom,
  };
}

/**
 * Simulate ComponentWrapper's grab-offset pre-computation.
 * grabMm: grab point distance from component top-left in mm.
 * Returns dragOffsetXpx/Y in VISUAL pixels (already scaled by zoom).
 */
function computeDragOffset(grabMm: { x: number; y: number }, zoom: number) {
  const dragOffsetXpx = LayoutEngine.mmToPx(grabMm.x) * zoom;
  const dragOffsetYpx = LayoutEngine.mmToPx(grabMm.y) * zoom;
  return { dragOffsetXpx, dragOffsetYpx };
}

/**
 * Compute the viewport (clientX, clientY) for a component inside a paper
 * container, accounting for zoom and zone offset.
 */
function componentViewportPos(
  paperLeft: number,
  paperTop: number,
  compX: number, // mm, page-absolute x
  compAbsY: number, // mm, page-absolute y (includes zoneOffset)
  grabMm: { x: number; y: number },
  zoom: number
) {
  const clientX = paperLeft + (LayoutEngine.mmToPx(compX) + LayoutEngine.mmToPx(grabMm.x)) * zoom;
  const clientY = paperTop + (LayoutEngine.mmToPx(compAbsY) + LayoutEngine.mmToPx(grabMm.y)) * zoom;
  return { clientX, clientY };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getComponentPosition (utils)', () => {
  const schema = makeSchema();

  it('finds a component in the header zone', () => {
    const pos = getComponentPosition('h1', schema as any);
    expect(pos).toEqual({ x: 10, y: 5 });
  });

  it('finds a component in the footer zone', () => {
    const pos = getComponentPosition('f1', schema as any);
    expect(pos).toEqual({ x: 10, y: 3 });
  });

  it('finds a component in body on page 1', () => {
    const pos = getComponentPosition('b1', schema as any);
    expect(pos).toEqual({ x: 30, y: 15 });
  });

  it('finds a component in body on page 2', () => {
    const pos = getComponentPosition('b3', schema as any);
    expect(pos).toEqual({ x: 5, y: 8 });
  });

  it('returns null for an unknown id', () => {
    expect(getComponentPosition('nonexistent', schema as any)).toBeNull();
  });

  it('returns zone-local y (NOT absolute page y)', () => {
    // b1 is in body at zone-local y=15. With header=20mm, absolute y would be 35.
    // getComponentPosition must return zone-local 15, not absolute 35.
    const pos = getComponentPosition('b1', schema as any);
    expect(pos?.y).toBe(15);
    expect(pos?.y).not.toBe(15 + HEADER_H);
  });
});

describe('getComponentById (utils)', () => {
  const schema = makeSchema();

  it('returns component + zoneKey for header component', () => {
    const result = getComponentById('h1', schema as any);
    expect(result?.zoneKey).toBe('header');
    expect(result?.component?.id).toBe('h1');
    expect(result?.pageId).toBeUndefined();
  });

  it('returns component + zoneKey + pageId for body component', () => {
    const result = getComponentById('b3', schema as any);
    expect(result?.zoneKey).toBe('body');
    expect(result?.pageId).toBe('page-2');
  });

  it('returns null for unknown id', () => {
    expect(getComponentById('ghost', schema as any)).toBeNull();
  });
});

// ─── Zone offset calculation ──────────────────────────────────────────────────

describe('calculateZoneOffset — drag system boundary conditions', () => {
  const schema = makeSchema();

  it('header: offset = 0', () => {
    expect(LayoutEngine.calculateZoneOffset('header', schema, 'page-1')).toBe(0);
  });

  it('body: offset = headerHeight when header repeats', () => {
    const offset = LayoutEngine.calculateZoneOffset('body', schema, 'page-1');
    expect(offset).toBe(HEADER_H);
  });

  it('footer: offset = pageHeight - footerHeight', () => {
    const offset = LayoutEngine.calculateZoneOffset('footer', schema, 'page-1');
    expect(offset).toBe(A4_H - FOOTER_H);
  });

  it('initialAbsoluteY for header component h1 = y + 0 = 5', () => {
    const zoneOffset = LayoutEngine.calculateZoneOffset('header', schema, 'page-1');
    const absY = 5 + zoneOffset; // zone-local y + offset
    expect(absY).toBe(5);
  });

  it('initialAbsoluteY for body component b1 = y + headerHeight = 35', () => {
    const zoneOffset = LayoutEngine.calculateZoneOffset('body', schema, 'page-1');
    const absY = 15 + zoneOffset;
    expect(absY).toBe(15 + HEADER_H); // 35
  });

  it('initialAbsoluteY for footer component f1 = y + footerOffset', () => {
    const zoneOffset = LayoutEngine.calculateZoneOffset('footer', schema, 'page-1');
    const absY = 3 + zoneOffset;
    expect(absY).toBe(3 + A4_H - FOOTER_H); // 3 + 282 = 285
  });
});

// ─── Zero-jump invariant ──────────────────────────────────────────────────────
//
// At drag start, the mouse is at the grab point of the component.
// calculateDropPosition should return rawY == initialAbsoluteY, making ty == 0.

describe('Zero-jump invariant — ty must be 0 at drag start', () => {
  const PAPER_LEFT = 100;
  const PAPER_TOP = 50;

  function runZeroJumpTest(params: {
    zoneKey: 'header' | 'body' | 'footer';
    compX: number; // zone-local x (mm)
    compY: number; // zone-local y (mm)
    grabMm: { x: number; y: number };
    zoom: number;
    pageId: string;
  }) {
    const schema = makeSchema();
    const { zoneKey, compX, compY, grabMm, zoom, pageId } = params;
    const zoneOffset = LayoutEngine.calculateZoneOffset(zoneKey, schema, pageId);
    const initialAbsoluteY = compY + zoneOffset;

    const context = makePaperContext(PAPER_LEFT, PAPER_TOP, zoom);
    const { dragOffsetXpx, dragOffsetYpx } = computeDragOffset(grabMm, zoom);
    const { clientX, clientY } = componentViewportPos(
      PAPER_LEFT,
      PAPER_TOP,
      compX,
      initialAbsoluteY,
      grabMm,
      zoom
    );

    const pos = LayoutEngine.calculateDropPosition(
      clientX,
      clientY,
      context,
      dragOffsetXpx,
      dragOffsetYpx
    );
    const ty = LayoutEngine.mmToPx(pos.rawY - initialAbsoluteY);

    return { rawY: pos.rawY, initialAbsoluteY, ty };
  }

  it('header component, zoom=1: ty=0 at drag start', () => {
    const { ty } = runZeroJumpTest({
      zoneKey: 'header',
      compX: 10,
      compY: 5,
      grabMm: { x: 5, y: 2 },
      zoom: 1,
      pageId: 'page-1',
    });
    expect(ty).toBeCloseTo(0, 3);
  });

  it('body component, zoom=1: ty=0 at drag start', () => {
    const { ty } = runZeroJumpTest({
      zoneKey: 'body',
      compX: 30,
      compY: 15,
      grabMm: { x: 10, y: 4 },
      zoom: 1,
      pageId: 'page-1',
    });
    expect(ty).toBeCloseTo(0, 3);
  });

  it('body component, zoom=1.5: ty=0 at drag start (zoom-independent)', () => {
    const { ty } = runZeroJumpTest({
      zoneKey: 'body',
      compX: 30,
      compY: 15,
      grabMm: { x: 10, y: 4 },
      zoom: 1.5,
      pageId: 'page-1',
    });
    expect(ty).toBeCloseTo(0, 3);
  });

  it('body component, zoom=0.5: ty=0 at drag start', () => {
    const { ty } = runZeroJumpTest({
      zoneKey: 'body',
      compX: 30,
      compY: 15,
      grabMm: { x: 10, y: 4 },
      zoom: 0.5,
      pageId: 'page-1',
    });
    expect(ty).toBeCloseTo(0, 3);
  });

  it('footer component, zoom=1: ty=0 at drag start', () => {
    const { ty } = runZeroJumpTest({
      zoneKey: 'footer',
      compX: 10,
      compY: 3,
      grabMm: { x: 5, y: 1 },
      zoom: 1,
      pageId: 'page-1',
    });
    expect(ty).toBeCloseTo(0, 3);
  });

  it('footer component, zoom=2: ty=0 at drag start', () => {
    const { ty } = runZeroJumpTest({
      zoneKey: 'footer',
      compX: 10,
      compY: 3,
      grabMm: { x: 5, y: 1 },
      zoom: 2,
      pageId: 'page-1',
    });
    expect(ty).toBeCloseTo(0, 3);
  });

  it('body component top-left grab (0,0): ty=0 at drag start', () => {
    const { ty } = runZeroJumpTest({
      zoneKey: 'body',
      compX: 0,
      compY: 0,
      grabMm: { x: 0, y: 0 },
      zoom: 1,
      pageId: 'page-1',
    });
    expect(ty).toBeCloseTo(0, 3);
  });
});

// ─── Bug regression: old formula caused a jump ───────────────────────────────

describe('Regression: old zone-local y formula causes jump at drag start', () => {
  const PAPER_LEFT = 100;
  const PAPER_TOP = 50;

  it('OLD formula (snap.y - zone-local-y) gives zoneOffset at drag start, NOT 0', () => {
    const schema = makeSchema();
    const compY_zoneLocal = 15; // zone-local y of body component
    const zoneOffset = LayoutEngine.calculateZoneOffset('body', schema, 'page-1'); // = HEADER_H = 20
    const initialAbsoluteY = compY_zoneLocal + zoneOffset; // = 35

    const grabMm = { x: 10, y: 4 };
    const zoom = 1;
    const context = makePaperContext(PAPER_LEFT, PAPER_TOP, zoom);
    const { dragOffsetXpx, dragOffsetYpx } = computeDragOffset(grabMm, zoom);
    const { clientX, clientY } = componentViewportPos(
      PAPER_LEFT,
      PAPER_TOP,
      30,
      initialAbsoluteY,
      grabMm,
      zoom
    );

    const pos = LayoutEngine.calculateDropPosition(
      clientX,
      clientY,
      context,
      dragOffsetXpx,
      dragOffsetYpx
    );

    // OLD (buggy): ty = mmToPx(snap.y - zone-local-y) — non-zero jump
    const ty_old = LayoutEngine.mmToPx(pos.rawY - compY_zoneLocal);
    // NEW (fixed): ty = mmToPx(snap.y - initialAbsoluteY) — zero at drag start
    const ty_new = LayoutEngine.mmToPx(pos.rawY - initialAbsoluteY);

    expect(ty_old).toBeCloseTo(LayoutEngine.mmToPx(zoneOffset), 2); // OLD: jumped by headerHeight!
    expect(ty_new).toBeCloseTo(0, 3); // NEW: no jump ✓
  });

  it('body component with large header (40mm) — old formula jumps 40mm at start', () => {
    const bigHeaderSchema = {
      ...makeSchema(),
      zones: {
        ...makeSchema().zones,
        header: { minHeight: '40mm', repeatOnEveryPage: true, components: [] },
      },
    };
    const compY_zoneLocal = 10;
    const zoneOffset = LayoutEngine.calculateZoneOffset('body', bigHeaderSchema, 'page-1'); // = 40
    const initialAbsoluteY = compY_zoneLocal + zoneOffset; // = 50

    const grabMm = { x: 5, y: 2 };
    const zoom = 1;
    const context = makePaperContext(100, 50, zoom);
    const { dragOffsetXpx, dragOffsetYpx } = computeDragOffset(grabMm, zoom);
    const { clientX, clientY } = componentViewportPos(100, 50, 20, initialAbsoluteY, grabMm, zoom);

    const pos = LayoutEngine.calculateDropPosition(
      clientX,
      clientY,
      context,
      dragOffsetXpx,
      dragOffsetYpx
    );

    const ty_old = LayoutEngine.mmToPx(pos.rawY - compY_zoneLocal); // buggy
    const ty_new = LayoutEngine.mmToPx(pos.rawY - initialAbsoluteY); // fixed

    // Old formula causes 40mm jump at drag start
    expect(Math.abs(ty_old)).toBeGreaterThan(LayoutEngine.mmToPx(35)); // close to 40mm
    expect(ty_new).toBeCloseTo(0, 3);
  });
});

// ─── Mouse delta → component follows 1:1 ─────────────────────────────────────

describe('Drag delta: component movement equals mouse delta in logical px', () => {
  const PAPER_LEFT = 100;
  const PAPER_TOP = 50;

  it('moving mouse 20mm right: tx = mmToPx(20) logical px', () => {
    const schema = makeSchema();
    const zoneOffset = LayoutEngine.calculateZoneOffset('body', schema, 'page-1');
    const initialAbsoluteY = 15 + zoneOffset;
    const grabMm = { x: 10, y: 4 };
    const zoom = 1;

    const context = makePaperContext(PAPER_LEFT, PAPER_TOP, zoom);
    const { dragOffsetXpx, dragOffsetYpx } = computeDragOffset(grabMm, zoom);
    const { clientX: startX, clientY: startY } = componentViewportPos(
      PAPER_LEFT,
      PAPER_TOP,
      30,
      initialAbsoluteY,
      grabMm,
      zoom
    );

    // Move mouse 20mm right (visual = 20mm * zoom = 20px at zoom=1)
    const deltaVisualPx = LayoutEngine.mmToPx(20) * zoom;
    const pos = LayoutEngine.calculateDropPosition(
      startX + deltaVisualPx,
      startY,
      context,
      dragOffsetXpx,
      dragOffsetYpx
    );
    const tx = LayoutEngine.mmToPx(pos.rawX - 30); // comp.x = 30mm

    // The component should move 20mm in logical px
    expect(tx).toBeCloseTo(LayoutEngine.mmToPx(20), 2);
  });

  it('moving mouse 10mm down at zoom=1.5: ty = mmToPx(10) logical px', () => {
    const schema = makeSchema();
    const zoneOffset = LayoutEngine.calculateZoneOffset('body', schema, 'page-1');
    const initialAbsoluteY = 15 + zoneOffset;
    const grabMm = { x: 10, y: 4 };
    const zoom = 1.5;

    const context = makePaperContext(PAPER_LEFT, PAPER_TOP, zoom);
    const { dragOffsetXpx, dragOffsetYpx } = computeDragOffset(grabMm, zoom);
    const { clientX: startX, clientY: startY } = componentViewportPos(
      PAPER_LEFT,
      PAPER_TOP,
      30,
      initialAbsoluteY,
      grabMm,
      zoom
    );

    // Move mouse 10mm down visually (visual px = 10mm * zoom)
    const deltaVisualPx = LayoutEngine.mmToPx(10) * zoom;
    const pos = LayoutEngine.calculateDropPosition(
      startX,
      startY + deltaVisualPx,
      context,
      dragOffsetXpx,
      dragOffsetYpx
    );
    const ty = LayoutEngine.mmToPx(pos.rawY - initialAbsoluteY);

    // logical px movement should equal mmToPx(10) regardless of zoom
    expect(ty).toBeCloseTo(LayoutEngine.mmToPx(10), 2);
  });

  it('visual movement = ty * zoom = delta_visual_px (zoom=2)', () => {
    const schema = makeSchema();
    const zoneOffset = LayoutEngine.calculateZoneOffset('body', schema, 'page-1');
    const initialAbsoluteY = 15 + zoneOffset;
    const grabMm = { x: 5, y: 2 };
    const zoom = 2;

    const context = makePaperContext(PAPER_LEFT, PAPER_TOP, zoom);
    const { dragOffsetXpx, dragOffsetYpx } = computeDragOffset(grabMm, zoom);
    const { clientX: startX, clientY: startY } = componentViewportPos(
      PAPER_LEFT,
      PAPER_TOP,
      30,
      initialAbsoluteY,
      grabMm,
      zoom
    );

    const moveMm = 15;
    const deltaVisualPx = LayoutEngine.mmToPx(moveMm) * zoom;
    const pos = LayoutEngine.calculateDropPosition(
      startX,
      startY + deltaVisualPx,
      context,
      dragOffsetXpx,
      dragOffsetYpx
    );
    const ty = LayoutEngine.mmToPx(pos.rawY - initialAbsoluteY);

    // ty is in logical pixels; visual display = ty * zoom (inside scaled container)
    expect(ty * zoom).toBeCloseTo(deltaVisualPx, 2);
  });

  it('visual movement = ty * zoom = delta_visual_px (zoom=0.5)', () => {
    const schema = makeSchema();
    const zoneOffset = LayoutEngine.calculateZoneOffset('body', schema, 'page-1');
    const initialAbsoluteY = 15 + zoneOffset;
    const grabMm = { x: 5, y: 2 };
    const zoom = 0.5;

    const context = makePaperContext(PAPER_LEFT, PAPER_TOP, zoom);
    const { dragOffsetXpx, dragOffsetYpx } = computeDragOffset(grabMm, zoom);
    const { clientX: startX, clientY: startY } = componentViewportPos(
      PAPER_LEFT,
      PAPER_TOP,
      30,
      initialAbsoluteY,
      grabMm,
      zoom
    );

    const moveMm = 12;
    const deltaVisualPx = LayoutEngine.mmToPx(moveMm) * zoom;
    const pos = LayoutEngine.calculateDropPosition(
      startX,
      startY + deltaVisualPx,
      context,
      dragOffsetXpx,
      dragOffsetYpx
    );
    const ty = LayoutEngine.mmToPx(pos.rawY - initialAbsoluteY);

    expect(ty * zoom).toBeCloseTo(deltaVisualPx, 2);
  });
});

// ─── Drop position formula ────────────────────────────────────────────────────
//
// On pointer-up: finalY = lastSnappedY - dstZoneOffset
// This converts the page-absolute snapped y back to zone-local y for storage.

describe('Drop position formula: lastSnappedY - zoneOffset = zone-local y', () => {
  const schema = makeSchema();

  it('same-zone drop in body: zone-local y is restored', () => {
    const targetY = 40; // absolute page y where user drops
    const dstZoneOffset = LayoutEngine.calculateZoneOffset('body', schema, 'page-1');
    const storedY = targetY - dstZoneOffset; // what gets written to component.y
    expect(storedY).toBe(40 - HEADER_H); // 20mm zone-local
  });

  it('cross-zone drop body → header: zone offset is 0, stored y = absolute y', () => {
    const snapY = 10; // absolute page y
    const dstZoneOffset = LayoutEngine.calculateZoneOffset('header', schema, 'page-1');
    expect(dstZoneOffset).toBe(0);
    const storedY = snapY - dstZoneOffset;
    expect(storedY).toBe(10); // zone-local = absolute (no offset)
  });

  it('cross-zone drop header → body: stored y = snapY - headerHeight', () => {
    const snapY = 30; // absolute page y after dropping into body
    const dstZoneOffset = LayoutEngine.calculateZoneOffset('body', schema, 'page-1');
    const storedY = snapY - dstZoneOffset;
    expect(storedY).toBe(30 - HEADER_H); // 10mm in body zone
  });

  it('drop in footer: stored y is distance from footer top', () => {
    const footerOffset = LayoutEngine.calculateZoneOffset('footer', schema, 'page-1');
    const snapY = footerOffset + 5; // 5mm into footer
    const storedY = snapY - footerOffset;
    expect(storedY).toBe(5);
  });

  it('stored y is never negative for valid snap positions', () => {
    // If snap.y lands inside body zone, storedY >= 0
    const bodyOffset = LayoutEngine.calculateZoneOffset('body', schema, 'page-1');
    const snapY = bodyOffset + 0; // exactly at zone start
    const storedY = snapY - bodyOffset;
    expect(storedY).toBeGreaterThanOrEqual(0);
  });
});

// ─── calculateMagneticSnap ────────────────────────────────────────────────────

describe('calculateMagneticSnap', () => {
  const dragging = { x: 50, y: 80, width: 30, height: 10 };

  it('no targets → returns raw position unchanged', () => {
    const snap = LayoutEngine.calculateMagneticSnap(dragging, []);
    expect(snap.x).toBe(50);
    expect(snap.y).toBe(80);
    expect(snap.guides.vertical).toHaveLength(0);
    expect(snap.guides.horizontal).toHaveLength(0);
  });

  it('target outside threshold → no snap, no guides', () => {
    const far = { x: 100, y: 200, width: 30, height: 10 };
    const snap = LayoutEngine.calculateMagneticSnap(dragging, [far], 2);
    expect(snap.x).toBe(50);
    expect(snap.y).toBe(80);
    expect(snap.guides.vertical).toHaveLength(0);
    expect(snap.guides.horizontal).toHaveLength(0);
  });

  it('left-edge to left-edge snap: dragging.x ≈ target.x', () => {
    // dragging.x=50, target.x=51 → within 2mm threshold
    const target = { x: 51, y: 200, width: 30, height: 10 };
    const snap = LayoutEngine.calculateMagneticSnap(dragging, [target], 2);
    expect(snap.x).toBe(51); // snapped to target left
    expect(snap.guides.vertical).toContain(51);
  });

  it('right-to-right edge snap: dragging.right ≈ target.right', () => {
    // dragging right = 50+30=80, target right = 81 → within threshold
    const target = { x: 51, y: 200, width: 30, height: 10 }; // right = 81
    const snap = LayoutEngine.calculateMagneticSnap(dragging, [target], 2);
    // dragging.x+w=80 snaps to target.x+w=81 → dragging.x = 81-30 = 51
    expect(snap.x).toBe(51);
  });

  it('center-to-center horizontal snap', () => {
    // dragging center_x = 50+15=65, target center_x = 66 → within threshold
    const target = { x: 51, y: 200, width: 30, height: 10 }; // center=66
    const snap = LayoutEngine.calculateMagneticSnap(dragging, [target], 2);
    // could snap center 65→66: dragging.x = 66-15 = 51
    expect(snap.x).toBe(51);
  });

  it('top-to-top vertical snap: dragging.y ≈ target.y', () => {
    const target = { x: 200, y: 81, width: 30, height: 10 }; // y=81, dragging.y=80
    const snap = LayoutEngine.calculateMagneticSnap(dragging, [target], 2);
    expect(snap.y).toBe(81);
    expect(snap.guides.horizontal).toContain(81);
  });

  it('bottom-to-top snap: dragging.bottom ≈ target.y', () => {
    // dragging bottom = 80+10=90, target.y=91 → within threshold
    const target = { x: 200, y: 91, width: 30, height: 10 };
    const snap = LayoutEngine.calculateMagneticSnap(dragging, [target], 2);
    // dragging.y + h = 90 snaps to target.y = 91 → dragging.y = 91 - 10 = 81
    expect(snap.y).toBe(81);
  });

  it('snaps both X and Y simultaneously', () => {
    const target = { x: 51, y: 81, width: 30, height: 10 };
    const snap = LayoutEngine.calculateMagneticSnap(dragging, [target], 2);
    expect(snap.guides.vertical.length).toBeGreaterThan(0);
    expect(snap.guides.horizontal.length).toBeGreaterThan(0);
  });

  it('nearest target wins when multiple in range', () => {
    const close = { x: 50.5, y: 80.5, width: 30, height: 10 }; // 0.5mm away
    const far = { x: 51.5, y: 81.5, width: 30, height: 10 }; // 1.5mm away
    const snap = LayoutEngine.calculateMagneticSnap(dragging, [close, far], 2);
    expect(snap.x).toBe(50.5); // closer target wins
    expect(snap.y).toBe(80.5);
  });

  it('exactly at threshold boundary: snaps (<=)', () => {
    const target = { x: 52, y: 82, width: 30, height: 10 }; // 2mm away = threshold
    const snap = LayoutEngine.calculateMagneticSnap(dragging, [target], 2);
    expect(snap.x).toBe(52);
    expect(snap.y).toBe(82);
  });

  it('just beyond threshold: no snap', () => {
    // 2.1mm away, threshold=2 → should NOT snap
    const target = { x: 52.1, y: 82.1, width: 30, height: 10 };
    const snap = LayoutEngine.calculateMagneticSnap(dragging, [target], 2);
    expect(snap.x).toBe(50); // unchanged
    expect(snap.y).toBe(80); // unchanged
  });

  it('guide value is the target edge being snapped to', () => {
    const target = { x: 51, y: 200, width: 30, height: 10 };
    const snap = LayoutEngine.calculateMagneticSnap(dragging, [target], 2);
    // The guide should mark where the snap happened (target.x = 51)
    expect(snap.guides.vertical[0]).toBe(51);
  });
});

// ─── calculateDropPosition — edge cases ──────────────────────────────────────

describe('calculateDropPosition edge cases', () => {
  const ctx = makePaperContext(0, 0, 1);

  it('mouse exactly at paper top-left (no offset): rawX=rawY=0', () => {
    const pos = LayoutEngine.calculateDropPosition(0, 0, ctx, 0, 0);
    expect(pos.rawX).toBeCloseTo(0, 5);
    expect(pos.rawY).toBeCloseTo(0, 5);
  });

  it('negative relative position is clamped to 0 in snapped output', () => {
    // clientX < paper.left → relativeX < 0
    const pos = LayoutEngine.calculateDropPosition(-50, -50, ctx, 0, 0);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
    // rawX/rawY can be negative (they are the unsnapped value)
    expect(pos.rawX).toBeLessThan(0);
  });

  it('scale=2 (zoom-out): same visual delta maps to 2x more mm', () => {
    const ctx1 = makePaperContext(0, 0, 1);
    const ctx2 = makePaperContext(0, 0, 2);
    const deltaPx = 100; // 100 visual pixels of drag
    const pos1 = LayoutEngine.calculateDropPosition(deltaPx, deltaPx, ctx1, 0, 0);
    const pos2 = LayoutEngine.calculateDropPosition(deltaPx, deltaPx, ctx2, 0, 0);
    // at scale=2, relativeX = 100/2 = 50px → 13.2mm
    // at scale=1, relativeX = 100/1 = 100px → 26.5mm
    expect(pos1.rawX).toBeCloseTo(pos2.rawX * 2, 1);
  });

  it('drag offset shifts position correctly', () => {
    // Without offset: position at 96px = ~25.4mm
    const pos0 = LayoutEngine.calculateDropPosition(96, 96, ctx, 0, 0);
    // With 96px offset: position at 0mm
    const pos1 = LayoutEngine.calculateDropPosition(96, 96, ctx, 96, 96);
    expect(pos0.rawX).toBeCloseTo(25.4, 1);
    expect(pos1.rawX).toBeCloseTo(0, 3);
  });

  it('rawX and x differ by at most snap grid (0.1mm)', () => {
    const pos = LayoutEngine.calculateDropPosition(55, 77, ctx, 0, 0);
    expect(Math.abs(pos.rawX - pos.x)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(pos.rawY - pos.y)).toBeLessThanOrEqual(0.1);
  });
});
