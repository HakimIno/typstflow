import type { RuleSegment } from '@/lib/utils/pdf-lattice';
import { buildImportedComponents, serializeImportForPrompt } from '@/lib/utils/pdf-to-schema';
import type { PdfTextExtraction, TextLine } from '@/lib/utils/pdf-to-text-blocks';
import type { TableComponent } from '@/types/schema';
import { describe, expect, it } from 'vitest';

const h = (y: number, x1: number, x2: number): RuleSegment => ({ x1, y1: y, x2, y2: y });
const v = (x: number, y1: number, y2: number): RuleSegment => ({ x1: x, y1, x2: x, y2 });

function line(x: number, y: number, text: string): TextLine {
  const block = { text, xMm: x, yMm: y, wMm: 6, hMm: 3, fontSizePt: 10, bold: false };
  return { text, xMm: x, yMm: y, wMm: 6, hMm: 3, fontSizePt: 10, bold: false, blocks: [block] };
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

describe('buildImportedComponents with ruling lines', () => {
  // Top row: one wide cell (colspan 2). Bottom row: two cells.
  const rules = [
    h(0, 0, 100),
    h(20, 0, 100),
    h(40, 0, 100),
    v(0, 0, 40),
    v(100, 0, 40),
    v(50, 20, 40),
  ];
  const ex = extraction([line(50, 10, 'WIDE'), line(25, 30, 'L'), line(75, 30, 'R')]);

  it('produces a single static table from the lattice with merged cells', () => {
    const components = buildImportedComponents(ex, rules).components;
    const tables = components.filter((c): c is TableComponent => c.type === 'table');
    expect(tables).toHaveLength(1);

    const table = tables[0];
    expect(table.isStatic).toBe(true);
    expect(table.columns).toHaveLength(2);
    expect(table.detailRows).toHaveLength(2);

    // Row 0: one cell spanning both columns.
    expect(table.detailRows?.[0].cells).toHaveLength(1);
    expect(table.detailRows?.[0].cells[0].colspan).toBe(2);
    expect(table.detailRows?.[0].cells[0].content).toBe('WIDE');

    // Row 1: two normal cells.
    expect(table.detailRows?.[1].cells).toHaveLength(2);
    expect(table.detailRows?.[1].cells.map((c) => c.content)).toEqual(['L', 'R']);
  });

  it('does not leave the table text behind as free text components', () => {
    const components = buildImportedComponents(ex, rules).components;
    const texts = components.filter((c) => c.type === 'text');
    expect(texts).toHaveLength(0);
  });
});

describe('serializeImportForPrompt', () => {
  const rules = [
    h(0, 0, 100),
    h(20, 0, 100),
    h(40, 0, 100),
    v(0, 0, 40),
    v(100, 0, 40),
    v(50, 20, 40),
  ];
  const ex = extraction([line(50, 10, 'WIDE'), line(25, 30, 'L'), line(75, 30, 'R')]);

  it('emits an add_static_table brief with the colspan tag for the merged cell', () => {
    const brief = serializeImportForPrompt(ex, rules);
    expect(brief).toContain('add_static_table');
    expect(brief).toContain('"WIDE"[cs2]');
    expect(brief).toContain('columns width(mm):');
  });

  it('lists standalone text with add_text and exact coordinates', () => {
    const heading = extraction([line(20, 12, 'INVOICE')]);
    const brief = serializeImportForPrompt(heading, []);
    expect(brief).toContain('add_text x=20 y=12');
    expect(brief).toContain('"INVOICE"');
  });
});
