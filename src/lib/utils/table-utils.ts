import { TableComponent, TableRow, TableCell } from '@/types/schema';

/**
 * Normalizes a selection into a rectangular range of row and column indices.
 */
export function getSelectionRange(
  rowIndices: number[],
  colIndices: number[]
) {
  return {
    startRow: Math.min(...rowIndices),
    endRow: Math.max(...rowIndices),
    startCol: Math.min(...colIndices),
    endCol: Math.max(...colIndices),
  };
}

/**
 * Checks if the selection is a valid rectangle (no gaps).
 * In a CSS grid with spans, this can be complex.
 * For now, we assume a simple grid selection.
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
 * Merges cells in structured rows (header/footer).
 */
export function mergeStructuredCells(
  rows: TableRow[],
  startRowIdx: number,
  endRowIdx: number,
  startColIdx: number,
  endColIdx: number
): TableRow[] {
  const newRows = [...rows];
  
  // The "main" cell that will absorb others (top-left)
  const targetRow = newRows[startRowIdx];
  const targetCell = targetRow.cells[startColIdx];
  
  const colspan = endColIdx - startColIdx + 1;
  const rowspan = endRowIdx - startRowIdx + 1;
  
  // Update the target cell
  newRows[startRowIdx] = {
    ...targetRow,
    cells: targetRow.cells.map((cell, idx) => {
      if (idx === startColIdx) {
        return { ...cell, colspan, rowspan };
      }
      return cell;
    }),
  };
  
  // Remove or mark for deletion other cells in the range
  // This is tricky because we use simple arrays. 
  // We should actually remove the elements that are now covered by the span.
  
  for (let r = startRowIdx; r <= endRowIdx; r++) {
    const row = newRows[r];
    const cellsToKeep: TableCell[] = [];
    
    for (let c = 0; c < row.cells.length; c++) {
      const isTarget = r === startRowIdx && c === startColIdx;
      const isInRange = r >= startRowIdx && r <= endRowIdx && c >= startColIdx && c <= endColIdx;
      
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

/**
 * Inserts a column into the table.
 */
export function insertColumn(
  component: TableComponent,
  index: number
): Partial<TableComponent> {
  const newCols = [...component.columns];
  const newColId = Math.random().toString(36).substring(7);
  newCols.splice(index + 1, 0, {
    id: newColId,
    header: 'New Column',
    field: '',
    width: '1fr',
  });

  const updates: Partial<TableComponent> = { columns: newCols };

  if (component.headerRows) {
    updates.headerRows = component.headerRows.map((row) => ({
      ...row,
      cells: [
        ...row.cells.slice(0, index + 1),
        { id: Math.random().toString(36).substring(7), content: '' },
        ...row.cells.slice(index + 1),
      ],
    }));
  }

  if (component.footerRows) {
    updates.footerRows = component.footerRows.map((row) => ({
      ...row,
      cells: [
        ...row.cells.slice(0, index + 1),
        { id: Math.random().toString(36).substring(7), content: '' },
        ...row.cells.slice(index + 1),
      ],
    }));
  }

  return updates;
}

/**
 * Inserts a structured row (header or footer).
 */
export function insertStructuredRow(
  rows: TableRow[],
  index: number,
  colCount: number,
  type: 'header' | 'footer'
): TableRow[] {
  const newRows = [...rows];
  const newRow: TableRow = {
    id: `${type === 'header' ? 'hr' : 'fr'}-${Math.random().toString(36).substring(7)}`,
    type,
    cells: Array.from({ length: colCount }, () => ({
      id: Math.random().toString(36).substring(7),
      content: '',
    })),
    repeat: true,
  };
  newRows.splice(index + 1, 0, newRow);
  return newRows;
}
