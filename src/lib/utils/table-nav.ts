import type { TableRow } from '@/types/schema';

/**
 * Sheet keyboard navigation model (plan/table-system-redesign.md — Phase 4).
 *
 * The designer renders a table as ordered sections (header → body → footers).
 * For arrow/Tab navigation we flatten them into one row list so the active cell
 * can walk the whole sheet; range selection stays inside one section because
 * the selection model (and the split storage) is still section-scoped.
 */

export type SheetSectionType = 'header' | 'data' | 'footer';

export interface SheetNavSection {
  section: SheetSectionType;
  /** Schema key edits write back to ('headerRows' | 'detailRows' | 'footerRows' | 'footerGridRows'). */
  sectionKey: string;
  rows: TableRow[];
}

export interface SheetNavRow {
  section: SheetSectionType;
  sectionKey: string;
  row: TableRow;
  /** Index of this row within its own section (for write-back). */
  rowIdxInSection: number;
}

export interface SheetCellPos {
  flatRow: number;
  col: number; // logical column
}

export function flattenNavRows(sections: SheetNavSection[]): SheetNavRow[] {
  return sections.flatMap((sec) =>
    sec.rows.map((row, rowIdxInSection) => ({
      section: sec.section,
      sectionKey: sec.sectionKey,
      row,
      rowIdxInSection,
    }))
  );
}

export function findFlatRow(flat: SheetNavRow[], rowId: string): number {
  return flat.findIndex((r) => r.row.id === rowId);
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Arrow-key step: moves the active cell, clamped to the sheet bounds. */
export function stepCell(
  flatLen: number,
  colCount: number,
  pos: SheetCellPos,
  dRow: number,
  dCol: number
): SheetCellPos {
  return {
    flatRow: clamp(pos.flatRow + dRow, 0, Math.max(0, flatLen - 1)),
    col: clamp(pos.col + dCol, 0, Math.max(0, colCount - 1)),
  };
}

/** Tab step: wraps to the first/last column of the next/previous row. */
export function tabStep(
  flatLen: number,
  colCount: number,
  pos: SheetCellPos,
  backwards: boolean
): SheetCellPos {
  let col = pos.col + (backwards ? -1 : 1);
  let flatRow = pos.flatRow;
  if (col >= colCount) {
    if (flatRow < flatLen - 1) {
      flatRow += 1;
      col = 0;
    } else {
      col = colCount - 1;
    }
  } else if (col < 0) {
    if (flatRow > 0) {
      flatRow -= 1;
      col = colCount - 1;
    } else {
      col = 0;
    }
  }
  return { flatRow, col };
}

export interface SectionRange {
  section: SheetSectionType;
  rowIds: string[];
  cellIndices: number[];
  /** Focus row clamped into the anchor's section. */
  focus: SheetCellPos;
}

/**
 * Rectangular range between the anchor cell and a focus position, clamped to
 * the anchor's section (cross-section ranges can't be stored in the split
 * schema arrays). Returns null when the anchor row is gone.
 */
export function sectionRange(
  flat: SheetNavRow[],
  colCount: number,
  anchorRowId: string,
  anchorCol: number,
  focus: SheetCellPos
): SectionRange | null {
  const anchorFlat = findFlatRow(flat, anchorRowId);
  if (anchorFlat === -1) return null;
  const section = flat[anchorFlat].section;
  const sectionKey = flat[anchorFlat].sectionKey;

  // Section bounds in flat space — footer may span two sectionKeys but range
  // selection stays within ONE write-back key (mirrors mouse drag behavior).
  let first = anchorFlat;
  while (first > 0 && flat[first - 1].sectionKey === sectionKey) first--;
  let last = anchorFlat;
  while (last < flat.length - 1 && flat[last + 1].sectionKey === sectionKey) last++;

  const focusRow = clamp(focus.flatRow, first, last);
  const focusCol = clamp(focus.col, 0, Math.max(0, colCount - 1));

  const rowIds = flat
    .slice(Math.min(anchorFlat, focusRow), Math.max(anchorFlat, focusRow) + 1)
    .map((r) => r.row.id);
  const minCol = Math.min(anchorCol, focusCol);
  const maxCol = Math.max(anchorCol, focusCol);
  const cellIndices = Array.from({ length: maxCol - minCol + 1 }, (_, i) => minCol + i);

  return { section, rowIds, cellIndices, focus: { flatRow: focusRow, col: focusCol } };
}
