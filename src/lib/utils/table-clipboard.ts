import type { TableCell, TableRow } from '@/types/schema';
import { buildLogicalGrid } from './table-grid';

/**
 * TSV clipboard interchange for the table sheet (plan Phase 4). Excel and
 * Google Sheets both put tab-separated text on the clipboard, so copy/paste
 * between them and the designer works with plain `text/plain` data.
 */

/** Parses clipboard text into a rectangular-ish value grid (rows of columns). */
export function parseClipboardTable(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  // Trailing newline (Excel always appends one) → drop the empty last line.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines.map((line) => line.split('\t'));
}

/**
 * Serializes the selected logical-cell rectangle as TSV.
 * Merged cells contribute their content once (at the owner's origin slot) and
 * empty strings elsewhere — matching how Excel copies merged ranges.
 */
export function buildTsvFromSelection(
  rows: TableRow[],
  rowIds: string[],
  cellIndices: number[],
  totalCols: number
): string {
  const grid = buildLogicalGrid(rows, totalCols);
  const rowSet = new Set(rowIds);
  const cols = [...cellIndices].sort((a, b) => a - b);

  const lines: string[] = [];
  rows.forEach((row, ri) => {
    if (!rowSet.has(row.id)) return;
    const values = cols.map((col) => {
      const slot = grid[ri]?.[col];
      if (!slot) return '';
      // Only the owner's origin emits content; covered slots stay empty.
      if (slot.ownerRowIdx !== ri || slot.logicalCol !== col) return '';
      return rows[slot.ownerRowIdx]?.cells[slot.ownerPhysIdx]?.content ?? '';
    });
    lines.push(values.join('\t'));
  });
  return lines.join('\n');
}

/**
 * Writes a value grid into rows starting at (startRowIdx, startCol).
 *
 * - Values landing on a merged cell go to the merge owner (last write wins).
 * - Columns beyond the table are dropped.
 * - Rows beyond the end are appended via `makeRow` when provided (data band);
 *   pass undefined to clamp instead (header/footer sections).
 *
 * Returns the new rows array, or null when nothing changed.
 */
export function applyPasteToRows(
  rows: TableRow[],
  startRowIdx: number,
  startCol: number,
  values: string[][],
  totalCols: number,
  makeRow?: (colCount: number) => TableRow
): TableRow[] | null {
  if (startRowIdx < 0 || startCol < 0 || values.length === 0) return null;

  const grid = buildLogicalGrid(rows, totalCols);
  const newRows: TableRow[] = rows.map((row) => ({
    ...row,
    cells: row.cells.map((cell): TableCell => ({ ...cell })),
  }));
  const appended: TableRow[] = [];
  let changed = false;

  values.forEach((line, r) => {
    const ri = startRowIdx + r;
    if (ri < rows.length) {
      line.forEach((value, c) => {
        const col = startCol + c;
        if (col >= totalCols) return;
        const slot = grid[ri]?.[col];
        if (!slot) return;
        const cell = newRows[slot.ownerRowIdx]?.cells[slot.ownerPhysIdx];
        if (!cell || cell.content === value) return;
        cell.content = value;
        changed = true;
      });
      return;
    }
    if (!makeRow) return;
    let extra = appended[ri - rows.length];
    if (!extra) {
      extra = makeRow(totalCols);
      appended[ri - rows.length] = extra;
    }
    line.forEach((value, c) => {
      const col = startCol + c;
      const cell = extra.cells[col];
      if (!cell || cell.content === value) return;
      cell.content = value;
      changed = true;
    });
  });

  if (!changed) return null;
  return [...newRows, ...appended];
}
