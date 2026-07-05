/**
 * @file table-sheet-keyboard.test.ts
 * Pure logic behind the sheet keyboard flow (plan Phase 4):
 * flat navigation across sections (table-nav) and TSV clipboard
 * interchange (table-clipboard).
 */
import {
  applyPasteToRows,
  buildTsvFromSelection,
  buildTsvFromSheet,
  parseClipboardTable,
} from '@/lib/utils/table-clipboard';
import type { SheetNavSection } from '@/lib/utils/table-nav';
import {
  findFlatRow,
  flatRange,
  flattenNavRows,
  groupSelectedRows,
  navSectionsOf,
  stepCell,
  tabStep,
} from '@/lib/utils/table-nav';
import type { FormTableComponent, TableRow } from '@/types/schema';
import { describe, expect, it } from 'vitest';

const row = (id: string, contents: string[], type: TableRow['type'] = 'data'): TableRow => ({
  id,
  type,
  cells: contents.map((content, i) => ({ id: `${id}-c${i}`, content })),
});

const sections: SheetNavSection[] = [
  { section: 'header', sectionKey: 'headerRows', rows: [row('h1', ['A', 'B'], 'header')] },
  {
    section: 'data',
    sectionKey: 'detailRows',
    rows: [row('d1', ['1', '2']), row('d2', ['3', '4'])],
  },
  { section: 'footer', sectionKey: 'footerRows', rows: [row('f1', ['T', ''], 'footer')] },
];

describe('table-nav', () => {
  const flat = flattenNavRows(sections);

  it('flattens sections in render order with section indices', () => {
    expect(flat.map((r) => r.row.id)).toEqual(['h1', 'd1', 'd2', 'f1']);
    expect(flat.map((r) => r.rowIdxInSection)).toEqual([0, 0, 1, 0]);
    expect(findFlatRow(flat, 'd2')).toBe(2);
  });

  it('stepCell moves across section boundaries and clamps at the edges', () => {
    // Down from the header lands on the first data row
    expect(stepCell(flat.length, 2, { flatRow: 0, col: 0 }, 1, 0)).toEqual({ flatRow: 1, col: 0 });
    // Clamped at the last row / last column
    expect(stepCell(flat.length, 2, { flatRow: 3, col: 1 }, 1, 1)).toEqual({ flatRow: 3, col: 1 });
    expect(stepCell(flat.length, 2, { flatRow: 0, col: 0 }, -1, -1)).toEqual({
      flatRow: 0,
      col: 0,
    });
  });

  it('tabStep wraps to the next row and stops at the sheet end', () => {
    expect(tabStep(flat.length, 2, { flatRow: 0, col: 1 }, false)).toEqual({ flatRow: 1, col: 0 });
    expect(tabStep(flat.length, 2, { flatRow: 1, col: 0 }, true)).toEqual({ flatRow: 0, col: 1 });
    expect(tabStep(flat.length, 2, { flatRow: 3, col: 1 }, false)).toEqual({ flatRow: 3, col: 1 });
  });

  it('flatRange spans band boundaries (plan Phase 4 §13)', () => {
    // Anchor in data (d1), focus in the footer → header/data/footer all included
    const range = flatRange(flat, 2, 'd1', 0, { flatRow: 3, col: 1 });
    expect(range?.rowIds).toEqual(['d1', 'd2', 'f1']);
    expect(range?.cellIndices).toEqual([0, 1]);
    expect(range?.focus).toEqual({ flatRow: 3, col: 1 });
  });

  it('flatRange clamps the focus to the sheet bounds and reverses ranges', () => {
    // Focus pushed past the last row/column → clamped
    const range = flatRange(flat, 2, 'h1', 1, { flatRow: 99, col: 99 });
    expect(range?.rowIds).toEqual(['h1', 'd1', 'd2', 'f1']);
    expect(range?.focus).toEqual({ flatRow: 3, col: 1 });
    // Upward extension keeps render order
    const up = flatRange(flat, 2, 'f1', 0, { flatRow: 1, col: 0 });
    expect(up?.rowIds).toEqual(['d1', 'd2', 'f1']);
    // Missing anchor → null
    expect(flatRange(flat, 2, 'gone', 0, { flatRow: 0, col: 0 })).toBeNull();
  });

  it('groupSelectedRows splits a cross-band selection per sectionKey in order', () => {
    const groups = groupSelectedRows(sections, ['d2', 'f1', 'h1']);
    expect(groups.map((g) => g.sectionKey)).toEqual(['headerRows', 'detailRows', 'footerRows']);
    expect(groups.map((g) => g.rowIds)).toEqual([['h1'], ['d2'], ['f1']]);
    // Sections with no selected rows are omitted
    expect(groupSelectedRows(sections, ['d1']).map((g) => g.sectionKey)).toEqual(['detailRows']);
  });

  it('navSectionsOf synthesizes header/detail rows for legacy column tables', () => {
    const legacy = {
      type: 'table',
      columns: [
        { id: 'c1', header: 'Name', field: 'name' },
        { id: 'c2', header: 'Qty', field: '' },
      ],
      showHeader: true,
    } as unknown as FormTableComponent;

    const secs = navSectionsOf(legacy);
    expect(secs.map((s) => s.sectionKey)).toEqual(['headerRows', 'detailRows']);
    expect(secs[0].rows[0].id).toBe('synthetic-header');
    expect(secs[0].rows[0].cells.map((c) => c.content)).toEqual(['Name', 'Qty']);
    expect(secs[1].rows[0].id).toBe('synthetic-detail');
    expect(secs[1].rows[0].cells.map((c) => c.content)).toEqual(['{{name}}', '']);
  });

  it('navSectionsOf uses structured rows and form-table footer keys when present', () => {
    const structured = {
      type: 'form-table',
      columns: [{ id: 'c1', header: 'A', field: 'a' }],
      showHeader: false,
      headerRows: [row('h1', ['A'], 'header')],
      detailRows: [row('d1', ['1'])],
      footerRows: [row('f1', ['T'], 'footer')],
      footerGridRows: [row('g1', ['G'], 'footer')],
    } as unknown as FormTableComponent;

    const secs = navSectionsOf(structured);
    expect(secs.map((s) => s.sectionKey)).toEqual([
      'headerRows',
      'detailRows',
      'footerRows',
      'footerGridRows',
    ]);
    expect(secs.map((s) => s.rows.map((r) => r.id))).toEqual([['h1'], ['d1'], ['f1'], ['g1']]);
  });
});

