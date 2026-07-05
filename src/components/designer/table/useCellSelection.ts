import { useDesignerStore } from '@/store/designer-store';
import type { AnyTableComponent, TableRow } from '@/types/schema';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

export type SectionType = 'header' | 'data' | 'footer';

export interface CellCoord {
  tableId: string;
  section: SectionType;
  rowId: string;
  cellIdx: number; // logical column
}

export interface CellsSelection {
  tableId: string;
  section: SectionType;
  rowIds: string[];
  cellIndices: number[]; // logical columns
}

interface SelectionAnchor {
  rowId: string;
  cellIdx: number; // logical column
  section: SectionType;
}

export function useCellSelection(
  component: AnyTableComponent,
  selectedCells: CellsSelection | null,
  setSelectedCell: (cell: CellCoord | null) => void,
  setSelectedCells: (cells: CellsSelection | null) => void
) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState<SelectionAnchor | null>(null);

  const getSchemaRows = (section: SectionType): TableRow[] => {
    if (section === 'footer') {
      // Form-table footers span two schema keys; concat in render order so
      // drag/shift range selection works across the whole footer.
      const gridRows = component.type === 'form-table' ? (component.footerGridRows ?? []) : [];
      return [...(component.footerRows ?? []), ...gridRows];
    }
    const key = section === 'header' ? 'headerRows' : 'detailRows';
    return component[key] || [];
  };

  const isCellSelected = (section: SectionType, rowId: string, logicalCol: number): boolean => {
    if (
      !selectedCells ||
      selectedCells.tableId !== component.id ||
      selectedCells.section !== section
    )
      return false;
    return selectedCells.rowIds.includes(rowId) && selectedCells.cellIndices.includes(logicalCol);
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
        activeCell.section === section &&
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
    if (e.shiftKey && selectionAnchor && selectionAnchor.section === section) {
      const rows = getSchemaRows(section);
      const anchorRowIdx = rows.findIndex((r) => r.id === selectionAnchor.rowId);
      const targetRowIdx = rows.findIndex((r) => r.id === rowId);

      if (anchorRowIdx !== -1 && targetRowIdx !== -1) {
        const minRow = Math.min(anchorRowIdx, targetRowIdx);
        const maxRow = Math.max(anchorRowIdx, targetRowIdx);
        const minCol = Math.min(selectionAnchor.cellIdx, logicalCol);
        const maxCol = Math.max(selectionAnchor.cellIdx, logicalCol);
        const rowIds = rows.slice(minRow, maxRow + 1).map((r) => r.id);
        const cellIndices = Array.from({ length: maxCol - minCol + 1 }, (_, i) => minCol + i);
        setSelectedCells({ tableId: component.id, section, rowIds, cellIndices });
        return; // do NOT reset anchor
      }
    }

    // Regular click: set anchor and single-cell selection
    setIsSelecting(true);
    setSelectionAnchor({ rowId, cellIdx: logicalCol, section });
    setSelectedCell({ tableId: component.id, section, rowId, cellIdx: logicalCol });
    setSelectedCells({
      tableId: component.id,
      section,
      rowIds: [rowId],
      cellIndices: [logicalCol],
    });
  };

  const handleCellMouseEnter = (section: SectionType, rowId: string, logicalCol: number) => {
    if (!isSelecting || !selectionAnchor || selectionAnchor.section !== section) return;
    const rows = getSchemaRows(section);
    const anchorRowIdx = rows.findIndex((r) => r.id === selectionAnchor.rowId);
    const targetRowIdx = rows.findIndex((r) => r.id === rowId);
    if (anchorRowIdx === -1 || targetRowIdx === -1) return;

    const minRow = Math.min(anchorRowIdx, targetRowIdx);
    const maxRow = Math.max(anchorRowIdx, targetRowIdx);
    const minCol = Math.min(selectionAnchor.cellIdx, logicalCol);
    const maxCol = Math.max(selectionAnchor.cellIdx, logicalCol);
    const rowIds = rows.slice(minRow, maxRow + 1).map((r) => r.id);
    const cellIndices = Array.from({ length: maxCol - minCol + 1 }, (_, i) => minCol + i);
    setSelectedCells({ tableId: component.id, section, rowIds, cellIndices });
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
