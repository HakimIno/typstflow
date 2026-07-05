'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { buildLogicalGrid, physToLogical } from '@/lib/utils/table-grid';
import { insertColumn, insertStructuredRow, mergeStructuredCells } from '@/lib/utils/table-utils';
import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode, TableCell, TableComponent, TableRow } from '@/types/schema';
import { clsx } from 'clsx';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Columns2,
  Copy,
  GripHorizontal,
  Merge,
  Plus,
  Rows3,
  Split,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { memo, useRef } from 'react';
import { FloatingToolbar, FloatingToolbarButton } from '../toolbar/FloatingToolbar';
import { ToolbarSeparator } from '../toolbar/ToolbarSeparator';

interface ActionBarProps {
  component: ComponentNode;
  isSelected: boolean;
  selectedCount: number;
  isDragging: boolean;
  flowMode?: boolean;
  handleDuplicate: (e: React.MouseEvent) => void;
  handleFlowIndentLeft?: (e: React.MouseEvent) => void;
  handleFlowIndentRight?: (e: React.MouseEvent) => void;
}

export const ActionBar = memo(function ActionBar({
  component,
  isSelected,
  selectedCount,
  isDragging,
  flowMode = false,
  handleDuplicate,
  handleFlowIndentLeft,
  handleFlowIndentRight,
}: ActionBarProps) {
  const bringToFront = useDesignerStore((s) => s.bringToFront);
  const sendToBack = useDesignerStore((s) => s.sendToBack);
  const moveUp = useDesignerStore((s) => s.moveUp);
  const moveDown = useDesignerStore((s) => s.moveDown);
  const removeComponent = useDesignerStore((s) => s.removeComponent);
  const removeComponents = useDesignerStore((state) => state.removeComponents);
  const updateComponent = useDesignerStore((s) => s.updateComponent);
  const zoom = useDesignerStore((state) => state.zoom);

  // Table cell state
  const setSelectedCell = useDesignerStore((s) => s.setSelectedCell);
  const selectedCell = useDesignerStore((s) => s.selectedCell);
  const selectedCells = useDesignerStore((s) => s.selectedCells);

  const startXRef = useRef(0);
  const startCompXRef = useRef(0);

  // ─── Table helpers ──────────────────────────────────────────────────────
  const isTableWithCells = component.type === 'table' && selectedCells?.tableId === component.id;
  const tableComp = isTableWithCells ? (component as TableComponent) : null;
  const isMultiCellSelected =
    isTableWithCells &&
    ((selectedCells?.rowIds.length ?? 0) > 1 || (selectedCells?.cellIndices.length ?? 0) > 1);

  const getTableRows = (section: 'header' | 'data' | 'footer'): TableRow[] => {
    if (!tableComp) return [];
    const key =
      section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
    return (tableComp[key as keyof TableComponent] as TableRow[]) || [];
  };

  const updateSelectedTableCells = (updater: (cell: TableCell) => TableCell) => {
    if (!selectedCells || !tableComp) return false;
    const section = selectedCells.section as 'header' | 'data' | 'footer';
    const key =
      section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
    const rows = getTableRows(section);
    if (!rows.length) return false;

    const grid = buildLogicalGrid(rows, tableComp.columns.length);
    const selectedRowIds = new Set(selectedCells.rowIds);
    const selectedCols = new Set(selectedCells.cellIndices);
    let changed = false;

    const newRows = rows.map((row, rowIdx) => {
      if (!selectedRowIds.has(row.id)) return row;

      const physMap = physToLogical(grid, rowIdx, row.cells.length);
      const newCells = row.cells.map((cell, physIdx) => {
        const logicalCol = physMap[physIdx];
        if (!selectedCols.has(logicalCol)) return cell;
        changed = true;
        return updater(cell);
      });

      return changed ? { ...row, cells: newCells } : row;
    });

    if (!changed) return false;
    updateComponent(tableComp.id, { [key]: newRows } as any);
    return true;
  };

  const handleTableMerge = () => {
    if (!selectedCells || !tableComp) return;
    const section = selectedCells.section as 'header' | 'data' | 'footer';
    const key =
      section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
    const rows = getTableRows(section);
    if (!rows.length) return;
    const rowIndices = selectedCells.rowIds
      .map((id) => rows.findIndex((r) => r.id === id))
      .filter((i) => i !== -1)
      .sort((a, b) => a - b);
    if (!rowIndices.length) return;
    const colIndices = [...selectedCells.cellIndices].sort((a, b) => a - b);
    const newRows = mergeStructuredCells(
      rows,
      rowIndices[0],
      rowIndices[rowIndices.length - 1],
      colIndices[0],
      colIndices[colIndices.length - 1],
      tableComp.columns.length
    );
    updateComponent(tableComp.id, { [key]: newRows } as any);
    setSelectedCell(null);
  };

  const handleTableSplit = () => {
    if (!selectedCell || !tableComp) return;
    const { section, rowId, cellIdx: logicalCol } = selectedCell as any;
    const key =
      section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
    const rows = [...getTableRows(section as 'header' | 'data' | 'footer')];
    const rowIdx = rows.findIndex((r) => r.id === rowId);
    if (rowIdx === -1) return;
    const grid = buildLogicalGrid(rows, tableComp.columns.length);
    const slot = grid[rowIdx]?.[logicalCol];
    if (!slot) return;
    const cell = rows[slot.ownerRowIdx].cells[slot.ownerPhysIdx];
    if (!cell || (!cell.colspan && !cell.rowspan)) return;
    const cs = cell.colspan || 1;
    const newCells = [...rows[slot.ownerRowIdx].cells];
    newCells[slot.ownerPhysIdx] = { ...cell, colspan: 1, rowspan: 1 };
    for (let i = 1; i < cs; i++) {
      newCells.splice(slot.ownerPhysIdx + i, 0, {
        id: `restore-${Math.random().toString(36).substring(7)}`,
        content: '',
      });
    }
    rows[slot.ownerRowIdx] = { ...rows[slot.ownerRowIdx], cells: newCells };
    updateComponent(tableComp.id, { [key]: rows } as any);
  };

  const handleTableAlign = (align: 'left' | 'center' | 'right') => {
    if (!selectedCells || !tableComp) return;
    const section = selectedCells.section as 'header' | 'data' | 'footer';
    if (updateSelectedTableCells((cell) => ({ ...cell, align }))) return;

    if (section === 'data') {
      const newCols = [...tableComp.columns];
      for (const logCol of selectedCells.cellIndices) {
        if (newCols[logCol]) newCols[logCol] = { ...newCols[logCol], align };
      }
      updateComponent(tableComp.id, { columns: newCols } as any);
    } else {
      const key = section === 'header' ? 'headerRows' : 'footerRows';
      const rows = [...getTableRows(section)];
      const grid = buildLogicalGrid(rows, tableComp.columns.length);
      for (const rowId of selectedCells.rowIds) {
        const ri = rows.findIndex((r) => r.id === rowId);
        if (ri === -1) continue;
        const physMap = physToLogical(grid, ri, rows[ri].cells.length);
        const newCells = [...rows[ri].cells];
        for (let p = 0; p < newCells.length; p++) {
          if (selectedCells.cellIndices.includes(physMap[p])) {
            newCells[p] = { ...newCells[p], align };
          }
        }
        rows[ri] = { ...rows[ri], cells: newCells };
      }
      updateComponent(tableComp.id, { [key]: rows } as any);
    }
  };

  const handleTableInsertRow = () => {
    if (!selectedCells || !tableComp) return;
    const section = selectedCells.section as 'header' | 'data' | 'footer';
    const key =
      section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
    const rows = getTableRows(section);
    const lastRowId = selectedCells.rowIds[selectedCells.rowIds.length - 1];
    const index = rows.findIndex((r) => r.id === lastRowId);
    const newRows = insertStructuredRow(rows, index, tableComp.columns.length, section as any);
    updateComponent(tableComp.id, { [key]: newRows } as any);
  };

  const handleTableInsertCol = () => {
    if (!selectedCells || !tableComp) return;
    const lastColIdx = selectedCells.cellIndices[selectedCells.cellIndices.length - 1];
    const updates = insertColumn(tableComp, lastColIdx);
    updateComponent(tableComp.id, updates as any);
  };

  const handleTableDeleteSelection = () => {
    if (!selectedCells || !tableComp) return;
    if (
      updateSelectedTableCells((cell) => ({
        ...cell,
        content: '',
        fill: undefined,
        style: undefined,
      }))
    ) {
      return;
    }

    const { section, cellIndices } = selectedCells as any;
    if (section !== 'data') return;
    const newCols = tableComp.columns.map((col, idx) =>
      cellIndices.includes(idx) ? { ...col, header: '', field: '' } : col
    );
    updateComponent(tableComp.id, { columns: newCols } as any);
  };

  // ─── Scrubber (x-position drag) ────────────────────────────────────────
  const handleScrubberPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    startCompXRef.current = component.x || 0;

    const handleMove = (ev: PointerEvent) => {
      const deltaMm = LayoutEngine.pxToMm((ev.clientX - startXRef.current) / zoom);
      updateComponent(
        component.id,
        { x: Math.max(0, Math.round(startCompXRef.current + deltaMm)) },
        true
      );
    };
    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      const deltaMm = LayoutEngine.pxToMm((ev.clientX - startXRef.current) / zoom);
      updateComponent(component.id, {
        x: Math.max(0, Math.round(startCompXRef.current + deltaMm)),
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const isVisible = isSelected && !isDragging && selectedCount === 1;
  if (!isVisible) return null;

  const isNearTop = (component.y || 0) < 20;

  return (
    <FloatingToolbar
      className={clsx(
        'absolute -right-2 z-[1000] transition-all duration-200',
        isNearTop ? 'top-full mt-2' : '-top-14'
      )}
      style={{
        transform: `scale(${Math.min(1.2, 1 / zoom)})`,
        transformOrigin: isNearTop ? 'top right' : 'bottom right',
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Grip */}
      {!flowMode && (
        <div className="flex items-center px-1 text-zinc-500 cursor-move border-r border-white/10">
          <GripHorizontal className="w-3.5 h-3.5" />
        </div>
      )}

      {/* Arrangement / Flow Controls */}
      <div className="flex items-center gap-0.5 px-0.5 border-r border-white/10">
        {flowMode ? (
          <>
            <FloatingToolbarButton
              icon={ChevronLeft}
              title="Indent Left 5mm"
              onClick={(e) => handleFlowIndentLeft?.(e)}
            />
            <div
              className="px-1.5 py-0.5 mx-0.5 rounded bg-white/10 hover:bg-white/20 cursor-ew-resize transition-colors"
              onPointerDown={handleScrubberPointerDown}
              title="Drag left/right to adjust"
            >
              <span className="text-[9px] text-white/90 font-mono leading-none select-none">
                ←{Math.round(component.x || 0)}mm
              </span>
            </div>
            <FloatingToolbarButton
              icon={ChevronRight}
              title="Indent Right 5mm"
              onClick={(e) => handleFlowIndentRight?.(e)}
            />
            <ToolbarSeparator tone="dark" />
            <FloatingToolbarButton
              icon={ChevronUp}
              title="Move Up"
              onClick={() => moveDown(component.id)}
            />
            <FloatingToolbarButton
              icon={ChevronDown}
              title="Move Down"
              onClick={() => moveUp(component.id)}
            />
          </>
        ) : (
          <>
            <FloatingToolbarButton
              icon={ChevronsUp}
              title="Bring to Front"
              onClick={() => bringToFront(component.id)}
            />
            <FloatingToolbarButton
              icon={ChevronUp}
              title="Bring Forward"
              onClick={() => moveUp(component.id)}
            />
            <FloatingToolbarButton
              icon={ChevronDown}
              title="Send Backward"
              onClick={() => moveDown(component.id)}
            />
            <FloatingToolbarButton
              icon={ChevronsDown}
              title="Send to Back"
              onClick={() => sendToBack(component.id)}
            />
          </>
        )}
      </div>

      {/* Duplicate */}
      <div className="flex items-center gap-0.5 px-0.5 border-r border-white/10">
        <FloatingToolbarButton icon={Copy} title="Duplicate" onClick={handleDuplicate} />
      </div>

      {/* Delete component */}
      <div
        className={clsx('flex items-center px-0.5', isTableWithCells && 'border-r border-white/10')}
      >
        <FloatingToolbarButton
          icon={Trash2}
          title="Delete Component"
          onClick={() => {
            if (selectedCount > 1)
              removeComponents(useDesignerStore.getState().selectedComponentIds);
            else removeComponent(component.id);
          }}
          className="hover:bg-red-500/20 text-red-500/70 hover:text-red-400"
        />
      </div>

      {/* ─── Table cell actions ─── */}
      {isTableWithCells && tableComp && (
        <>
          {/* Merge / Split */}
          <div className="flex items-center gap-0.5 px-0.5 border-r border-white/10">
            <FloatingToolbarButton
              icon={Merge}
              title="Merge Cells"
              onClick={handleTableMerge}
              disabled={!isMultiCellSelected}
              className="text-violet-400 hover:text-violet-300 disabled:opacity-30"
            />
            <FloatingToolbarButton
              icon={Split}
              title="Split Cell"
              onClick={handleTableSplit}
              disabled={isMultiCellSelected}
              className="text-violet-400 hover:text-violet-300 disabled:opacity-30"
            />
          </div>

          {/* Align */}
          <div className="flex items-center gap-0.5 px-0.5 border-r border-white/10">
            <FloatingToolbarButton
              icon={AlignLeft}
              title="Align Left"
              onClick={() => handleTableAlign('left')}
            />
            <FloatingToolbarButton
              icon={AlignCenter}
              title="Align Center"
              onClick={() => handleTableAlign('center')}
            />
            <FloatingToolbarButton
              icon={AlignRight}
              title="Align Right"
              onClick={() => handleTableAlign('right')}
            />
          </div>

          {/* Insert Row / Col */}
          <div className="flex items-center gap-0.5 px-0.5 border-r border-white/10">
            <FloatingToolbarButton
              icon={Rows3}
              title="Insert Row Below"
              onClick={handleTableInsertRow}
              className="text-emerald-400 hover:text-emerald-300"
              badge={<Plus className="w-2 h-2 absolute -top-0.5 -right-0.5 text-emerald-400" />}
            />
            <FloatingToolbarButton
              icon={Columns2}
              title="Insert Column Right"
              onClick={handleTableInsertCol}
              className="text-emerald-400 hover:text-emerald-300"
              badge={<Plus className="w-2 h-2 absolute -top-0.5 -right-0.5 text-emerald-400" />}
            />
          </div>

          {/* Delete cells/rows */}
          <div className="flex items-center px-0.5">
            <FloatingToolbarButton
              icon={Trash2}
              title="Delete Selection"
              onClick={handleTableDeleteSelection}
              className="hover:bg-red-500/20 text-red-400/80 hover:text-red-400"
            />
          </div>
        </>
      )}
    </FloatingToolbar>
  );
});
