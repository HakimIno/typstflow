import { parseTypstUnit } from '@/lib/utils/units';
/**
 * @file units.test.ts
 * Tests for src/lib/utils/units.ts — parseTypstUnit()
 */
import { describe, expect, it } from 'vitest';

describe('parseTypstUnit', () => {
  it('returns 0 for undefined input', () => {
    expect(parseTypstUnit(undefined)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(parseTypstUnit('')).toBe(0);
  });

  it('parses millimeters (mm) correctly', () => {
    expect(parseTypstUnit('15mm')).toBe(15);
    expect(parseTypstUnit('0mm')).toBe(0);
    expect(parseTypstUnit('210mm')).toBe(210);
  });

  it('parses centimeters (cm) correctly — 1cm = 10mm', () => {
    expect(parseTypstUnit('1cm')).toBe(10);
    expect(parseTypstUnit('2.5cm')).toBe(25);
  });

  it('parses inches (in) correctly — 1in = 25.4mm', () => {
    expect(parseTypstUnit('1in')).toBeCloseTo(25.4, 5);
    expect(parseTypstUnit('0.5in')).toBeCloseTo(12.7, 5);
  });

  it('parses points (pt) correctly — 1pt ≈ 0.352778mm', () => {
    expect(parseTypstUnit('1pt')).toBeCloseTo(0.352778, 5);
    expect(parseTypstUnit('72pt')).toBeCloseTo(25.4, 2); // 72pt = 1in ≈ 25.4mm
  });

  it('defaults to pt when no unit is given (Typst default)', () => {
    expect(parseTypstUnit('72')).toBeCloseTo(25.4, 2);
  });

  it('returns 0 for invalid/non-numeric strings', () => {
    expect(parseTypstUnit('abc')).toBe(0);
    expect(parseTypstUnit('auto')).toBe(0);
    expect(parseTypstUnit('1fr')).toBe(0);
  });
});
