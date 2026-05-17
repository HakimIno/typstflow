import { buildLogicalGrid } from '@/lib/utils/table-grid';
import { insertColumn, insertStructuredRow, mergeStructuredCells } from '@/lib/utils/table-utils';
import type { TableComponent, TableRow } from '@/types/schema';
import type { CellCoord, CellsSelection, SectionType } from './useCellSelection';

export function useTableActions(
  component: TableComponent,
  selectedCell: CellCoord | null,
  selectedCells: CellsSelection | null,
  updateComponent: (id: string, updates: Record<string, unknown>) => void,
  setSelectedCell: (cell: CellCoord | null) => void
) {
  const sectionKey = (section: SectionType) =>
    section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';

  const getRows = (section: SectionType): TableRow[] =>
    (component[sectionKey(section) as keyof TableComponent] as TableRow[]) || [];

  const handleMerge = () => {
    if (!selectedCells) return;
    const key = sectionKey(selectedCells.section);
    const rows = getRows(selectedCells.section);
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
    const key = sectionKey(section);
    const rows = [...getRows(section)];
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
      const key = sectionKey(section);
      const rows = getRows(section);
      const newRows = rows.filter((r) => !rowIds.includes(r.id));
      updateComponent(component.id, { [key]: newRows });
    }
    setSelectedCell(null);
  };

  const handleInsertRow = () => {
    if (!selectedCells) return;
    const section = selectedCells.section;
    const key = sectionKey(section);
    const rows = getRows(section);
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

  return {
    handleMerge,
    handleSplit,
    handleDelete,
    handleInsertRow,
    handleInsertCol,
    handleCellSave,
  };
}
