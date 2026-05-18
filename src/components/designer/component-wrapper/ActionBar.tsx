'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { buildLogicalGrid, physToLogical } from '@/lib/utils/table-grid';
import { insertColumn, insertStructuredRow, mergeStructuredCells } from '@/lib/utils/table-utils';
import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode, TableComponent, TableRow } from '@/types/schema';
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
    const { section, rowIds, cellIndices } = selectedCells as any;
    if (section === 'data' && !tableComp.detailRows?.length) {
      const newCols = tableComp.columns.filter((_, idx) => !cellIndices.includes(idx));
      updateComponent(tableComp.id, { columns: newCols } as any);
    } else {
      const key =
        section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
      const rows = getTableRows(section as 'header' | 'data' | 'footer');
      const newRows = rows.filter((r) => !rowIds.includes(r.id));
      updateComponent(tableComp.id, { [key]: newRows } as any);
    }
    setSelectedCell(null);
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
    <div
      className={clsx(
        'absolute -right-2 flex items-center gap-0.5 bg-black backdrop-blur-md p-1 z-[1000] border border-white/10 shadow-2xl transition-all duration-200',
        isNearTop ? 'top-full mt-2' : '-top-14'
      )}
      style={{
        transform: `scale(${Math.min(1.2, 1 / zoom)})`,
        transformOrigin: isNearTop ? 'top right' : 'bottom right',
        borderRadius: '12px',
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
            <ActionButton
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
            <ActionButton
              icon={ChevronRight}
              title="Indent Right 5mm"
              onClick={(e) => handleFlowIndentRight?.(e)}
            />
            <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
            <ActionButton icon={ChevronUp} title="Move Up" onClick={() => moveDown(component.id)} />
            <ActionButton
              icon={ChevronDown}
              title="Move Down"
              onClick={() => moveUp(component.id)}
            />
          </>
        ) : (
          <>
            <ActionButton
              icon={ChevronsUp}
              title="Bring to Front"
              onClick={() => bringToFront(component.id)}
            />
            <ActionButton
              icon={ChevronUp}
              title="Bring Forward"
              onClick={() => moveUp(component.id)}
            />
            <ActionButton
              icon={ChevronDown}
              title="Send Backward"
              onClick={() => moveDown(component.id)}
            />
            <ActionButton
              icon={ChevronsDown}
              title="Send to Back"
              onClick={() => sendToBack(component.id)}
            />
          </>
        )}
      </div>

      {/* Duplicate */}
      <div className="flex items-center gap-0.5 px-0.5 border-r border-white/10">
        <ActionButton icon={Copy} title="Duplicate" onClick={handleDuplicate} />
      </div>

      {/* Delete component */}
      <div
        className={clsx('flex items-center px-0.5', isTableWithCells && 'border-r border-white/10')}
      >
        <ActionButton
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
            <ActionButton
              icon={Merge}
              title="Merge Cells"
              onClick={handleTableMerge}
              disabled={!isMultiCellSelected}
              className="text-violet-400 hover:text-violet-300 disabled:opacity-30"
            />
            <ActionButton
              icon={Split}
              title="Split Cell"
              onClick={handleTableSplit}
              disabled={isMultiCellSelected}
              className="text-violet-400 hover:text-violet-300 disabled:opacity-30"
            />
          </div>

          {/* Align */}
          <div className="flex items-center gap-0.5 px-0.5 border-r border-white/10">
            <ActionButton
              icon={AlignLeft}
              title="Align Left"
              onClick={() => handleTableAlign('left')}
            />
            <ActionButton
              icon={AlignCenter}
              title="Align Center"
              onClick={() => handleTableAlign('center')}
            />
            <ActionButton
              icon={AlignRight}
              title="Align Right"
              onClick={() => handleTableAlign('right')}
            />
          </div>

          {/* Insert Row / Col */}
          <div className="flex items-center gap-0.5 px-0.5 border-r border-white/10">
            <ActionButton
              icon={Rows3}
              title="Insert Row Below"
              onClick={handleTableInsertRow}
              className="text-emerald-400 hover:text-emerald-300"
              badge={<Plus className="w-2 h-2 absolute -top-0.5 -right-0.5 text-emerald-400" />}
            />
            <ActionButton
              icon={Columns2}
              title="Insert Column Right"
              onClick={handleTableInsertCol}
              className="text-emerald-400 hover:text-emerald-300"
              badge={<Plus className="w-2 h-2 absolute -top-0.5 -right-0.5 text-emerald-400" />}
            />
          </div>

          {/* Delete cells/rows */}
          <div className="flex items-center px-0.5">
            <ActionButton
              icon={Trash2}
              title="Delete Selection"
              onClick={handleTableDeleteSelection}
              className="hover:bg-red-500/20 text-red-400/80 hover:text-red-400"
            />
          </div>
        </>
      )}
    </div>
  );
});

function ActionButton({
  icon: Icon,
  title,
  onClick,
  className,
  disabled,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  disabled?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick(e);
      }}
      className={clsx(
        'relative p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed',
        className
      )}
      title={title}
    >
      <Icon className="w-3.5 h-3.5" />
      {badge}
    </button>
  );
}
