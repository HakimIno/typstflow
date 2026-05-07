'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { insertColumn, insertStructuredRow, mergeStructuredCells } from '@/lib/utils/table-utils';
import { type TableResolutionResult, tableEngine } from '@/lib/wasm-table-engine';
import { useDesignerStore } from '@/store/designer-store';
import type { TableComponent, TableRow } from '@/types/schema';
import { clsx } from 'clsx';
import React, { useState, useCallback, useEffect } from 'react';
import { TableActionToolbar } from './TableActionToolbar';

function InlineCellInput({
  initialValue,
  onSave,
  className,
  style,
  placeholder,
  title,
}: {
  initialValue: string;
  onSave: (val: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  title?: string;
}) {
  const [val, setVal] = useState(initialValue);
  React.useEffect(() => setVal(initialValue), [initialValue]);

  return (
    <input
      className={className}
      style={style}
      value={val}
      placeholder={placeholder}
      title={title}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

interface Props {
  component: TableComponent;
}

export function TablePreview({ component }: Props) {
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const selectedCell = useDesignerStore((state) => state.selectedCell);
  const selectedCells = useDesignerStore((state) => state.selectedCells);
  const setSelectedCell = useDesignerStore((state) => state.setSelectedCell);
  const setSelectedCells = useDesignerStore((state) => state.setSelectedCells);

  const [resizingColIndex, setResizingColIndex] = useState<number | null>(null);
  const [resizingRowInfo, setResizingRowInfo] = useState<{ section: string; index: number } | null>(
    null
  );
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{
    rowId: string;
    cellIdx: number;
    section: any;
  } | null>(null);

  const [resolvedLayout, setResolvedLayout] = useState<TableResolutionResult | null>(null);

  useEffect(() => {
    tableEngine.initWasm().then(() => {
      let engineInput = component;
      // Synthesize for legacy tables
      if (!engineInput.headerRows || engineInput.headerRows.length === 0) {
        engineInput = {
          ...engineInput,
          headerRows: [
            {
              id: 'synthetic-header',
              type: 'header',
              cells: engineInput.columns.map((c) => ({
                id: c.id,
                content: c.header,
                align: c.align || 'left',
              })),
            },
          ],
          detailRows: engineInput.detailRows || [
            {
              id: 'synthetic-detail',
              type: 'data',
              cells: engineInput.columns.map((c) => ({
                id: `detail-${c.id}`,
                content: c.field ? `{{${c.field}}}` : '',
                align: c.align || 'left',
              })),
            },
          ],
        };
      }
      const pageHeightMm = 297; // A4 height for now
      const res = tableEngine.resolve(engineInput, pageHeightMm, 0);
      setResolvedLayout(res);
    });
  }, [component]);

  const handleColResizeStart = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColIndex(index);
    const startX = e.clientX;
    const columns = [...component.columns];
    const initialWidths = columns.map((col) => {
      if (col.width.endsWith('mm')) return Number.parseFloat(col.width);
      return LayoutEngine.pxToMm(40);
    });
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (resizingColIndex === null) return;
      const deltaX = moveEvent.clientX - startX;
      const zoom = Number.parseFloat(
        document.querySelector('[data-paper-container]')?.getAttribute('data-zoom') || '1'
      );
      const deltaMm = LayoutEngine.pxToMm(deltaX / zoom);
      const newWidths = [...initialWidths];
      newWidths[index] = Math.max(5, initialWidths[index] + deltaMm);
      const updatedCols = columns.map((col, i) => ({ ...col, width: `${newWidths[i]}mm` }));
      updateComponent(component.id, { columns: updatedCols } as any);
    };
    const onMouseUp = () => {
      setResizingColIndex(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleRowResizeStart = (e: React.MouseEvent, sectionKey: string, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingRowInfo({ section: sectionKey, index });
    const startY = e.clientY;
    const rows = [...((component[sectionKey as keyof TableComponent] as TableRow[]) || [])];
    if (rows.length === 0) return;

    let initialHeightMm = LayoutEngine.pxToMm(28);
    const initialHeightStr = rows[index].height;
    if (initialHeightStr?.endsWith('mm')) {
      initialHeightMm = Number.parseFloat(initialHeightStr);
    }
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const zoom = Number.parseFloat(
        document.querySelector('[data-paper-container]')?.getAttribute('data-zoom') || '1'
      );
      const deltaMm = LayoutEngine.pxToMm(deltaY / zoom);
      const newHeightMm = Math.max(2, initialHeightMm + deltaMm);
      const newRows = [...rows];
      newRows[index] = { ...newRows[index], height: `${newHeightMm}mm` };
      updateComponent(component.id, { [sectionKey]: newRows } as any);
    };
    const onMouseUp = () => {
      setResizingRowInfo(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const isCellSelected = (section: any, rowId: string, cellIdx: number) => {
    if (
      !selectedCells ||
      selectedCells.tableId !== component.id ||
      selectedCells.section !== section
    )
      return false;
    return selectedCells.rowIds.includes(rowId) && selectedCells.cellIndices.includes(cellIdx);
  };

  const handleCellMouseDown = (
    section: any,
    rowId: string,
    cellIdx: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setIsSelecting(true);
    setSelectionStart({ rowId, cellIdx, section });
    setSelectedCell({ tableId: component.id, section, rowId, cellIdx });
  };

  const handleCellMouseEnter = (section: any, rowId: string, cellIdx: number) => {
    if (!isSelecting || !selectionStart || selectionStart.section !== section) return;
    const sectionKey =
      section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
    const rows = component[sectionKey] || [];
    const startRowIdx = rows.findIndex((r) => r.id === selectionStart.rowId);
    const endRowIdx = rows.findIndex((r) => r.id === rowId);
    if (startRowIdx === -1 || endRowIdx === -1) return;
    const minRow = Math.min(startRowIdx, endRowIdx);
    const maxRow = Math.max(startRowIdx, endRowIdx);
    const minCol = Math.min(selectionStart.cellIdx, cellIdx);
    const maxCol = Math.max(selectionStart.cellIdx, cellIdx);

    const rowIds: string[] = [];
    for (let i = minRow; i <= maxRow; i++) rowIds.push(rows[i].id);
    const cellIndices: number[] = [];
    for (let i = minCol; i <= maxCol; i++) cellIndices.push(i);

    setSelectedCells({ tableId: component.id, section, rowIds, cellIndices });
  };

  const handleMouseUp = useCallback(() => setIsSelecting(false), []);
  React.useEffect(() => {
    if (isSelecting) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isSelecting, handleMouseUp]);

  const handleMerge = () => {
    if (!selectedCells) return;
    const sectionKey =
      selectedCells.section === 'header'
        ? 'headerRows'
        : selectedCells.section === 'footer'
          ? 'footerRows'
          : 'detailRows';
    const rows = component[sectionKey] || [];
    const rowIndices = selectedCells.rowIds
      .map((id) => rows.findIndex((r) => r.id === id))
      .sort((a, b) => a - b);
    const colIndices = [...selectedCells.cellIndices].sort((a, b) => a - b);
    const newRows = mergeStructuredCells(
      rows,
      rowIndices[0],
      rowIndices[rowIndices.length - 1],
      colIndices[0],
      colIndices[colIndices.length - 1]
    );
    updateComponent(component.id, { [sectionKey]: newRows } as any);
    setSelectedCell(null);
  };

  const handleSplit = () => {
    if (!selectedCell) return;
    const { section, rowId, cellIdx } = selectedCell;
    const sectionKey =
      section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
    const rows = [...(component[sectionKey] || [])];
    const rowIdx = rows.findIndex((r) => r.id === rowId);
    if (rowIdx === -1) return;
    const cell = rows[rowIdx].cells[cellIdx];
    if (!cell || (!cell.colspan && !cell.rowspan)) return;
    const newCells = [...rows[rowIdx].cells];
    const currentColspan = cell.colspan || 1;
    newCells[cellIdx] = { ...cell, colspan: 1, rowspan: 1 };
    for (let i = 1; i < currentColspan; i++) {
      newCells.splice(cellIdx + i, 0, { id: `restore-${Math.random()}`, content: '' });
    }
    rows[rowIdx] = { ...rows[rowIdx], cells: newCells };
    updateComponent(component.id, { [sectionKey]: rows } as any);
  };

  const handleDelete = () => {
    if (!selectedCells) return;
    const { section, rowIds, cellIndices } = selectedCells;
    if (section === 'data' && !component.detailRows) {
      const newCols = component.columns.filter((_, idx) => !cellIndices.includes(idx));
      updateComponent(component.id, { columns: newCols } as any);
    } else {
      const sectionKey =
        section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
      const rows = component[sectionKey] || [];
      const newRows = rows.filter((r) => !rowIds.includes(r.id));
      updateComponent(component.id, { [sectionKey]: newRows } as any);
    }
    setSelectedCell(null);
  };

  const handleInsertRow = () => {
    if (!selectedCells) return;
    const sectionKey =
      selectedCells.section === 'header'
        ? 'headerRows'
        : selectedCells.section === 'footer'
          ? 'footerRows'
          : 'detailRows';
    const rows = component[sectionKey] || [];
    const lastRowId = selectedCells.rowIds[selectedCells.rowIds.length - 1];
    const index = rows.findIndex((r) => r.id === lastRowId);
    const newRows = insertStructuredRow(
      rows,
      index,
      component.columns.length,
      selectedCells.section as any
    );
    updateComponent(component.id, { [sectionKey]: newRows } as any);
  };

  const handleInsertCol = () => {
    if (!selectedCells) return;
    const lastColIdx = selectedCells.cellIndices[selectedCells.cellIndices.length - 1];
    const updates = insertColumn(component, lastColIdx);
    updateComponent(component.id, updates as any);
  };

  if (!resolvedLayout) {
    return (
      <div className="w-full h-[60px] bg-slate-50 border border-slate-200 animate-pulse flex items-center justify-center text-xs text-slate-400">
        Loading Grid Resolution...
      </div>
    );
  }

  const borderColor = component.style?.borderColor || '#cbd5e1';

  return (
    <div
      className="w-full bg-white border border-slate-200 shadow-sm relative overflow-hidden"
      style={{ height: `${LayoutEngine.mmToPx(resolvedLayout.total_height)}px` }}
    >
      {selectedCells?.tableId === component.id && (
        <TableActionToolbar
          component={component}
          selectedCells={selectedCells}
          onMerge={handleMerge}
          onSplit={handleSplit}
          onDelete={handleDelete}
          onInsertRow={handleInsertRow}
          onInsertCol={handleInsertCol}
        />
      )}

      {/* RENDER ABSOLUTE CELLS FROM WASM */}
      {resolvedLayout.cells.map((cell) => {
        const isHeader = cell.section === 'header';
        const isSelected = isCellSelected(cell.section, cell.row_id, cell.col_idx);
        const sectionKey =
          cell.section === 'header'
            ? 'headerRows'
            : cell.section === 'footer'
              ? 'footerRows'
              : 'detailRows';
        const rows = component[sectionKey] || [];
        const rowIdx = rows.findIndex((r) => r.id === cell.row_id);
        const isResizingCol = resizingColIndex === cell.col_idx + cell.colspan - 1;
        const isResizingRow =
          resizingRowInfo?.section === sectionKey && resizingRowInfo?.index === rowIdx;

        return (
          <div
            key={`${cell.section}-${cell.row_id}-${cell.col_idx}-${cell.page_index}`}
            onMouseDown={(e) => handleCellMouseDown(cell.section, cell.row_id, cell.col_idx, e)}
            onMouseEnter={() => handleCellMouseEnter(cell.section, cell.row_id, cell.col_idx)}
            className={clsx(
              'absolute flex items-center p-2 border-r border-b overflow-hidden group/cell transition-colors cursor-cell',
              isSelected
                ? 'ring-2 ring-[var(--accent)] ring-inset bg-blue-50/50 z-10'
                : 'hover:bg-slate-50/50'
            )}
            style={{
              left: `${LayoutEngine.mmToPx(cell.x - (component.x || 0))}px`,
              top: `${LayoutEngine.mmToPx(cell.y)}px`,
              width: `${LayoutEngine.mmToPx(cell.width)}px`,
              height: `${LayoutEngine.mmToPx(cell.height)}px`,
              backgroundColor:
                cell.fill ||
                (isHeader ? component.style?.headerBackground || '#f1f5f9' : 'transparent'),
              borderColor: borderColor,
              justifyContent:
                cell.align === 'center'
                  ? 'center'
                  : cell.align === 'right'
                    ? 'flex-end'
                    : 'flex-start',
            }}
          >
            <InlineCellInput
              className={clsx(
                'w-full bg-transparent border-none focus:ring-0 outline-none placeholder:text-slate-300',
                isHeader
                  ? 'text-[10px] font-bold text-slate-700 opacity-80 group-hover/cell:opacity-100'
                  : 'text-[10px] font-mono text-slate-600',
                cell.fill && !isHeader ? 'text-white' : ''
              )}
              style={{
                textAlign:
                  cell.align === 'center' ? 'center' : cell.align === 'right' ? 'right' : 'left',
              }}
              initialValue={cell.content || ''}
              placeholder={isHeader ? '' : '{{binding}}'}
              onSave={(newVal) => {
                if (newVal === cell.content) return;
                // Legacy support
                if (!component[sectionKey] || component[sectionKey]?.length === 0) {
                  if (isHeader) {
                    const newCols = [...component.columns];
                    if (newCols[cell.col_idx]) newCols[cell.col_idx].header = newVal;
                    updateComponent(component.id, { columns: newCols } as any);
                  } else {
                    const newCols = [...component.columns];
                    const fieldVal = newVal.replace(/[{}]/g, '');
                    if (newCols[cell.col_idx]) newCols[cell.col_idx].field = fieldVal;
                    updateComponent(component.id, { columns: newCols } as any);
                  }
                  return;
                }

                const newRows = [...rows];
                if (rowIdx === -1) return;
                const newCells = [...newRows[rowIdx].cells];
                const cellIndexToUpdate = newCells.findIndex((c) => c.id === cell.id);
                if (cellIndexToUpdate === -1) return;

                newCells[cellIndexToUpdate] = { ...newCells[cellIndexToUpdate], content: newVal };
                newRows[rowIdx] = { ...newRows[rowIdx], cells: newCells };
                updateComponent(component.id, { [sectionKey]: newRows } as any);
              }}
            />

            {/* Right Resize Handle */}
            <div
              onMouseDown={(e) => handleColResizeStart(e, cell.col_idx + cell.colspan - 1)}
              className={clsx(
                'absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-20 transition-colors',
                isResizingCol
                  ? 'bg-[var(--accent)]'
                  : 'hover:bg-[var(--accent)] opacity-0 hover:opacity-100'
              )}
            />

            {/* Bottom Resize Handle */}
            {rowIdx !== -1 && (
              <div
                onMouseDown={(e) => handleRowResizeStart(e, sectionKey, rowIdx)}
                className={clsx(
                  'absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize z-20 transition-colors',
                  isResizingRow
                    ? 'bg-[var(--accent)]'
                    : 'hover:bg-[var(--accent)] opacity-0 hover:opacity-100'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
