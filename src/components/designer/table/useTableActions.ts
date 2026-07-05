import { buildLogicalGrid } from '@/lib/utils/table-grid';
import { groupSelectedRows, navSectionsOf } from '@/lib/utils/table-nav';
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
  // Resolve which one the given rows actually live in so edits write back to
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

  const schemaRowsOf = (key: string): TableRow[] =>
    ((component as unknown as Record<string, unknown>)[key] as TableRow[] | undefined) || [];

  // Flat selection (plan Phase 4 §13) may span header/data/footer — resolve each
  // selected row back to its own schema array before writing.
  const selectionGroups = () =>
    selectedCells ? groupSelectedRows(navSectionsOf(component), selectedCells.rowIds) : [];

  const clearCellSelection = () => {
    setSelectedCell(null);
    setSelectedCells?.(null);
  };

  /**
   * Runs a per-section util over every selected group and merges the resulting
   * schema updates. Each call sees the previous updates applied, so two groups
   * touching the same key (e.g. legacy `columns` fallbacks) compose correctly.
   */
  const applyPerGroup = (
    fn: (
      comp: TableComponent | FormTableComponent,
      selection: { section: SectionType; rowIds: string[]; cellIndices: number[] }
    ) => Partial<FormTableComponent>
  ) => {
    if (!selectedCells) return;
    let working = component;
    let updates: Record<string, unknown> = {};
    for (const group of selectionGroups()) {
      const partial = fn(working, {
        section: group.section,
        rowIds: group.rowIds,
        cellIndices: selectedCells.cellIndices,
      });
      if (Object.keys(partial).length) {
        updates = { ...updates, ...partial };
        working = { ...working, ...partial } as typeof component;
      }
    }
    if (Object.keys(updates).length) updateComponent(component.id, updates);
  };

  const handleMerge = () => {
    if (!selectedCells) return;
    // A merged cell can't span schema arrays — merge only within one section.
    const groups = selectionGroups();
    if (groups.length !== 1) return;
    const key = groups[0].sectionKey;
    const rows = schemaRowsOf(key);
    if (rows.length === 0) return;

    const rowIndices = groups[0].rowIds
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
    const rows = [...schemaRowsOf(key)];
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
    const updates: Record<string, unknown> = {};
    for (const group of selectionGroups()) {
      const rows = schemaRowsOf(group.sectionKey);
      if (group.sectionKey === 'detailRows' && !rows.length) {
        // Legacy mode: delete columns
        const cols = (updates.columns as typeof component.columns) ?? component.columns;
        updates.columns = cols.filter((_, idx) => !selectedCells.cellIndices.includes(idx));
      } else if (rows.length) {
        updates[group.sectionKey] = rows.filter((r) => !group.rowIds.includes(r.id));
      }
    }
    if (Object.keys(updates).length) updateComponent(component.id, updates);
    setSelectedCell(null);
  };

  /** Delete the selected rows from every structured section they live in. */
  const handleDeleteRows = () => {
    if (!selectedCells) return;
    const updates: Record<string, unknown> = {};
    for (const group of selectionGroups()) {
      const rows = schemaRowsOf(group.sectionKey);
      if (!rows.length) continue; // synthetic rows have no schema backing
      const newRows = rows.filter((r) => !group.rowIds.includes(r.id));
      if (newRows.length !== rows.length) updates[group.sectionKey] = newRows;
    }
    if (!Object.keys(updates).length) return;
    updateComponent(component.id, updates);
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
    applyPerGroup((comp, selection) => clearCellContents(comp, selection));
  };

  const handleAlign = (align: TableTextAlign) => {
    applyPerGroup((comp, selection) => alignSelectedTableCells(comp, selection, align));
  };

  /**
   * Toggles selected body rows between the repeat band ('data' — looped per
   * dataSource item) and 'static' (rendered exactly once). Structured rows only;
   * synthetic column tables have no per-row identity to write back to. Header
   * and footer rows in a cross-band selection are ignored.
   */
  const handleSetRowType = (type: 'static' | 'data') => {
    if (!selectedCells) return;
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
    // Insert after the bottom-most selected row, into that row's own section.
    const groups = selectionGroups();
    const last = groups[groups.length - 1];
    if (!last) return;
    const rows = schemaRowsOf(last.sectionKey);
    const lastRowId = last.rowIds[last.rowIds.length - 1];
    const index = rows.findIndex((r) => r.id === lastRowId);
    const newRows = insertStructuredRow(rows, index, component.columns.length, last.section);
    updateComponent(component.id, { [last.sectionKey]: newRows });
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
  const flags = selectedCells ? selectionGroups() : [];

  const canMerge =
    !!selectedCells &&
    (selectedCells.rowIds.length > 1 || selectedCells.cellIndices.length > 1) &&
    flags.length === 1 &&
    schemaRowsOf(flags[0].sectionKey).length > 0;

  const canSplit = (() => {
    if (!selectedCell) return false;
    const rows = schemaRowsOf(sectionKey(selectedCell.section, [selectedCell.rowId]));
    if (!rows.length) return false;
    const grid = buildLogicalGrid(rows, component.columns.length);
    const rowIdx = rows.findIndex((r) => r.id === selectedCell.rowId);
    if (rowIdx === -1) return false;
    const slot = grid[rowIdx]?.[selectedCell.cellIdx];
    if (!slot) return false;
    const cell = rows[slot.ownerRowIdx]?.cells[slot.ownerPhysIdx];
    return !!cell && ((cell.colspan || 1) > 1 || (cell.rowspan || 1) > 1);
  })();

  const canDeleteRow = flags.some((g) =>
    schemaRowsOf(g.sectionKey).some((r) => g.rowIds.includes(r.id))
  );

  /** 'static' | 'data' when every selected body row agrees, 'mixed' otherwise;
   * null when the selection can't change row type (no body rows / synthetic table). */
  const rowTypeState = ((): 'static' | 'data' | 'mixed' | null => {
    if (!selectedCells) return null;
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
