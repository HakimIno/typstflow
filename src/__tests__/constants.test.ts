/**
 * @file constants.test.ts
 * Tests for src/lib/constants.ts — DPI conversion functions
 */
import { describe, expect, it } from 'vitest';
import { mmToPx, pxToMm, getDpiRatio, SNAP_GRID_MM } from '@/lib/constants';

const DPI = 96;
const MM_PER_INCH = 25.4;
const PX_PER_MM = DPI / MM_PER_INCH; // ≈ 3.7795

describe('mmToPx', () => {
  it('converts 25.4mm to exactly 96px (1 inch at 96 DPI)', () => {
    expect(mmToPx(25.4)).toBeCloseTo(96, 5);
  });

  it('converts 0mm to 0px', () => {
    expect(mmToPx(0)).toBe(0);
  });

  it('converts 210mm (A4 width) to correct px', () => {
    expect(mmToPx(210)).toBeCloseTo(210 * PX_PER_MM, 3);
  });

  it('is the inverse of pxToMm (round-trip px→mm→px)', () => {
    const px = 100;
    // px → mm → px should return original px value
    expect(mmToPx(pxToMm(px))).toBeCloseTo(px, 5);
  });
});

describe('pxToMm', () => {
  it('converts 96px to 25.4mm (1 inch)', () => {
    expect(pxToMm(96)).toBeCloseTo(25.4, 5);
  });

  it('converts 0px to 0mm', () => {
    expect(pxToMm(0)).toBe(0);
  });

  it('is the inverse of mmToPx', () => {
    const px = 100;
    expect(pxToMm(mmToPx(px))).toBeCloseTo(px, 5);
  });
});

describe('getDpiRatio', () => {
  it('returns 1 (standardized logical ratio)', () => {
    expect(getDpiRatio()).toBe(1);
  });
});

describe('SNAP_GRID_MM', () => {
  it('is 0.1mm (sub-mm precision)', () => {
    expect(SNAP_GRID_MM).toBe(0.1);
  });
});
