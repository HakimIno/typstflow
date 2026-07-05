import type { FormTableComponent, TableCell, TableComponent, TableRow } from '@/types/schema';
import { buildLogicalGrid, physToLogical } from './table-grid';

type TableTextAlign = NonNullable<TableCell['align']>;

/** Form-table footer rows stored under `footerGridRows` (undefined for plain tables). */
function footerGridRowsOf(component: TableComponent | FormTableComponent): TableRow[] | undefined {
  return component.type === 'form-table' ? component.footerGridRows : undefined;
}

/**
 * Normalizes a selection into a rectangular range of row and column indices.
 */
export function getSelectionRange(rowIndices: number[], colIndices: number[]) {
  return {
    startRow: Math.min(...rowIndices),
    endRow: Math.max(...rowIndices),
    startCol: Math.min(...colIndices),
    endCol: Math.max(...colIndices),
  };
}

/**
 * Checks if the selection is a valid rectangle (no gaps).
 */
export function isRectangularSelection(
  rowIndices: number[],
  colIndices: number[],
  totalSelected: number
) {
  const { startRow, endRow, startCol, endCol } = getSelectionRange(rowIndices, colIndices);
  const width = endCol - startCol + 1;
  const height = endRow - startRow + 1;
  return width * height === totalSelected;
}

/**
 * Merges cells in structured rows using LOGICAL column indices.
 *
 * The selection rectangle is first expanded (Excel-style) so it fully covers every
 * cell it touches — you can never merge a partial slice of an already-merged cell.
 * Expanding also guarantees the rectangle's top-left is a real cell origin, so the
 * master cell's span lines up with the selection instead of drifting when a prior
 * merge reaches into the selection from above/left.
 */
export function mergeStructuredCells(
  rows: TableRow[],
  startRowIdx: number,
  endRowIdx: number,
  startColIdx: number, // logical column
  endColIdx: number, // logical column
  totalCols: number
): TableRow[] {
  const grid = buildLogicalGrid(rows, totalCols);

  let r0 = Math.min(startRowIdx, endRowIdx);
  let r1 = Math.max(startRowIdx, endRowIdx);
  let c0 = Math.min(startColIdx, endColIdx);
  let c1 = Math.max(startColIdx, endColIdx);

  // Grow the rectangle until it aligns with whole-cell boundaries: any cell whose
  // span pokes into the rectangle drags the edge out to include the whole cell.
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const slot = grid[r]?.[c];
        if (!slot) continue;
        const owner = rows[slot.ownerRowIdx]?.cells[slot.ownerPhysIdx];
        if (!owner) continue;
        const oc0 = slot.logicalCol;
        const oc1 = oc0 + Math.max(1, owner.colspan || 1) - 1;
        const or0 = slot.ownerRowIdx;
        const or1 = or0 + Math.max(1, owner.rowspan || 1) - 1;
        if (or0 < r0) {
          r0 = or0;
          changed = true;
        }
        if (or1 > r1) {
          r1 = or1;
          changed = true;
        }
        if (oc0 < c0) {
          c0 = oc0;
          changed = true;
        }
        if (oc1 > c1) {
          c1 = oc1;
          changed = true;
        }
      }
    }
  }

  // After expansion the top-left position is guaranteed to be a cell origin at (r0, c0).
  const masterSlot = grid[r0]?.[c0];
  if (!masterSlot) return rows;

  const colspan = c1 - c0 + 1;
  const rowspan = r1 - r0 + 1;

  // Collect every non-master physical cell inside the rectangle to remove.
  const toRemove = new Map<number, Set<number>>(); // rowIdx → Set<physIdx>
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const slot = grid[r]?.[c];
      if (!slot) continue;
      if (
        slot.ownerRowIdx === masterSlot.ownerRowIdx &&
        slot.ownerPhysIdx === masterSlot.ownerPhysIdx
      )
        continue;
      if (!toRemove.has(slot.ownerRowIdx)) toRemove.set(slot.ownerRowIdx, new Set());
      toRemove.get(slot.ownerRowIdx)?.add(slot.ownerPhysIdx);
    }
  }

  return rows.map((row, ri) => {
    // Update master cell span BEFORE filtering (indices are still stable here)
    const cells = row.cells.map((cell, pi) => {
      if (ri === masterSlot.ownerRowIdx && pi === masterSlot.ownerPhysIdx) {
        return { ...cell, colspan, rowspan };
      }
      return cell;
    });

    const removeSet = toRemove.get(ri);
    if (!removeSet) return { ...row, cells };
    return { ...row, cells: cells.filter((_, idx) => !removeSet.has(idx)) };
  });
}

