import type { SheetSectionType } from '@/lib/utils/table-nav';
import { findFlatRow, flattenNavRows, navSectionsOf } from '@/lib/utils/table-nav';
import { useDesignerStore } from '@/store/designer-store';
import type { AnyTableComponent } from '@/types/schema';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

export type SectionType = SheetSectionType;

export interface CellCoord {
  tableId: string;
  section: SectionType;
  rowId: string;
  cellIdx: number; // logical column
}

/**
 * Flat cross-band selection (plan Phase 4 §13): rows are identified by id only —
 * they may span header/data/footer. Write-back resolves each row to its own
 * schema array via groupSelectedRows (table-nav).
 */
export interface CellsSelection {
  tableId: string;
  rowIds: string[];
  cellIndices: number[]; // logical columns
}

interface SelectionAnchor {
  rowId: string;
  cellIdx: number; // logical column
}

export function useCellSelection(
  component: AnyTableComponent,
  selectedCells: CellsSelection | null,
  setSelectedCell: (cell: CellCoord | null) => void,
  setSelectedCells: (cells: CellsSelection | null) => void
) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState<SelectionAnchor | null>(null);

  const isCellSelected = (rowId: string, logicalCol: number): boolean => {
    if (!selectedCells || selectedCells.tableId !== component.id) return false;
    return selectedCells.rowIds.includes(rowId) && selectedCells.cellIndices.includes(logicalCol);
  };

  // Rectangular range between the anchor and a target cell over the whole flat
  // sheet — crossing band boundaries is allowed (Excel-style).
  const extendRangeTo = (rowId: string, logicalCol: number): boolean => {
    if (!selectionAnchor) return false;
    const flat = flattenNavRows(navSectionsOf(component));
    const anchorIdx = findFlatRow(flat, selectionAnchor.rowId);
    const targetIdx = findFlatRow(flat, rowId);
    if (anchorIdx === -1 || targetIdx === -1) return false;

    const minRow = Math.min(anchorIdx, targetIdx);
    const maxRow = Math.max(anchorIdx, targetIdx);
    const minCol = Math.min(selectionAnchor.cellIdx, logicalCol);
    const maxCol = Math.max(selectionAnchor.cellIdx, logicalCol);
    const rowIds = flat.slice(minRow, maxRow + 1).map((r) => r.row.id);
    const cellIndices = Array.from({ length: maxCol - minCol + 1 }, (_, i) => minCol + i);
    setSelectedCells({ tableId: component.id, rowIds, cellIndices });
    return true;
  };

  const handleCellMouseDown = (
    section: SectionType,
    rowId: string,
    logicalCol: number,
    e: ReactMouseEvent
  ) => {
    e.stopPropagation();

    // Sheet mode is selection-first (Excel-style): the first click on a cell
    // selects it WITHOUT focusing its textarea, so window-level keyboard
    // navigation (use-sheet-keyboard) stays in charge. Clicking the already
    // active cell falls through and focuses the editor for caret editing.
    const { tableSheetEditId, selectedCell: activeCell } = useDesignerStore.getState();
    if (tableSheetEditId === component.id) {
      const isActiveCell =
        activeCell?.tableId === component.id &&
        activeCell.rowId === rowId &&
        activeCell.cellIdx === logicalCol;
      if (!isActiveCell || e.shiftKey) {
        e.preventDefault();
        // preventDefault keeps the old editor focused — blur it explicitly so
        // its pending edit commits (CellEditor saves on blur).
        const focused = document.activeElement;
        if (focused instanceof HTMLTextAreaElement) focused.blur();
      }
    }

    // Shift+Click: extend range from anchor without resetting it
    if (e.shiftKey && selectionAnchor && extendRangeTo(rowId, logicalCol)) {
      return; // do NOT reset anchor
    }

    // Regular click: set anchor and single-cell selection
    setIsSelecting(true);
    setSelectionAnchor({ rowId, cellIdx: logicalCol });
    setSelectedCell({ tableId: component.id, section, rowId, cellIdx: logicalCol });
    setSelectedCells({
      tableId: component.id,
      rowIds: [rowId],
      cellIndices: [logicalCol],
    });
  };

  const handleCellMouseEnter = (rowId: string, logicalCol: number) => {
    if (!isSelecting || !selectionAnchor) return;
    extendRangeTo(rowId, logicalCol);
  };

  const stopSelecting = useCallback(() => setIsSelecting(false), []);

  useEffect(() => {
    if (isSelecting) {
      window.addEventListener('mouseup', stopSelecting);
      return () => window.removeEventListener('mouseup', stopSelecting);
    }
  }, [isSelecting, stopSelecting]);

  return { isCellSelected, handleCellMouseDown, handleCellMouseEnter };
}
