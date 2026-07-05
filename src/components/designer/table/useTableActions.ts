import { buildLogicalGrid } from '@/lib/utils/table-grid';
import {
  alignSelectedTableCells,
  clearCellContents,
  deleteColumns,
  insertColumn,
  insertStructuredRow,
  mergeStructuredCells,
} from '@/lib/utils/table-utils';
import type { FormTableComponent, TableComponent, TableRow } from '@/types/schema';
import type { CellCoord, CellsSelection, SectionType } from './useCellSelection';

type TableTextAlign = 'left' | 'center' | 'right';

export function useTableActions(
  component: TableComponent | FormTableComponent,
  selectedCell: CellCoord | null,
  selectedCells: CellsSelection | null,
  updateComponent: (id: string, updates: Record<string, unknown>) => void,
  setSelectedCell: (cell: CellCoord | null) => void,
  setSelectedCells?: (cells: CellsSelection | null) => void
) {
  // Form-tables keep footer rows in TWO schema keys (footerRows + footerGridRows).
  // Resolve which one the selected rows actually live in so edits write back to
  // the right array instead of silently no-oping against an empty footerRows.
  const footerKey = (rowIds?: string[]): 'footerRows' | 'footerGridRows' => {
    if (component.type !== 'form-table') return 'footerRows';
    const gridRows = component.footerGridRows;
    if (!gridRows?.length) return 'footerRows';
    if (rowIds?.length && component.footerRows?.some((r) => rowIds.includes(r.id))) {
      return 'footerRows';
    }
    return 'footerGridRows';
  };

  const sectionKey = (section: SectionType, rowIds?: string[]) =>
    section === 'header' ? 'headerRows' : section === 'footer' ? footerKey(rowIds) : 'detailRows';

  const selectedRowIds = (): string[] | undefined =>
    selectedCells?.rowIds ?? (selectedCell ? [selectedCell.rowId] : undefined);

  const getRows = (section: SectionType, rowIds?: string[]): TableRow[] =>
    ((component as unknown as Record<string, unknown>)[
      sectionKey(section, rowIds ?? selectedRowIds())
    ] as TableRow[]) || [];

  const clearCellSelection = () => {
    setSelectedCell(null);
    setSelectedCells?.(null);
  };

  const handleMerge = () => {
    if (!selectedCells) return;
    const key = sectionKey(selectedCells.section, selectedCells.rowIds);
    const rows = getRows(selectedCells.section, selectedCells.rowIds);
    if (rows.length === 0) return;

    const rowIndices = selectedCells.rowIds
      .map((id) => rows.findIndex((r) => r.id === id))
      .filter((i) => i !== -1)
      .sort((a, b) => a - b);
    if (rowIndices.length === 0) return;

    const colIndices = [...selectedCells.cellIndices].sort((a, b) => a - b);

    const newRows = mergeStructuredCells(
      rows,
      rowIndices[0],
      rowIndices[rowIndices.length - 1],
      colIndices[0],
      colIndices[colIndices.length - 1],
      component.columns.length
    );
    updateComponent(component.id, { [key]: newRows });
    setSelectedCell(null);
  };

  const handleSplit = () => {
    if (!selectedCell) return;
    const { section, rowId, cellIdx: logicalCol } = selectedCell;
    const key = sectionKey(section, [rowId]);
    const rows = [...getRows(section, [rowId])];
    const rowIdx = rows.findIndex((r) => r.id === rowId);
    if (rowIdx === -1) return;

    const grid = buildLogicalGrid(rows, component.columns.length);
    const slot = grid[rowIdx]?.[logicalCol];
    if (!slot) return;

    const masterRow = rows[slot.ownerRowIdx];
    const cell = masterRow.cells[slot.ownerPhysIdx];
    if (!cell || (!cell.colspan && !cell.rowspan)) return;

    const currentColspan = cell.colspan || 1;
    const newCells = [...masterRow.cells];
    newCells[slot.ownerPhysIdx] = { ...cell, colspan: 1, rowspan: 1 };

    // Re-insert placeholder cells for each extra spanned column
    for (let i = 1; i < currentColspan; i++) {
      newCells.splice(slot.ownerPhysIdx + i, 0, {
        id: `restore-${Math.random().toString(36).substring(7)}`,
        content: '',
      });
    }

    rows[slot.ownerRowIdx] = { ...masterRow, cells: newCells };
    updateComponent(component.id, { [key]: rows });
  };

  const handleDelete = () => {
    if (!selectedCells) return;
    const { section, rowIds, cellIndices } = selectedCells;

    if (section === 'data' && !component.detailRows?.length) {
      // Legacy mode: delete columns
      const newCols = component.columns.filter((_, idx) => !cellIndices.includes(idx));
      updateComponent(component.id, { columns: newCols });
    } else {
      const key = sectionKey(section, rowIds);
      const rows = getRows(section, rowIds);
      const newRows = rows.filter((r) => !rowIds.includes(r.id));
      updateComponent(component.id, { [key]: newRows });
    }
    setSelectedCell(null);
  };

  /** Delete the selected rows from a structured section (no-op for synthetic tables). */
  const handleDeleteRows = () => {
    if (!selectedCells) return;
    const { section, rowIds } = selectedCells;
    const rows = getRows(section, rowIds);
    if (!rows.length) return;
    const newRows = rows.filter((r) => !rowIds.includes(r.id));
    if (newRows.length === rows.length) return;
    updateComponent(component.id, { [sectionKey(section, rowIds)]: newRows });
    clearCellSelection();
  };

  /** Delete the selected columns across every section (colspan-aware). */
  const handleDeleteColumns = () => {
    if (!selectedCells) return;
    const updates = deleteColumns(component, selectedCells.cellIndices);
    if (!updates.columns) return; // guarded against deleting the last column
    updateComponent(component.id, updates as Record<string, unknown>);
    clearCellSelection();
  };

  /** Clear text content of the selected cells, keeping the grid shape intact. */
  const handleClearContents = () => {
    if (!selectedCells) return;
    const updates = clearCellContents(component, selectedCells);
    if (Object.keys(updates).length === 0) return;
    updateComponent(component.id, updates as Record<string, unknown>);
  };

  const handleAlign = (align: TableTextAlign) => {
    if (!selectedCells) return;
    const updates = alignSelectedTableCells(component, selectedCells, align);
    if (Object.keys(updates).length === 0) return;
    updateComponent(component.id, updates as Record<string, unknown>);
  };

  /**
   * Toggles selected body rows between the repeat band ('data' — looped per
   * dataSource item) and 'static' (rendered exactly once). Structured rows only;
   * synthetic column tables have no per-row identity to write back to.
   */
  const handleSetRowType = (type: 'static' | 'data') => {
    if (!selectedCells || selectedCells.section !== 'data') return;
    const rows = component.detailRows ?? [];
    if (!rows.length) return;
    const rowSet = new Set(selectedCells.rowIds);
    let changed = false;
    const newRows = rows.map((row) => {
      if (!rowSet.has(row.id) || row.type === type) return row;
      if (row.type !== 'data' && row.type !== 'static') return row;
      changed = true;
      return { ...row, type };
    });
    if (changed) updateComponent(component.id, { detailRows: newRows });
  };

  const handleInsertRow = () => {
    if (!selectedCells) return;
    const section = selectedCells.section;
    const key = sectionKey(section, selectedCells.rowIds);
    const rows = getRows(section, selectedCells.rowIds);
    const lastRowId = selectedCells.rowIds[selectedCells.rowIds.length - 1];
    const index = rows.findIndex((r) => r.id === lastRowId);
    const newRows = insertStructuredRow(rows, index, component.columns.length, section as any);
    updateComponent(component.id, { [key]: newRows });
  };

  const handleInsertCol = () => {
    if (!selectedCells) return;
    const lastColIdx = selectedCells.cellIndices[selectedCells.cellIndices.length - 1];
    const updates = insertColumn(component, lastColIdx);
    updateComponent(component.id, updates as Record<string, unknown>);
  };

  const handleCellSave = (
    key: string,
    rows: TableRow[],
    rowIdx: number,
    cellId: string,
    newVal: string
  ) => {
    const newRows = [...rows];
    const newCells = [...newRows[rowIdx].cells];
    const idx = newCells.findIndex((c) => c.id === cellId);
    if (idx === -1) return;
    newCells[idx] = { ...newCells[idx], content: newVal };
    newRows[rowIdx] = { ...newRows[rowIdx], cells: newCells };
    updateComponent(component.id, { [key]: newRows });
  };

  // ─── Availability flags (drive context-menu enabled/disabled state) ─────────
  const distinctCols = selectedCells ? new Set(selectedCells.cellIndices).size : 0;

  const canMerge =
    !!selectedCells && (selectedCells.rowIds.length > 1 || selectedCells.cellIndices.length > 1);

  const canSplit = (() => {
    if (!selectedCell) return false;
    const rows = getRows(selectedCell.section);
    if (!rows.length) return false;
    const grid = buildLogicalGrid(rows, component.columns.length);
    const rowIdx = rows.findIndex((r) => r.id === selectedCell.rowId);
    if (rowIdx === -1) return false;
    const slot = grid[rowIdx]?.[selectedCell.cellIdx];
    if (!slot) return false;
    const cell = rows[slot.ownerRowIdx]?.cells[slot.ownerPhysIdx];
    return !!cell && ((cell.colspan || 1) > 1 || (cell.rowspan || 1) > 1);
  })();

  const canDeleteRow = !!selectedCells && getRows(selectedCells.section).length > 0;

  /** 'static' | 'data' when every selected body row agrees, 'mixed' otherwise;
   * null when the selection can't change row type (not body / synthetic table). */
  const rowTypeState = ((): 'static' | 'data' | 'mixed' | null => {
    if (!selectedCells || selectedCells.section !== 'data') return null;
    const rows = component.detailRows ?? [];
    if (!rows.length) return null;
    const rowSet = new Set(selectedCells.rowIds);
    const types = rows
      .filter((row) => rowSet.has(row.id))
      .map((row) => (row.type === 'static' ? 'static' : 'data'));
    if (!types.length) return null;
    if (types.every((t) => t === 'static')) return 'static';
    if (types.every((t) => t === 'data')) return 'data';
    return 'mixed';
  })();

  const canDeleteColumn =
    !!selectedCells && distinctCols >= 1 && component.columns.length - distinctCols >= 1;

  const canClear = !!selectedCells;

  return {
    handleMerge,
    handleSplit,
    handleDelete,
    handleDeleteRows,
    handleDeleteColumns,
    handleClearContents,
    handleAlign,
    handleSetRowType,
    handleInsertRow,
    handleInsertCol,
    handleCellSave,
    rowTypeState,
    canMerge,
    canSplit,
    canDeleteRow,
    canDeleteColumn,
    canClear,
  };
}
