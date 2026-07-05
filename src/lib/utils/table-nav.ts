import type { AnyTableComponent, TableRow } from '@/types/schema';

/**
 * Sheet keyboard navigation model (plan/table-system-redesign.md — Phase 4).
 *
 * The designer renders a table as ordered sections (header → body → footers).
 * Navigation AND range selection both operate on the flattened row list, so the
 * active cell and rectangular selections walk the whole sheet Excel-style; only
 * write-back resolves each row to its own schema array (see groupSelectedRows).
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

/**
 * Synthetic rows shown for legacy column-only tables (no structured rows).
 * IDs are stable constants — selection, navigation and write-back fallbacks all
 * key off them, so the designer and the nav model must build identical rows.
 */
export function syntheticHeaderRow(component: AnyTableComponent): TableRow {
  return {
    id: 'synthetic-header',
    type: 'header',
    cells: component.columns.map((c) => ({
      id: c.id,
      content: c.header || '',
      align: c.align || 'left',
    })),
  };
}

export function syntheticDetailRow(component: AnyTableComponent): TableRow {
  return {
    id: 'synthetic-detail',
    type: 'data',
    cells: component.columns.map((c) => ({
      id: `detail-${c.id}`,
      content: c.field ? `{{${c.field}}}` : '',
      align: c.align || 'left',
    })),
  };
}

/**
 * The editable sheet sections of a table in render order, including the
 * synthetic header/detail rows legacy column tables display. Generated rows
 * (form-table summary/filler) are excluded — they are read-only.
 */
export function navSectionsOf(component: AnyTableComponent): SheetNavSection[] {
  const sections: SheetNavSection[] = [];
  const headerRows = component.headerRows?.length
    ? component.headerRows
    : component.showHeader !== false
      ? [syntheticHeaderRow(component)]
      : [];
  if (headerRows.length) {
    sections.push({ section: 'header', sectionKey: 'headerRows', rows: headerRows });
  }
  const bodyRows = component.detailRows?.length
    ? component.detailRows
    : [syntheticDetailRow(component)];
  sections.push({ section: 'data', sectionKey: 'detailRows', rows: bodyRows });
  if (component.footerRows?.length) {
    sections.push({ section: 'footer', sectionKey: 'footerRows', rows: component.footerRows });
  }
  if (component.type === 'form-table' && component.footerGridRows?.length) {
    sections.push({
      section: 'footer',
      sectionKey: 'footerGridRows',
      rows: component.footerGridRows,
    });
  }
  return sections;
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

export interface FlatRange {
  rowIds: string[];
  cellIndices: number[];
  /** Focus corner clamped into the sheet bounds. */
  focus: SheetCellPos;
}

/**
 * Rectangular range between the anchor cell and a focus position over the whole
 * flat sheet — cross-band selection is allowed (plan Phase 4 §13); write-back
 * resolves each row to its own schema array via groupSelectedRows.
 * Returns null when the anchor row is gone.
 */
export function flatRange(
  flat: SheetNavRow[],
  colCount: number,
  anchorRowId: string,
  anchorCol: number,
  focus: SheetCellPos
): FlatRange | null {
  const anchorFlat = findFlatRow(flat, anchorRowId);
  if (anchorFlat === -1) return null;

  const focusRow = clamp(focus.flatRow, 0, Math.max(0, flat.length - 1));
  const focusCol = clamp(focus.col, 0, Math.max(0, colCount - 1));

  const rowIds = flat
    .slice(Math.min(anchorFlat, focusRow), Math.max(anchorFlat, focusRow) + 1)
    .map((r) => r.row.id);
  const minCol = Math.min(anchorCol, focusCol);
  const maxCol = Math.max(anchorCol, focusCol);
  const cellIndices = Array.from({ length: maxCol - minCol + 1 }, (_, i) => minCol + i);

  return { rowIds, cellIndices, focus: { flatRow: focusRow, col: focusCol } };
}

export interface SelectedSectionGroup {
  section: SheetSectionType;
  sectionKey: string;
  /** Rows of the whole section (synthetic rows included for legacy tables). */
  rows: TableRow[];
  /** Selected row ids within this section, in render order. */
  rowIds: string[];
}

/**
 * Splits a flat (cross-band) selection into per-sectionKey groups so actions
 * can write each slice back to its own schema array. Sections with no selected
 * rows are omitted; groups preserve render order.
 */
export function groupSelectedRows(
  sections: SheetNavSection[],
  rowIds: string[]
): SelectedSectionGroup[] {
  const idSet = new Set(rowIds);
  const groups: SelectedSectionGroup[] = [];
  for (const sec of sections) {
    const selected = sec.rows.filter((r) => idSet.has(r.id)).map((r) => r.id);
    if (selected.length) {
      groups.push({
        section: sec.section,
        sectionKey: sec.sectionKey,
        rows: sec.rows,
        rowIds: selected,
      });
    }
  }
  return groups;
}
