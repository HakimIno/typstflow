import { buildLogicalGrid } from '@/lib/utils/table-grid';
import { mergeStructuredCells } from '@/lib/utils/table-utils';
import type { TableRow } from '@/types/schema';
import { describe, expect, it } from 'vitest';

/** Build a plain grid of rows with no merges. Cell ids are `r{r}c{c}`. */
function makeRows(nRows: number, nCols: number): TableRow[] {
  return Array.from({ length: nRows }, (_, r) => ({
    id: `r${r}`,
    type: 'data' as const,
    cells: Array.from({ length: nCols }, (_, c) => ({ id: `r${r}c${c}`, content: `${r},${c}` })),
  }));
}

/** The cell whose owner covers the given logical position. */
function ownerAt(rows: TableRow[], totalCols: number, r: number, c: number) {
  const grid = buildLogicalGrid(rows, totalCols);
  const slot = grid[r]?.[c];
  if (!slot) return null;
  return rows[slot.ownerRowIdx].cells[slot.ownerPhysIdx];
}

/**
 * Assert the grid is well-formed: every logical position is filled and no two
 * distinct owners overlap (i.e. no cell renders on top of another).
 */
function assertNoOverlaps(rows: TableRow[], totalCols: number) {
  const grid = buildLogicalGrid(rows, totalCols);
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < totalCols; c++) {
      expect(grid[r][c], `position ${r},${c} must be covered`).not.toBeNull();
    }
  }
}

describe('mergeStructuredCells', () => {
  it('merges a plain rectangle and removes the absorbed cells', () => {
    const merged = mergeStructuredCells(makeRows(4, 4), 1, 2, 1, 2, 4);

    const master = merged[1].cells.find((c) => c.id === 'r1c1');
    expect(master?.colspan).toBe(2);
    expect(master?.rowspan).toBe(2);

    // Row 1 keeps c0, the master (c1), and c3; c2 is absorbed.
    expect(merged[1].cells.map((c) => c.id)).toEqual(['r1c0', 'r1c1', 'r1c3']);
    // Row 2's c1/c2 are covered by the master's rowspan and removed.
    expect(merged[2].cells.map((c) => c.id)).toEqual(['r2c0', 'r2c3']);
    assertNoOverlaps(merged, 4);
  });

  it('keeps the master anchored to the top-left of the selection', () => {
    const merged = mergeStructuredCells(makeRows(3, 3), 0, 1, 0, 1, 3);
    const master = ownerAt(merged, 3, 0, 0);
    expect(master?.id).toBe('r0c0');
    expect(master?.colspan).toBe(2);
    expect(master?.rowspan).toBe(2);
  });

  it('expands the selection to fully cover a pre-existing horizontal merge', () => {
    // Pre-merge cols 0-1 of row 0.
    let rows = mergeStructuredCells(makeRows(2, 4), 0, 0, 0, 1, 4);
    // Now select logical cols 1-2 of row 0. Col 1 belongs to the existing merge,
    // so the operation must expand left to cover cols 0-2 instead of splitting it.
    rows = mergeStructuredCells(rows, 0, 0, 1, 2, 4);

    const grid = buildLogicalGrid(rows, 4);
    const owner = ownerAt(rows, 4, 0, 0);
    expect(owner?.colspan).toBe(3); // cols 0,1,2
    // Cols 0..2 share one owner; col 3 stays separate.
    expect(grid[0][0]).toBe(grid[0][1]);
    expect(grid[0][1]).toBe(grid[0][2]);
    expect(grid[0][3]).not.toBe(grid[0][2]);
    assertNoOverlaps(rows, 4);
  });

  it('expands to cover a merged cell that pokes out of the selection on the right', () => {
    // Pre-merge cols 2-3 of row 0.
    let rows = mergeStructuredCells(makeRows(2, 4), 0, 0, 2, 3, 4);
    // Select cols 0-2 of row 0; col 2 belongs to the (2-3) merge → expand to cols 0-3.
    rows = mergeStructuredCells(rows, 0, 0, 0, 2, 4);

    const owner = ownerAt(rows, 4, 0, 0);
    expect(owner?.id).toBe('r0c0');
    expect(owner?.colspan).toBe(4);
    assertNoOverlaps(rows, 4);
  });

  it('never leaves overlapping cells when merging across an existing vertical merge', () => {
    // Pre-merge rows 0-1 of col 1.
    let rows = mergeStructuredCells(makeRows(3, 3), 0, 1, 1, 1, 3);
    // Merge the 2x2 block rows 0-1, cols 1-2 — col 1 rows 0-1 already merged.
    rows = mergeStructuredCells(rows, 0, 1, 1, 2, 3);

    const owner = ownerAt(rows, 3, 0, 1);
    expect(owner?.colspan).toBe(2);
    expect(owner?.rowspan).toBe(2);
    assertNoOverlaps(rows, 3);
  });
});
