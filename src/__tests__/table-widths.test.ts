import { resolveTableColumnPercentages, resolveTableColumnWidths } from '@/lib/utils/table-widths';
import { describe, expect, it } from 'vitest';

describe('table column width resolution', () => {
  it('resolves mixed fixed, percent, and fractional widths to component-width mm', () => {
    const widths = resolveTableColumnWidths(
      [{ width: '30mm' }, { width: '1fr' }, { width: '20%' }],
      100
    );

    expect(widths).toEqual([30, 50, 20]);
  });

  it('uses the same resolved widths for designer percentages', () => {
    const percentages = resolveTableColumnPercentages(
      [{ width: '30mm' }, { width: '1fr' }, { width: '20%' }],
      100
    );

    expect(percentages).toEqual(['30%', '50%', '20%']);
  });

  it('scales fixed-only columns to fill the component width', () => {
    const widths = resolveTableColumnWidths([{ width: '40mm' }, { width: '40mm' }], 100);

    expect(widths).toEqual([50, 50]);
  });

  it('scales overflowing fixed columns down to the component width', () => {
    const widths = resolveTableColumnWidths([{ width: '80mm' }, { width: '80mm' }], 100);

    expect(widths).toEqual([50, 50]);
  });
});
