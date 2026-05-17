import type { TableRow } from '@/types/schema';

export interface GridSlot {
  ownerRowIdx: number;
  ownerPhysIdx: number;
  logicalCol: number;
}

/**
 * Build a 2D logical grid.
 * grid[r][logicalCol] = the GridSlot of the cell that visually owns that position.
 * Correctly handles colspan AND rowspan so logical positions never conflict.
 */
export function buildLogicalGrid(rows: TableRow[], totalCols: number): (GridSlot | null)[][] {
  const grid: (GridSlot | null)[][] = Array.from({ length: rows.length }, () =>
    new Array(totalCols).fill(null)
  );

  for (let r = 0; r < rows.length; r++) {
    let logCol = 0;
    for (let p = 0; p < rows[r].cells.length; p++) {
      // Skip slots already occupied by a rowspan from a higher row
      while (logCol < totalCols && grid[r][logCol] !== null) logCol++;
      if (logCol >= totalCols) break;

      const cell = rows[r].cells[p];
      const cs = Math.max(1, cell.colspan || 1);
      const rs = Math.max(1, cell.rowspan || 1);
      const slot: GridSlot = { ownerRowIdx: r, ownerPhysIdx: p, logicalCol: logCol };

      for (let dr = 0; dr < rs && r + dr < rows.length; dr++) {
        for (let dc = 0; dc < cs && logCol + dc < totalCols; dc++) {
          grid[r + dr][logCol + dc] = slot;
        }
      }
      logCol += cs;
    }
  }

  return grid;
}

/**
 * For a given row, return the logical column for each physical cell index.
 * result[physIdx] = logicalCol, or -1 if not found (invalid data).
 */
export function physToLogical(
  grid: (GridSlot | null)[][],
  rowIdx: number,
  physCount: number
): number[] {
  const result = new Array(physCount).fill(-1);
  const row = grid[rowIdx] ?? [];
  for (let logCol = 0; logCol < row.length; logCol++) {
    const slot = row[logCol];
    if (slot && slot.ownerRowIdx === rowIdx && result[slot.ownerPhysIdx] === -1) {
      result[slot.ownerPhysIdx] = logCol;
    }
  }
  return result;
}