/** Parse a column width string to mm. `tableWidthMm` used as fallback for fr/auto. */
function parseColWidthMm(w: string, tableWidthMm: number, colCount: number): number {
  const s = w.trim();
  if (s.endsWith('mm')) return Number.parseFloat(s);
  if (s.endsWith('pt')) return Number.parseFloat(s) * 0.3528;
  // fr / * / bare number — treat as equal share of table width
  return tableWidthMm / Math.max(colCount, 1);
}

/**
 * Inserts a column into the table.
 * All existing columns are scaled down proportionally to make room for the new one
 * so the total width stays equal to component.width.
 */
export function insertColumn(
  component: TableComponent | FormTableComponent,
  index: number
): Partial<FormTableComponent> {
  const totalMm = component.width || 180;
  const existingCount = component.columns.length;

  // Parse existing widths in mm
  const existingMm = component.columns.map((c) => parseColWidthMm(c.width, totalMm, existingCount));

  // New column gets an equal share; existing columns shrink proportionally
  const newColMm = totalMm / (existingCount + 1);
  const scale = (totalMm - newColMm) / totalMm;

  // Rebuild existing columns with scaled widths
  const newCols = component.columns.map((col, i) => ({
    ...col,
    width: `${(existingMm[i] * scale).toFixed(1)}mm`,
  }));

  // Splice the new column in after the selected index
  newCols.splice(index + 1, 0, {
    id: Math.random().toString(36).substring(7),
    header: 'New Column',
    field: '',
    width: `${newColMm.toFixed(1)}mm`,
  });

  const insertCell = (row: TableRow): TableRow => ({
    ...row,
    cells: [
      ...row.cells.slice(0, index + 1),
      { id: Math.random().toString(36).substring(7), content: '' },
      ...row.cells.slice(index + 1),
    ],
  });

  const updates: Partial<FormTableComponent> = { columns: newCols };
  if (component.headerRows?.length) updates.headerRows = component.headerRows.map(insertCell);
  if (component.detailRows?.length) updates.detailRows = component.detailRows.map(insertCell);
  if (component.footerRows?.length) updates.footerRows = component.footerRows.map(insertCell);
  const gridRows = footerGridRowsOf(component);
  if (gridRows?.length) updates.footerGridRows = gridRows.map(insertCell);

  return updates;
}

/**
 * Deletes one or more LOGICAL columns from the table.
 *
 * Removes the columns from `columns` and rewrites every structured row so that:
 *  - a cell spanning a deleted column shrinks its colspan by the number of its
 *    spanned columns that were deleted, and
 *  - a cell that lies entirely inside the deleted range is dropped.
 *
 * Never deletes the last remaining column. Returns an empty object (no-op) if
 * the selection is empty or would remove every column. Remaining column widths
 * are left untouched — the renderer/generator rescales fixed widths to fill the
 * component box (see resolveTableColumnWidths).
 */
export function deleteColumns(
  component: TableComponent | FormTableComponent,
  logicalColIndices: number[]
): Partial<FormTableComponent> {
  const totalCols = component.columns.length;
  const toDelete = new Set(logicalColIndices.filter((c) => c >= 0 && c < totalCols));
  if (toDelete.size === 0 || toDelete.size >= totalCols) return {};

  const newColumns = component.columns.filter((_, idx) => !toDelete.has(idx));

  const remapRows = (rows: TableRow[]): TableRow[] => {
    const grid = buildLogicalGrid(rows, totalCols);
    return rows.map((row, ri) => {
      const physMap = physToLogical(grid, ri, row.cells.length);
      const newCells: TableCell[] = [];
      for (let pi = 0; pi < row.cells.length; pi++) {
        const startLog = physMap[pi];
        if (startLog < 0) continue; // safety: cell not placed in grid
        const cell = row.cells[pi];
        const cs = Math.max(1, cell.colspan || 1);
        let survivingSpan = 0;
        for (let dc = 0; dc < cs; dc++) {
          const lc = startLog + dc;
          if (lc < totalCols && !toDelete.has(lc)) survivingSpan++;
        }
        if (survivingSpan === 0) continue; // whole cell removed
        newCells.push(
          survivingSpan > 1 ? { ...cell, colspan: survivingSpan } : { ...cell, colspan: undefined }
        );
      }
      return { ...row, cells: newCells };
    });
  };

  const updates: Partial<FormTableComponent> = { columns: newColumns };
  if (component.headerRows?.length) updates.headerRows = remapRows(component.headerRows);
  if (component.detailRows?.length) updates.detailRows = remapRows(component.detailRows);
  if (component.footerRows?.length) updates.footerRows = remapRows(component.footerRows);
  const gridRows = footerGridRowsOf(component);
  if (gridRows?.length) updates.footerGridRows = remapRows(gridRows);
  return updates;
}

