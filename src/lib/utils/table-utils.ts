import type { TableCell, TableComponent, TableRow } from '@/types/schema';

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
 * Merges cells in structured rows (header/footer/detail).
 */
export function mergeStructuredCells(
  rows: TableRow[],
  startRowIdx: number,
  endRowIdx: number,
  startColIdx: number,
  endColIdx: number
): TableRow[] {
  const newRows = [...rows];

  const colspan = endColIdx - startColIdx + 1;
  const rowspan = endRowIdx - startRowIdx + 1;

  // Update the target cell (top-left of selection)
  const targetRow = newRows[startRowIdx];
  newRows[startRowIdx] = {
    ...targetRow,
    cells: targetRow.cells.map((cell, idx) => {
      if (idx === startColIdx) return { ...cell, colspan, rowspan };
      return cell;
    }),
  };

  // Remove cells that are now covered by the span
  for (let r = startRowIdx; r <= endRowIdx; r++) {
    const row = newRows[r];
    const cellsToKeep: TableCell[] = [];
    for (let c = 0; c < row.cells.length; c++) {
      const isTarget = r === startRowIdx && c === startColIdx;
      const isInRange = c >= startColIdx && c <= endColIdx;
      if (isTarget) {
        cellsToKeep.push(newRows[startRowIdx].cells[startColIdx]);
      } else if (!isInRange) {
        cellsToKeep.push(row.cells[c]);
      }
    }
    newRows[r] = { ...row, cells: cellsToKeep };
  }

  return newRows;
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
export function insertColumn(component: TableComponent, index: number): Partial<TableComponent> {
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

  const updates: Partial<TableComponent> = { columns: newCols };
  if (component.headerRows?.length) updates.headerRows = component.headerRows.map(insertCell);
  if (component.detailRows?.length) updates.detailRows = component.detailRows.map(insertCell);
  if (component.footerRows?.length) updates.footerRows = component.footerRows.map(insertCell);

  return updates;
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