describe('table-clipboard', () => {
  it('parses TSV with Windows line endings and a trailing newline', () => {
    expect(parseClipboardTable('a\tb\r\nc\td\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('builds TSV from a logical-cell rectangle', () => {
    const rows = [row('d1', ['1', '2']), row('d2', ['3', '4'])];
    expect(buildTsvFromSelection(rows, ['d1', 'd2'], [0, 1], 2)).toBe('1\t2\n3\t4');
  });

  it('emits merged-cell content once, empty for covered slots', () => {
    const merged: TableRow[] = [
      { id: 'm1', type: 'data', cells: [{ id: 'c0', content: 'wide', colspan: 2 }] },
    ];
    expect(buildTsvFromSelection(merged, ['m1'], [0, 1], 2)).toBe('wide\t');
  });

  it('builds TSV across bands in render order (cross-band selection)', () => {
    // Header row + one data row + footer row selected — three sections, one block
    expect(buildTsvFromSheet(sections, ['h1', 'd2', 'f1'], [0, 1], 2)).toBe('A\tB\n3\t4\nT\t');
  });

  it('keeps empty selected rows as blank TSV lines (rectangularity)', () => {
    const secs: SheetNavSection[] = [
      { section: 'data', sectionKey: 'detailRows', rows: [row('d1', ['x']), row('d2', [''])] },
      { section: 'footer', sectionKey: 'footerRows', rows: [row('f1', ['y'], 'footer')] },
    ];
    expect(buildTsvFromSheet(secs, ['d1', 'd2', 'f1'], [0], 1)).toBe('x\n\ny');
  });

  it('pastes values into existing rows and drops overflowing columns', () => {
    const rows = [row('d1', ['', '']), row('d2', ['', ''])];
    const out = applyPasteToRows(rows, 0, 1, [['x', 'y'], ['z']], 2);

    expect(out?.[0].cells.map((c) => c.content)).toEqual(['', 'x']); // 'y' dropped
    expect(out?.[1].cells.map((c) => c.content)).toEqual(['', 'z']);
  });

  it('appends new rows via makeRow when pasting past the end of the band', () => {
    const rows = [row('d1', ['', ''])];
    let n = 0;
    const out = applyPasteToRows(rows, 0, 0, [['a'], ['b'], ['c']], 2, (cols) =>
      row(
        `new-${n++}`,
        Array.from({ length: cols }, () => '')
      )
    );

    expect(out).toHaveLength(3);
    expect(out?.map((r) => r.cells[0].content)).toEqual(['a', 'b', 'c']);
  });

  it('clamps instead of appending when makeRow is not provided (header/footer)', () => {
    const rows = [row('h1', ['', ''], 'header')];
    const out = applyPasteToRows(rows, 0, 0, [['a'], ['b']], 2);

    expect(out).toHaveLength(1);
    expect(out?.[0].cells[0].content).toBe('a');
  });

  it('writes into the merge owner and returns null when nothing changes', () => {
    const merged: TableRow[] = [
      { id: 'm1', type: 'data', cells: [{ id: 'c0', content: 'old', colspan: 2 }] },
    ];
    const out = applyPasteToRows(merged, 0, 1, [['new']], 2);
    expect(out?.[0].cells[0].content).toBe('new');

    expect(applyPasteToRows(merged, 0, 0, [['old']], 2)).toBeNull();
  });
});
