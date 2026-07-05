/**
 * @file table-migrate.test.ts
 * Unified row model migration (plan/table-system-redesign.md — Phase 1).
 * Covers unifyTableRows / splitUnifiedRows / normalizeTableComponent across
 * structured tables, legacy columns-only tables, and form-table footerGridRows.
 */
import {
  normalizeTableComponent,
  splitUnifiedRows,
  synthesizeRowsFromColumns,
  unifyTableRows,
} from '@/lib/utils/table-migrate';
import type { FormTableComponent, TableComponent, TableRow } from '@/types/schema';
import { describe, expect, it } from 'vitest';

const row = (id: string, type: TableRow['type'], contents: string[]): TableRow => ({
  id,
  type,
  cells: contents.map((content, i) => ({ id: `${id}-c${i}`, content })),
});

const baseTable = (over: Partial<TableComponent> = {}): TableComponent => ({
  id: 't1',
  type: 'table',
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  dataSource: '{{items}}',
  showHeader: true,
  repeatHeaderOnPage: true,
  columns: [
    { id: 'c1', header: 'A', field: 'a', width: '1fr' },
    { id: 'c2', header: 'B', field: 'b', width: '1fr' },
  ],
  style: {},
  ...over,
});

const baseFormTable = (over: Partial<FormTableComponent> = {}): FormTableComponent => ({
  ...baseTable(),
  type: 'form-table',
  ...over,
});

describe('unifyTableRows — structured tables', () => {
  it('concatenates header → detail → footer in order', () => {
    const comp = baseTable({
      headerRows: [row('h1', 'header', ['Header'])],
      detailRows: [row('d1', 'data', ['Snow']), row('d2', 'data', ['{{no}}'])],
      footerRows: [row('f1', 'footer', ['Total'])],
    });

    expect(unifyTableRows(comp).map((r) => r.id)).toEqual(['h1', 'd1', 'd2', 'f1']);
  });

  it('coerces row types to match their section array', () => {
    const comp = baseTable({
      headerRows: [row('h1', 'data', ['H'])],
      detailRows: [row('d1', 'footer', ['D']), row('d2', 'static', ['S'])],
      footerRows: [row('f1', 'data', ['F'])],
    });

    const types = unifyTableRows(comp).map((r) => r.type);
    // 'static' survives inside the body; wrong types are coerced.
    expect(types).toEqual(['header', 'data', 'static', 'footer']);
  });

  it('appends form-table footerGridRows after footerRows as footer rows', () => {
    const comp = baseFormTable({
      footerRows: [row('f1', 'footer', ['Sub'])],
      footerGridRows: [row('g1', 'data', ['Received by'])],
    });

    // Header/body come from column synthesis (per-section fallback), then footers.
    const unified = unifyTableRows(comp);
    expect(unified.map((r) => r.id)).toEqual(['t1-synth-header', 't1-synth-data', 'f1', 'g1']);
    expect(unified[3].type).toBe('footer');
  });

  it('synthesizes missing sections from columns like the generator does', () => {
    // detailRows only → synthetic header row is still part of the unified list
    const withDetail = baseTable({ detailRows: [row('d1', 'data', ['D'])] });
    expect(unifyTableRows(withDetail).map((r) => r.id)).toEqual(['t1-synth-header', 'd1']);

    // headerRows only → body falls back to the {{field}} data row
    const withHeader = baseTable({ headerRows: [row('h1', 'header', ['H'])] });
    expect(unifyTableRows(withHeader).map((r) => r.id)).toEqual(['h1', 't1-synth-data']);

    // showHeader: false suppresses the synthetic header
    const noHeader = baseTable({ showHeader: false, detailRows: [row('d1', 'data', ['D'])] });
    expect(unifyTableRows(noHeader).map((r) => r.id)).toEqual(['d1']);
  });

  it('prefers fresh section arrays over a stale persisted rows list', () => {
    // Legacy writers (properties panels) still edit only the section arrays,
    // so a persisted `rows` must never shadow them during the transition.
    const comp = baseTable({
      rows: [row('stale', 'data', ['old'])],
      detailRows: [row('d1', 'data', ['new'])],
    });

    expect(unifyTableRows(comp).map((r) => r.id)).toEqual(['t1-synth-header', 'd1']);
  });

  it('uses persisted rows when every section array is empty (fully migrated)', () => {
    const comp = baseTable({
      rows: [row('r1', 'header', ['H']), row('r2', 'data', ['D'])],
      headerRows: [],
      detailRows: [],
      footerRows: [],
    });

    expect(unifyTableRows(comp).map((r) => r.id)).toEqual(['r1', 'r2']);
  });
});

