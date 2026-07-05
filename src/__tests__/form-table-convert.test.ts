/**
 * @file form-table-convert.test.ts
 * Convert-to-form-table action (Properties panel button). Covers the pure update
 * patches that flip a plain data table into a fixed-height form table and back.
 */
import { dataTableConversionUpdates, formTableConversionUpdates } from '@/lib/utils/form-table';
import type { FormTableComponent, TableComponent } from '@/types/schema';
import { describe, expect, it } from 'vitest';

const baseTable = (over: Partial<TableComponent> = {}): TableComponent => ({
  id: 't1',
  type: 'table',
  x: 0,
  y: 0,
  width: 180,
  height: 40,
  dataSource: '{{items}}',
  showHeader: true,
  repeatHeaderOnPage: true,
  columns: [
    { id: 'c1', header: '#', field: 'no', width: '1fr' },
    { id: 'c2', header: 'Desc', field: 'desc', width: '1fr' },
    { id: 'c3', header: 'Qty', field: 'qty', width: '1fr' },
    { id: 'c4', header: 'Amount', field: 'amount', width: '1fr' },
  ],
  style: {},
  ...over,
});

describe('formTableConversionUpdates', () => {
  it('flips the discriminant and applies fixed-height bottom-mode defaults', () => {
    const updates = formTableConversionUpdates(baseTable());
    expect(updates.type).toBe('form-table');
    expect(updates.footerMode).toBe('bottom');
    expect(updates.bodyMinHeight).toBe('95mm');
  });

  it('seeds a grand-total row totalling the last column by its field', () => {
    const updates = formTableConversionUpdates(baseTable());
    expect(updates.footerSummary).toHaveLength(1);
    const summary = updates.footerSummary?.[0];
    expect(summary?.valueColumn).toBe(3); // last column (Amount)
    expect(summary?.labelColumn).toBe(0); // label spans the leading columns, right-aligned
    expect(summary?.value).toBe('{{SUM(amount)}}'); // valid aggregate on the last field
  });

  it('leaves the value empty when the last column has no field', () => {
    const updates = formTableConversionUpdates(
      baseTable({
        columns: [
          { id: 'c1', header: 'A', field: 'a', width: '1fr' },
          { id: 'c2', header: 'B', field: '', width: '1fr' },
        ],
      })
    );
    expect(updates.footerSummary?.[0].value).toBe('');
  });

  it('preserves an existing summary instead of clobbering user rows', () => {
    const existing: FormTableComponent = {
      ...baseTable(),
      type: 'form-table',
      footerMode: 'flow',
      bodyMinHeight: '120mm',
      footerSummary: [{ id: 'custom', label: 'VAT', value: '{{vat}}' }],
    };
    const updates = formTableConversionUpdates(existing);
    // Existing form-only settings are kept (nullish-coalesced), not reset to defaults.
    expect(updates.footerMode).toBe('flow');
    expect(updates.bodyMinHeight).toBe('120mm');
    expect(updates.footerSummary).toBeUndefined(); // untouched → not included in patch
  });

  it('does not seed a summary for a single-column table (label+value would overflow)', () => {
    const updates = formTableConversionUpdates(
      baseTable({ columns: [{ id: 'c1', header: 'X', field: 'x', width: '1fr' }] })
    );
    // A label cell + value cell cannot fit a 1-column grid without a phantom column,
    // which breaks the preview and Typst — so the seed is skipped entirely.
    expect(updates.footerSummary).toBeUndefined();
    // The conversion itself still succeeds (fixed-height body area is applied).
    expect(updates.type).toBe('form-table');
    expect(updates.bodyMinHeight).toBe('95mm');
  });
});

describe('dataTableConversionUpdates', () => {
  it('reverts the discriminant and clears all form-only fields', () => {
    const updates = dataTableConversionUpdates();
    expect(updates.type).toBe('table');
    expect(updates.footerMode).toBeUndefined();
    expect(updates.bodyMinHeight).toBeUndefined();
    expect(updates.minRows).toBeUndefined();
    expect(updates.footerGridRows).toBeUndefined();
    expect(updates.footerSummary).toBeUndefined();
  });
});
