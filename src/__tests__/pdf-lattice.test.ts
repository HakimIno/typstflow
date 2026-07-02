import { type RuleSegment, reconstructLattice } from '@/lib/utils/pdf-lattice';
import type { TextBlock } from '@/lib/utils/pdf-to-text-blocks';
import { describe, expect, it } from 'vitest';

/** Horizontal rule at y across [x1,x2]. */
const h = (y: number, x1: number, x2: number): RuleSegment => ({ x1, y1: y, x2, y2: y });
/** Vertical rule at x across [y1,y2]. */
const v = (x: number, y1: number, y2: number): RuleSegment => ({ x1: x, y1, x2: x, y2 });

/** A text block centered near (x, y). */
function block(text: string, x: number, y: number, bold = false): TextBlock {
  return { text, xMm: x, yMm: y, wMm: 6, hMm: 3, fontSizePt: 10, bold };
}

describe('reconstructLattice', () => {
  it('returns null when there is no grid', () => {
    expect(reconstructLattice([h(10, 0, 100)], [])).toBeNull();
  });

  it('reconstructs a plain 2×2 grid with no merges', () => {
    // Column edges at x=0,50,100 ; row edges at y=0,20,40.
    const rules = [
      h(0, 0, 100),
      h(20, 0, 100),
      h(40, 0, 100),
      v(0, 0, 40),
      v(50, 0, 40),
      v(100, 0, 40),
    ];
    const blocks = [block('A', 25, 10), block('B', 75, 10), block('C', 25, 30), block('D', 75, 30)];
    const table = reconstructLattice(rules, blocks);
    expect(table).not.toBeNull();
    if (!table) return;
    expect(table.nCols).toBe(2);
    expect(table.nRows).toBe(2);
    expect(table.cells).toHaveLength(4);
    expect(table.cells.every((c) => c.colspan === 1 && c.rowspan === 1)).toBe(true);
    const a = table.cells.find((c) => c.row === 0 && c.col === 0);
    expect(a?.text).toBe('A');
  });

  it('detects a colspan where an interior vertical edge is missing', () => {
    // Top row is one wide cell (no vertical rule at x=50 for the top band);
    // bottom row has two cells.
    const rules = [
      h(0, 0, 100),
      h(20, 0, 100),
      h(40, 0, 100),
      v(0, 0, 40),
      v(100, 0, 40),
      v(50, 20, 40), // vertical divider only in the bottom band
    ];
    const table = reconstructLattice(rules, [block('WIDE', 50, 10)]);
    expect(table).not.toBeNull();
    if (!table) return;
    const top = table.cells.find((c) => c.row === 0 && c.col === 0);
    expect(top?.colspan).toBe(2);
    expect(top?.text).toBe('WIDE');
    // bottom band still splits into two cells
    expect(table.cells.filter((c) => c.row === 1)).toHaveLength(2);
  });

  it('detects a rowspan where an interior horizontal edge is missing', () => {
    // Left column spans both rows (no horizontal rule at y=20 over its band).
    const rules = [
      h(0, 0, 100),
      h(40, 0, 100),
      h(20, 50, 100), // horizontal divider only in the right column
      v(0, 0, 40),
      v(50, 0, 40),
      v(100, 0, 40),
    ];
    const table = reconstructLattice(rules, [block('TALL', 25, 20)]);
    expect(table).not.toBeNull();
    if (!table) return;
    const left = table.cells.find((c) => c.row === 0 && c.col === 0);
    expect(left?.rowspan).toBe(2);
    expect(left?.text).toBe('TALL');
    // right column splits into two rows
    expect(table.cells.filter((c) => c.col === 1)).toHaveLength(2);
  });

  it('marks a cell bold when its text is bold', () => {
    const rules = [h(0, 0, 100), h(20, 0, 100), v(0, 0, 20), v(50, 0, 20), v(100, 0, 20)];
    const table = reconstructLattice(rules, [block('HDR', 25, 10, true)]);
    expect(table?.cells.find((c) => c.col === 0)?.bold).toBe(true);
  });
});
