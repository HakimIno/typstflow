import { buildImportedComponents } from '@/lib/utils/pdf-to-schema';
import type { PdfTextExtraction, TextLine } from '@/lib/utils/pdf-to-text-blocks';
import type { TableComponent, TextComponent } from '@/types/schema';
import { describe, expect, it } from 'vitest';

function tline(yMm: number, frags: Array<[string, number]>, bold = false): TextLine {
  const blocks = frags.map(([text, xMm]) => ({
    text,
    xMm,
    yMm,
    wMm: 10,
    hMm: 3.5,
    fontSizePt: 10,
    bold,
  }));
  const starts = blocks.map((b) => b.xMm);
  const rights = blocks.map((b) => b.xMm + b.wMm);
  return {
    text: frags.map((f) => f[0]).join(' '),
    xMm: Math.min(...starts),
    yMm,
    wMm: Math.max(...rights) - Math.min(...starts),
    hMm: 3.5,
    fontSizePt: 10,
    bold,
    blocks,
  };
}

function extraction(lines: TextLine[]): PdfTextExtraction {
  return {
    pageWidthMm: 210,
    pageHeightMm: 297,
    paperSize: 'A4',
    orientation: 'portrait',
    hasTextLayer: true,
    lines,
  };
}

describe('buildImportedComponents', () => {
  const ex = extraction([
    tline(20, [['INVOICE', 20]], true),
    tline(
      100,
      [
        ['Item', 20],
        ['Qty', 90],
        ['Price', 140],
      ],
      true
    ),
    tline(105, [
      ['Apple', 20],
      ['2', 90],
      ['100', 140],
    ]),
    tline(110, [
      ['Banana', 20],
      ['5', 90],
      ['250', 140],
    ]),
  ]);

  it('zeroes page margins so PDF coordinates map 1:1', () => {
    const { page } = buildImportedComponents(ex);
    expect(page.size).toBe('A4');
    expect(page.margin).toEqual({ top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' });
  });

  it('emits a text component for the heading and a table for the rows', () => {
    const { components } = buildImportedComponents(ex);
    const texts = components.filter((c): c is TextComponent => c.type === 'text');
    const tables = components.filter((c): c is TableComponent => c.type === 'table');
    expect(texts).toHaveLength(1);
    expect(texts[0].content).toBe('INVOICE');
    expect(tables).toHaveLength(1);
  });

  it('builds a static table with a header and detail rows', () => {
    const table = buildImportedComponents(ex).components.find(
      (c): c is TableComponent => c.type === 'table'
    );
    expect(table).toBeDefined();
    if (!table) return;
    expect(table.isStatic).toBe(true);
    expect(table.dataSource).toBe('');
    expect(table.showHeader).toBe(true);
    expect(table.columns.map((c) => c.header)).toEqual(['Item', 'Qty', 'Price']);
    // header row consumed → 2 detail rows remain
    expect(table.detailRows).toHaveLength(2);
    expect(table.detailRows?.[0].cells.map((c) => c.content)).toEqual(['Apple', '2', '100']);
  });

  it('preserves the heading position from the source coordinates', () => {
    const text = buildImportedComponents(ex).components.find(
      (c): c is TextComponent => c.type === 'text'
    );
    expect(text?.x).toBe(20);
    expect(text?.y).toBe(20);
  });
});