/**
 * Clears the text content of the selected cells without changing the grid shape.
 * Falls back to clearing the `columns` header/field for legacy synthetic tables
 * (those with no structured rows in the selected section).
 */
export function clearCellContents(
  component: TableComponent | FormTableComponent,
  selection: { section: 'header' | 'footer' | 'data'; rowIds: string[]; cellIndices: number[] }
): Partial<FormTableComponent> {
  const { section, rowIds, cellIndices } = selection;
  // Form-table footers may live in footerGridRows — pick the array that actually
  // contains the selected rows.
  const gridRows = footerGridRowsOf(component);
  const footerKey =
    section === 'footer' &&
    gridRows?.length &&
    !component.footerRows?.some((r) => rowIds.includes(r.id))
      ? 'footerGridRows'
      : 'footerRows';
  const key = section === 'header' ? 'headerRows' : section === 'footer' ? footerKey : 'detailRows';
  const rows =
    ((component as unknown as Record<string, unknown>)[key] as TableRow[] | undefined) || [];
  const colSet = new Set(cellIndices);

  // Legacy synthetic rows — clear the columns array directly.
  if (!rows.length) {
    if (section === 'footer') return {};
    const field = section === 'header' ? 'header' : 'field';
    const newCols = component.columns.map((col, idx) =>
      colSet.has(idx) ? { ...col, [field]: '' } : col
    );
    return { columns: newCols };
  }

  const rowSet = new Set(rowIds);
  const grid = buildLogicalGrid(rows, component.columns.length);
  let anyChanged = false;
  const newRows = rows.map((row, ri) => {
    if (!rowSet.has(row.id)) return row;
    const physMap = physToLogical(grid, ri, row.cells.length);
    let changed = false;
    const newCells = row.cells.map((cell, pi) => {
      if (colSet.has(physMap[pi]) && cell.content) {
        changed = true;
        return { ...cell, content: '' };
      }
      return cell;
    });
    if (!changed) return row;
    anyChanged = true;
    return { ...row, cells: newCells };
  });
  return anyChanged ? { [key]: newRows } : {};
}

/**
 * Applies horizontal alignment to selected logical cells.
 * Falls back to column alignment for legacy synthetic tables with no structured
 * rows in the selected section.
 */
export function alignSelectedTableCells(
  component: TableComponent | FormTableComponent,
  selection: { section: 'header' | 'footer' | 'data'; rowIds: string[]; cellIndices: number[] },
  align: TableTextAlign
): Partial<FormTableComponent> {
  const { section, rowIds, cellIndices } = selection;
  const gridRows = footerGridRowsOf(component);
  const footerKey =
    section === 'footer' &&
    gridRows?.length &&
    !component.footerRows?.some((r) => rowIds.includes(r.id))
      ? 'footerGridRows'
      : 'footerRows';
  const key = section === 'header' ? 'headerRows' : section === 'footer' ? footerKey : 'detailRows';
  const rows =
    ((component as unknown as Record<string, unknown>)[key] as TableRow[] | undefined) || [];
  const colSet = new Set(cellIndices);

  if (!rows.length) {
    if (section === 'footer') return {};
    const newCols = component.columns.map((col, idx) =>
      colSet.has(idx) ? { ...col, align } : col
    );
    return { columns: newCols };
  }

  const rowSet = new Set(rowIds);
  const grid = buildLogicalGrid(rows, component.columns.length);
  let anyChanged = false;
  const newRows = rows.map((row, ri) => {
    if (!rowSet.has(row.id)) return row;
    const physMap = physToLogical(grid, ri, row.cells.length);
    let changed = false;
    const newCells = row.cells.map((cell, pi) => {
      if (!colSet.has(physMap[pi])) return cell;
      changed = true;
      return { ...cell, align };
    });
    if (!changed) return row;
    anyChanged = true;
    return { ...row, cells: newCells };
  });

  return anyChanged ? { [key]: newRows } : {};
}

/**
 * Inserts a structured row (header / data / footer).
 */
export function insertStructuredRow(
  rows: TableRow[],
  index: number,
  colCount: number,
  type: 'header' | 'data' | 'footer'
): TableRow[] {
  const newRows = [...rows];
  const prefix = type === 'header' ? 'hr' : type === 'footer' ? 'fr' : 'dr';
  const newRow: TableRow = {
    id: `${prefix}-${Math.random().toString(36).substring(7)}`,
    type: type === 'data' ? 'data' : type,
    cells: Array.from({ length: colCount }, () => ({
      id: Math.random().toString(36).substring(7),
      content: '',
    })),
    repeat: true,
  };
  // If index is -1 (synthetic / not found), append at end
  const insertAt = Math.max(0, index + 1);
  newRows.splice(insertAt, 0, newRow);
  return newRows;
}
