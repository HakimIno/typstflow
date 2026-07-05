import { alignSelectedTableCells } from '@/lib/utils/table-utils';
import type { FormTableComponent, TableComponent, TableRow } from '@/types/schema';
import { describe, expect, it } from 'vitest';

function makeRows(prefix: string): TableRow[] {
  return [
    {
      id: `${prefix}-r1`,
      type: 'data',
      cells: [
        { id: `${prefix}-c1`, content: 'A' },
        { id: `${prefix}-c2`, content: 'B' },
      ],
    },
  ];
}

function makeTable(overrides: Partial<TableComponent> = {}): TableComponent {
  return {
    id: 'table-1',
    type: 'table',
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    dataSource: '{{items}}',
    columns: [
      { id: 'col-1', header: 'A', field: 'a', width: '1fr' },
      { id: 'col-2', header: 'B', field: 'b', width: '1fr' },
    ],
    style: {},
    showHeader: true,
    repeatHeaderOnPage: true,
    ...overrides,
  };
}

describe('alignSelectedTableCells', () => {
  it('aligns selected structured cells by logical column', () => {
    const table = makeTable({ detailRows: makeRows('d') });
    const updates = alignSelectedTableCells(
      table,
      { section: 'data', rowIds: ['d-r1'], cellIndices: [1] },
      'right'
    );

    const rows = updates.detailRows;
    expect(rows?.[0].cells[0].align).toBeUndefined();
    expect(rows?.[0].cells[1].align).toBe('right');
  });

  it('falls back to column align for legacy data tables without structured rows', () => {
    const table = makeTable();
    const updates = alignSelectedTableCells(
      table,
      { section: 'data', rowIds: ['synthetic'], cellIndices: [0] },
      'center'
    );

    expect(updates.columns?.[0].align).toBe('center');
    expect(updates.columns?.[1].align).toBeUndefined();
  });

  it('writes form-table footer selections to footerGridRows when selected rows live there', () => {
    const table: FormTableComponent = {
      ...makeTable(),
      type: 'form-table',
      footerRows: [],
      footerGridRows: makeRows('fg').map((row) => ({ ...row, type: 'footer' })),
    };

    const updates = alignSelectedTableCells(
      table,
      { section: 'footer', rowIds: ['fg-r1'], cellIndices: [0, 1] },
      'center'
    );

    expect(updates.footerRows).toBeUndefined();
    expect(updates.footerGridRows?.[0].cells.map((cell) => cell.align)).toEqual([
      'center',
      'center',
    ]);
  });
});
