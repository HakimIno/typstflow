'use client';

import { useDesignerStore } from '@/store/designer-store';
import type { FormTableComponent, TableComponent } from '@/types/schema';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns2,
  Eraser,
  Merge,
  Pin,
  Repeat2,
  Rows3,
  Split,
  Trash2,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import {
  FloatingToolbar,
  FloatingToolbarButton,
  FloatingToolbarFlyout,
} from '../toolbar/FloatingToolbar';
import { ToolbarSeparator } from '../toolbar/ToolbarSeparator';
import { useTableActions } from './useTableActions';

interface TableToolbarProps {
  component: TableComponent | FormTableComponent;
}

function selectionLabel(rowCount: number, colCount: number): string {
  if (rowCount <= 0 || colCount <= 0) return 'Sheet';
  if (rowCount === 1 && colCount === 1) return '1 cell';
  return `${rowCount}x${colCount}`;
}

export const TableToolbar = memo(function TableToolbar({ component }: TableToolbarProps) {
  const updateComponent = useDesignerStore((s) => s.updateComponent);
  const selectedCell = useDesignerStore((s) =>
    s.selectedCell?.tableId === component.id ? s.selectedCell : null
  );
  const selectedCells = useDesignerStore((s) =>
    s.selectedCells?.tableId === component.id ? s.selectedCells : null
  );
  const setSelectedCell = useDesignerStore((s) => s.setSelectedCell);
  const setSelectedCells = useDesignerStore((s) => s.setSelectedCells);
  const zoom = useDesignerStore((s) => s.zoom);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    handleMerge,
    handleSplit,
    handleDeleteRows,
    handleDeleteColumns,
    handleClearContents,
    handleAlign,
    handleSetRowType,
    handleInsertRow,
    handleInsertCol,
    rowTypeState,
    canMerge,
    canSplit,
    canDeleteRow,
    canDeleteColumn,
    canClear,
  } = useTableActions(
    component,
    selectedCell,
    selectedCells,
    (id, updates) => updateComponent(id, updates as Partial<TableComponent | FormTableComponent>),
    setSelectedCell,
    setSelectedCells
  );

  const label = useMemo(
    () =>
      selectionLabel(
        selectedCells?.rowIds.length ?? (selectedCell ? 1 : 0),
        selectedCells?.cellIndices.length ?? (selectedCell ? 1 : 0)
      ),
    [selectedCell, selectedCells]
  );

  const isNearTop = (component.y || 0) < 20;

  return (
    <FloatingToolbar
      data-toolbar="true"
      className={`absolute left-1/2 z-[1100] transition-all duration-150 ${
        isNearTop ? 'top-full mt-2' : '-top-12'
      }`}
      style={{
        transform: `translateX(-50%) scale(${Math.min(1.2, 1 / zoom)})`,
        transformOrigin: isNearTop ? 'top center' : 'bottom center',
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex h-6 min-w-11 items-center justify-center rounded-md bg-white/10 px-2 text-[10px] font-medium tabular-nums text-white">
        {label}
      </div>

      <ToolbarSeparator tone="dark" />

      <FloatingToolbarButton
        icon={Merge}
        title="Merge cells"
        onClick={handleMerge}
        disabled={!canMerge}
      />
      <FloatingToolbarButton
        icon={Split}
        title="Split cell"
        onClick={handleSplit}
        disabled={!canSplit}
      />

      <ToolbarSeparator tone="dark" />

      <FloatingToolbarButton
        icon={AlignLeft}
        title="Align left"
        onClick={() => handleAlign('left')}
        disabled={!canClear}
      />
      <FloatingToolbarButton
        icon={AlignCenter}
        title="Align center"
        onClick={() => handleAlign('center')}
        disabled={!canClear}
      />
      <FloatingToolbarButton
        icon={AlignRight}
        title="Align right"
        onClick={() => handleAlign('right')}
        disabled={!canClear}
      />

      <ToolbarSeparator tone="dark" />

      <FloatingToolbarButton
        icon={Repeat2}
        title="Repeat with data — row loops per data item"
        onClick={() => handleSetRowType('data')}
        disabled={rowTypeState === null}
        active={rowTypeState === 'data'}
      />
      <FloatingToolbarButton
        icon={Pin}
        title="Static row — renders once, never repeats"
        onClick={() => handleSetRowType('static')}
        disabled={rowTypeState === null}
        active={rowTypeState === 'static'}
      />

      <ToolbarSeparator tone="dark" />

      <FloatingToolbarButton
        icon={Rows3}
        title="Insert row below"
        onClick={handleInsertRow}
        disabled={!selectedCells}
      />
      <FloatingToolbarButton
        icon={Columns2}
        title="Insert column right"
        onClick={handleInsertCol}
        disabled={!selectedCells}
      />

      <ToolbarSeparator tone="dark" />

      <FloatingToolbarButton
        icon={Eraser}
        title="Clear contents"
        onClick={handleClearContents}
        disabled={!canClear}
      />
      <FloatingToolbarFlyout icon={Trash2} isActive={deleteOpen} onHover={setDeleteOpen}>
        <div className="flex min-w-36 flex-col gap-0.5 p-1">
          <button
            type="button"
            disabled={!canDeleteRow}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteRows();
              setDeleteOpen(false);
            }}
            className="rounded-md px-2 py-1.5 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:text-zinc-600"
          >
            Delete row
          </button>
          <button
            type="button"
            disabled={!canDeleteColumn}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteColumns();
              setDeleteOpen(false);
            }}
            className="rounded-md px-2 py-1.5 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:text-zinc-600"
          >
            Delete column
          </button>
        </div>
      </FloatingToolbarFlyout>
    </FloatingToolbar>
  );
});
