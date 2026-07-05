/**
 * @file table-model.test.ts
 * Shared table body view-model (plan/table-system-redesign.md — Phase 2):
 * static rows render once, contiguous data bands repeat per item, with
 * minRows padding / design placeholders / trailing rows expanded in order.
 */
import { buildTableBodyModel, tableBodyRows } from '@/lib/engine/table-model';
import type { TableComponent, TableRow } from '@/types/schema';
import { describe, expect, it } from 'vitest';

const row = (id: string, type: TableRow['type'], content: string): TableRow => ({
  id,
  type,
  cells: [{ id: `${id}-c0`, content }],
});

const table = (over: Partial<TableComponent> = {}): TableComponent => ({
  id: 't1',
  type: 'table',
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  dataSource: '{{items}}',
  showHeader: true,
  repeatHeaderOnPage: true,
  columns: [{ id: 'c1', header: 'A', field: 'a', width: '1fr' }],
  style: {},
  ...over,
});

const ids = (m: { row: TableRow }[]) => m.map((i) => i.row.id);

describe('buildTableBodyModel', () => {
  it('renders static rows once while the data band repeats per item (screenshot fix)', () => {
    const comp = table({
      detailRows: [row('snow', 'static', 'Snow'), row('no', 'data', '{{no}}')],
    });

    const model = buildTableBodyModel(comp, { dataItems: [{ no: 1 }, { no: 2 }, { no: 3 }] });

    expect(ids(model)).toEqual(['snow', 'no', 'no', 'no']);
    expect(model[0].origin).toBe('static');
    expect(model.slice(1).map((i) => i.item)).toEqual([{ no: 1 }, { no: 2 }, { no: 3 }]);
  });

  it('repeats a multi-row band together, keeping sourceIndex per source row', () => {
    const comp = table({
      detailRows: [row('d1', 'data', 'a'), row('d2', 'data', 'b')],
    });

    const model = buildTableBodyModel(comp, { dataItems: [{}, {}] });

    expect(ids(model)).toEqual(['d1', 'd2', 'd1', 'd2']);
    expect(model.map((i) => i.sourceIndex)).toEqual([0, 1, 0, 1]);
    expect(model.map((i) => i.bandIndex)).toEqual([0, 0, 1, 1]);
  });

  it('splits bands around static rows — each band repeats per item', () => {
    const comp = table({
      detailRows: [row('d1', 'data', 'a'), row('s1', 'static', 'x'), row('d2', 'data', 'b')],
    });

    const model = buildTableBodyModel(comp, { dataItems: [{}, {}] });

    expect(ids(model)).toEqual(['d1', 'd1', 's1', 'd2', 'd2']);
  });

  it('renders one placeholder band instance when a dynamic table has no data', () => {
    const comp = table({ detailRows: [row('d1', 'data', '{{a}}')] });
    const model = buildTableBodyModel(comp, { dataItems: [] });

    expect(model).toHaveLength(1);
    expect(model[0].origin).toBe('placeholder');
    expect(model[0].item).toEqual({});
  });

  it('suppresses the placeholder when renderDesignPlaceholders is false', () => {
    const comp = table({ detailRows: [row('d1', 'data', '{{a}}')] });
    expect(
      buildTableBodyModel(comp, { dataItems: [], renderDesignPlaceholders: false })
    ).toHaveLength(0);
  });

  it('pads the band up to minRows instead of a placeholder', () => {
    const comp = table({ detailRows: [row('d1', 'data', '{{a}}')] });
    const model = buildTableBodyModel(comp, { dataItems: [{ a: 1 }], minRows: 3 });

    expect(model.map((i) => i.origin)).toEqual(['band', 'pad', 'pad']);
    expect(model.map((i) => i.bandIndex)).toEqual([0, 1, 2]);
  });

  it('static tables render the band exactly once — no pads or placeholders', () => {
    const comp = table({ isStatic: true, detailRows: [row('d1', 'data', 'x')] });
    const local = { a: 1 };
    const model = buildTableBodyModel(comp, { dataItems: [local], isStatic: true, minRows: 5 });

    expect(model).toHaveLength(1);
    expect(model[0].item).toBe(local);
  });

  it('appends trailing rows after every band with sourceIndex -1', () => {
    const comp = table({ detailRows: [row('d1', 'data', 'x')] });
    const model = buildTableBodyModel(comp, {
      dataItems: [{}],
      trailingRows: [row('fill', 'data', '')],
    });

    expect(ids(model)).toEqual(['d1', 'fill']);
    expect(model[1]).toMatchObject({ origin: 'trailing', sourceIndex: -1 });
  });

  it('legacy columns-only tables get a synthesized {{field}} band', () => {
    const model = buildTableBodyModel(table(), { dataItems: [{ a: 1 }, { a: 2 }] });

    expect(model).toHaveLength(2);
    expect(model[0].row.cells[0].content).toBe('{{a}}');
  });
});

describe('tableBodyRows', () => {
  it('returns only data/static rows from the unified list', () => {
    const comp = table({
      headerRows: [row('h1', 'header', 'H')],
      detailRows: [row('d1', 'data', 'D'), row('s1', 'static', 'S')],
      footerRows: [row('f1', 'footer', 'F')],
    });

    expect(tableBodyRows(comp).map((r) => r.id)).toEqual(['d1', 's1']);
  });
});