describe('unifyTableRows — legacy columns synthesis', () => {
  it('synthesizes a header row and one {{field}} data row', () => {
    const comp = baseTable();
    const unified = unifyTableRows(comp);

    expect(unified).toHaveLength(2);
    expect(unified[0].type).toBe('header');
    expect(unified[0].cells.map((c) => c.content)).toEqual(['A', 'B']);
    expect(unified[1].type).toBe('data');
    expect(unified[1].cells.map((c) => c.content)).toEqual(['{{a}}', '{{b}}']);
  });

  it('is deterministic — same ids on every call', () => {
    const comp = baseTable();
    expect(unifyTableRows(comp)).toEqual(unifyTableRows(comp));
  });

  it('omits the header row when showHeader is false', () => {
    const unified = unifyTableRows(baseTable({ showHeader: false }));
    expect(unified).toHaveLength(1);
    expect(unified[0].type).toBe('data');
  });

  it('skips columns covered by a preceding colspan', () => {
    const comp = baseTable({
      columns: [
        { id: 'c1', header: 'Wide', field: 'a', width: '1fr', colspan: 2 },
        { id: 'c2', header: 'Hidden', field: 'b', width: '1fr' },
        { id: 'c3', header: 'C', field: 'c', width: '1fr' },
      ],
    });

    const header = synthesizeRowsFromColumns(comp)[0];
    expect(header.cells.map((c) => c.content)).toEqual(['Wide', 'C']);
    expect(header.cells[0].colspan).toBe(2);
  });
});

describe('splitUnifiedRows', () => {
  it('round-trips a structured table without changing section membership', () => {
    const comp = baseFormTable({
      headerRows: [row('h1', 'header', ['H'])],
      detailRows: [row('d1', 'data', ['D'])],
      footerRows: [row('f1', 'footer', ['Sub'])],
      footerGridRows: [row('g1', 'footer', ['Received by'])],
    });

    const updates = splitUnifiedRows(comp, unifyTableRows(comp));

    expect(updates.headerRows?.map((r) => r.id)).toEqual(['h1']);
    expect(updates.detailRows?.map((r) => r.id)).toEqual(['d1']);
    expect(updates.footerRows?.map((r) => r.id)).toEqual(['f1']);
    expect(updates.footerGridRows?.map((r) => r.id)).toEqual(['g1']);
    expect(updates.rows?.map((r) => r.id)).toEqual(['h1', 'd1', 'f1', 'g1']);
  });

  it('routes a new footer row to the bucket of the footer row preceding it', () => {
    const comp = baseFormTable({
      footerRows: [row('f1', 'footer', ['Sub'])],
      footerGridRows: [row('g1', 'footer', ['Received by'])],
    });

    const footers = unifyTableRows(comp).filter((r) => r.type === 'footer');
    // Insert one new row after f1 (footerRows bucket) and one after g1 (grid bucket).
    const withNew = [
      footers[0],
      row('new-f', 'footer', ['X']),
      footers[1],
      row('new-g', 'footer', ['Y']),
    ];

    const updates = splitUnifiedRows(comp, withNew);
    expect(updates.footerRows?.map((r) => r.id)).toEqual(['f1', 'new-f']);
    expect(updates.footerGridRows?.map((r) => r.id)).toEqual(['g1', 'new-g']);
  });

  it('defaults new footer rows to footerRows for plain tables', () => {
    const comp = baseTable({ detailRows: [row('d1', 'data', ['D'])] });
    const updates = splitUnifiedRows(comp, [row('d1', 'data', ['D']), row('f1', 'footer', ['F'])]);

    expect(updates.footerRows?.map((r) => r.id)).toEqual(['f1']);
    expect(updates.footerGridRows).toBeUndefined();
  });

  it('keeps static rows in detailRows with their type preserved', () => {
    const comp = baseTable({ detailRows: [row('d1', 'data', ['D'])] });
    const updates = splitUnifiedRows(comp, [
      row('s1', 'static', ['Snow']),
      row('d1', 'data', ['{{no}}']),
    ]);

    expect(updates.detailRows?.map((r) => r.id)).toEqual(['s1', 'd1']);
    expect(updates.detailRows?.[0].type).toBe('static');
  });

  it('drops render-only group rows instead of storing them', () => {
    const comp = baseTable({ detailRows: [row('d1', 'data', ['D'])] });
    const updates = splitUnifiedRows(comp, [
      row('gh', 'group-header', ['G']),
      row('d1', 'data', ['D']),
    ]);

    expect(updates.detailRows?.map((r) => r.id)).toEqual(['d1']);
    expect(updates.headerRows).toEqual([]);
  });
});

describe('normalizeTableComponent', () => {
  it('populates rows and materializes legacy arrays in sync', () => {
    const comp = baseTable({
      headerRows: [row('h1', 'header', ['H'])],
      detailRows: [row('d1', 'data', ['D'])],
    });

    const normalized = normalizeTableComponent(comp);
    expect(normalized.rows?.map((r) => r.id)).toEqual(['h1', 'd1']);
    expect(normalized.headerRows?.map((r) => r.id)).toEqual(['h1']);
    expect(normalized.detailRows?.map((r) => r.id)).toEqual(['d1']);
  });

  it('is idempotent — a second normalize returns the same object', () => {
    const once = normalizeTableComponent(
      baseFormTable({
        headerRows: [row('h1', 'header', ['H'])],
        detailRows: [row('d1', 'data', ['D'])],
        footerRows: [row('f1', 'footer', ['F'])],
        footerGridRows: [row('g1', 'footer', ['G'])],
      })
    );

    expect(normalizeTableComponent(once)).toBe(once);
  });

  it('is idempotent for synthesized legacy tables', () => {
    const once = normalizeTableComponent(baseTable());
    expect(once.rows).toHaveLength(2);
    expect(normalizeTableComponent(once)).toBe(once);
  });
});
