'use client';

import type { TableComponent, TableRow, TableCell } from '@/types/schema';
import { useDesignerStore } from '@/store/designer-store';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { clsx } from 'clsx';
import React, { useState, useMemo, useCallback } from 'react';
import { TableActionToolbar } from './TableActionToolbar';
import { mergeStructuredCells, insertStructuredRow, insertColumn } from '@/lib/utils/table-utils';
import { Plus, Trash2 } from 'lucide-react';

/** 
 * A specialized input component that uses local state for typing (to prevent lag)
 * and only saves to the global store onBlur or Enter.
 */
function InlineCellInput({
  initialValue,
  onSave,
  className,
  style,
  placeholder,
  title
}: {
  initialValue: string;
  onSave: (val: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  title?: string;
}) {
  const [val, setVal] = useState(initialValue);

  // Sync state if initialValue changes externally (e.g. undo/redo)
  React.useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

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
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
    />
  );
}

interface Props {
  component: TableComponent;
}

/** Compute the cell background color based on fill pattern config */
function getCellFill(
  component: TableComponent,
  x: number,
  y: number,
  isHeader: boolean,
  isFooter: boolean
): string | undefined {
  const style = component.style || {};
  const pattern = style.fillPattern || 'header-only';

  if (isHeader) return style.headerBackground || '#e2e8f0';
  if (isFooter) return style.headerBackground ? `${style.headerBackground}22` : '#f1f5f920';

  switch (pattern) {
    case 'none':
      return undefined;
    case 'header-only':
      return undefined;
    case 'striped-rows':
      return y % 2 === 0
        ? style.stripedColor1 || style.alternateRowBackground || '#f8fafc'
        : style.stripedColor2 || '#ffffff';
    case 'striped-cols':
      return x % 2 === 0
        ? style.stripedColor1 || '#f8fafc'
        : style.stripedColor2 || '#ffffff';
    case 'checkerboard':
      return (x + y) % 2 === 0
        ? style.stripedColor1 || '#f8fafc'
        : style.stripedColor2 || '#ffffff';
    default:
      return y % 2 === 0
        ? style.alternateRowBackground || 'white'
        : 'white';
  }
}

export function TablePreview({ component }: Props) {
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const selectedCell = useDesignerStore((state) => state.selectedCell);
  const selectedCells = useDesignerStore((state) => state.selectedCells);
  const setSelectedCell = useDesignerStore((state) => state.setSelectedCell);
  const setSelectedCells = useDesignerStore((state) => state.setSelectedCells);
  
  const [resizingColIndex, setResizingColIndex] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ rowId: string, cellIdx: number, section: any } | null>(null);

  const handleResizeStart = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColIndex(index);

    const startX = e.clientX;
    const columns = [...component.columns];
    const initialWidths = columns.map((col) => {
      if (col.width.endsWith('mm')) return parseFloat(col.width);
      return 40;
    });

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (resizingColIndex === null) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaMm = LayoutEngine.pxToMm(deltaX);

      const newWidths = [...initialWidths];
      newWidths[index] = Math.max(5, initialWidths[index] + deltaMm);

      const updatedCols = columns.map((col, i) => ({
        ...col,
        width: `${newWidths[i]}mm`,
      }));

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

  // Use standard physical tracks (one per column definition)
  const gridTemplateColumns = component.columns
    .map((col) => {
      if (col.width.includes('mm')) return `${LayoutEngine.mmToPx(parseFloat(col.width))}px`;
      if (col.width.includes('fr')) return col.width;
      return '1fr';
    })
    .join(' ');

  // Gutter
  const colGap = component.style?.columnGutter ? '2px' : '0px';
  const rowGap = component.style?.rowGutter ? '2px' : '0px';

  // Border style
  const borderColor = component.style?.borderColor || '#cbd5e1';
  const borderWidth = '1px';

  // Tracks for span tracking
  const coveredHeader = new Set<number>();

  // Header rows
  const headerRows = component.headerRows || [];
  const footerRows = component.footerRows || [];
  const hasStructuredHeaders = headerRows.length > 0;

  // --- SELECTION HELPERS ---
  const isCellSelected = (section: any, rowId: string, cellIdx: number) => {
    if (!selectedCells || selectedCells.tableId !== component.id || selectedCells.section !== section) return false;
    return selectedCells.rowIds.includes(rowId) && selectedCells.cellIndices.includes(cellIdx);
  };

  const handleCellMouseDown = (section: any, rowId: string, cellIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSelecting(true);
    setSelectionStart({ rowId, cellIdx, section });
    setSelectedCell({ tableId: component.id, section, rowId, cellIdx });
  };

  const handleCellMouseEnter = (section: any, rowId: string, cellIdx: number) => {
    if (!isSelecting || !selectionStart || selectionStart.section !== section) return;

    const sectionKey = section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
    const rows = component[sectionKey] || [];
    
    const startRowIdx = rows.findIndex(r => r.id === selectionStart.rowId);
    const endRowIdx = rows.findIndex(r => r.id === rowId);
    
    const minRow = Math.min(startRowIdx, endRowIdx);
    const maxRow = Math.max(startRowIdx, endRowIdx);
    const minCol = Math.min(selectionStart.cellIdx, cellIdx);
    const maxCol = Math.max(selectionStart.cellIdx, cellIdx);
    
    const rowIds: string[] = [];
    for (let i = minRow; i <= maxRow; i++) rowIds.push(rows[i].id);
    
    const cellIndices: number[] = [];
    for (let i = minCol; i <= maxCol; i++) cellIndices.push(i);
    
    setSelectedCells({
      tableId: component.id,
      section,
      rowIds,
      cellIndices
    });
  };

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
  }, []);

  React.useEffect(() => {
    if (isSelecting) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isSelecting, handleMouseUp]);

  const handleMerge = () => {
    if (!selectedCells) return;
    const sectionKey = selectedCells.section === 'header' ? 'headerRows' : selectedCells.section === 'footer' ? 'footerRows' : 'detailRows';
    const rows = component[sectionKey] || [];
    
    // Find numeric indices for rows
    const rowIndices = selectedCells.rowIds.map(id => rows.findIndex(r => r.id === id)).sort((a,b) => a-b);
    const colIndices = [...selectedCells.cellIndices].sort((a,b) => a-b);
    
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
    const sectionKey = section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
    const rows = [...(component[sectionKey] || [])];
    const rowIdx = rows.findIndex(r => r.id === rowId);
    if (rowIdx === -1) return;
    
    const cell = rows[rowIdx].cells[cellIdx];
    if (!cell || (!cell.colspan && !cell.rowspan)) return;
    
    // Restore cells (Simplified: just reset target cell and we might need to add missing cells)
    // In a real implementation, we'd need to re-insert the removed TableCell objects.
    const newCells = [...rows[rowIdx].cells];
    const currentColspan = cell.colspan || 1;
    newCells[cellIdx] = { ...cell, colspan: 1, rowspan: 1 };
    
    // Add dummy cells back
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
       // Legacy: Delete columns
       const newCols = component.columns.filter((_, idx) => !cellIndices.includes(idx));
       updateComponent(component.id, { columns: newCols } as any);
    } else {
       const sectionKey = section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
       const rows = component[sectionKey] || [];
       const newRows = rows.filter(r => !rowIds.includes(r.id));
       updateComponent(component.id, { [sectionKey]: newRows } as any);
    }
    setSelectedCell(null);
  };

  const handleInsertRow = () => {
    if (!selectedCells) return;
    const sectionKey = selectedCells.section === 'header' ? 'headerRows' : selectedCells.section === 'footer' ? 'footerRows' : 'detailRows';
    const rows = component[sectionKey] || [];
    const lastRowId = selectedCells.rowIds[selectedCells.rowIds.length - 1];
    const index = rows.findIndex(r => r.id === lastRowId);
    
    const newRows = insertStructuredRow(rows, index, component.columns.length, selectedCells.section as any);
    updateComponent(component.id, { [sectionKey]: newRows } as any);
  };

  const handleInsertCol = () => {
    if (!selectedCells) return;
    const lastColIdx = selectedCells.cellIndices[selectedCells.cellIndices.length - 1];
    const updates = insertColumn(component, lastColIdx);
    updateComponent(component.id, updates as any);
  };

  return (
    <div className="w-full h-full bg-white flex flex-col border border-slate-300 shadow-sm overflow-hidden select-none relative">
      {/* TOOLBAR */}
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
      {/* ---- HEADER SECTION ---- */}
      {hasStructuredHeaders ? (
        // Multi-row structured headers
        <div className="border-b border-slate-300">
          {headerRows.map((row, rowIdx) => (
            <div
              key={row.id}
              className="grid"
              style={{
                display: 'grid',
                gridTemplateColumns,
                columnGap: colGap,
                backgroundColor: component.style?.headerBackground || '#e2e8f0',
                borderBottom: rowIdx < headerRows.length - 1 ? `1px solid ${borderColor}` : undefined,
              }}
            >
              {row.cells.map((cell, cellIdx) => (
                <div
                  key={cell.id}
                  onMouseDown={(e) => handleCellMouseDown('header', row.id, cellIdx, e)}
                  onMouseEnter={() => handleCellMouseEnter('header', row.id, cellIdx)}
                  className={clsx(
                    "relative flex items-center justify-center p-2 border-r border-slate-300 last:border-r-0 overflow-hidden group/cell transition-all cursor-cell",
                    isCellSelected('header', row.id, cellIdx)
                      ? "ring-2 ring-blue-500 ring-inset bg-blue-50/30 z-10"
                      : "hover:bg-slate-50/50"
                  )}
                  style={{
                    gridColumn: cell.colspan ? `span ${cell.colspan}` : undefined,
                    gridRow: cell.rowspan ? `span ${cell.rowspan}` : undefined,
                    minHeight: '28px',
                    backgroundColor: cell.fill || undefined,
                  }}
                >
                  <InlineCellInput
                    className="w-full bg-transparent border-none focus:ring-0 text-center text-[10px] font-bold text-slate-700 outline-none placeholder:text-slate-400 opacity-80 group-hover/cell:opacity-100"
                    initialValue={cell.content || ''}
                    placeholder=""
                    onSave={(newVal) => {
                      if (newVal === cell.content) return;
                      const newRows = [...headerRows];
                      const newCells = [...newRows[rowIdx].cells];
                      newCells[cellIdx] = { ...cell, content: newVal };
                      newRows[rowIdx] = { ...newRows[rowIdx], cells: newCells };
                      updateComponent(component.id, { headerRows: newRows } as any);
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        // Legacy single-row header from columns
        <div
          className="grid border-b border-slate-300"
          style={{
            display: 'grid',
            gridTemplateColumns,
            columnGap: colGap,
            backgroundColor: component.style?.headerBackground || '#f1f5f9',
          }}
        >
          {component.columns.map((col, x) => {
            if (coveredHeader.has(x)) return null;
            const cs = col.colspan || 1;
            const rs = col.rowspan || 1;
            for (let i = 1; i < cs; i++) coveredHeader.add(x + i);

            return (
              <div
                key={col.id}
                className="relative flex items-center justify-center p-2 border-r border-slate-300 last:border-r-0 overflow-hidden group/cell"
                style={{
                  gridColumn: `${x + 1} / span ${cs}`,
                  gridRow: `span ${rs}`,
                  minHeight: '32px',
                }}
              >
                {/* Inline Header Edit */}
                <InlineCellInput
                  className="w-full bg-transparent border-none focus:ring-0 text-center text-[10px] font-black uppercase tracking-tight text-slate-700 outline-none placeholder:text-slate-300 opacity-90"
                  initialValue={col.header || ''}
                  placeholder="COLUMN"
                  onSave={(newVal) => {
                    if (newVal === col.header) return;
                    const newCols = [...component.columns];
                    newCols[x] = { ...col, header: newVal };
                    updateComponent(component.id, { columns: newCols } as any);
                  }}
                />

                {/* Resize Handle */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, x)}
                  className={clsx(
                    'absolute top-0 right-0 w-1 h-full cursor-col-resize z-10 transition-colors',
                    resizingColIndex === x ? 'bg-blue-500' : 'hover:bg-blue-300'
                  )}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ---- DATA ROWS ---- */}
      {component.detailRows && component.detailRows.length > 0 ? (
        <div className="flex-1 overflow-hidden" style={{ backgroundColor: 'white' }}>
          <div className={clsx(
            "relative group/template",
            !component.isStatic && "border-b border-slate-300 border-dashed mb-0.5"
          )}>
            {/* Label to indicate this is a template */}
            {!component.isStatic && (
              <div className="absolute -left-5 top-2 -rotate-90 text-[8px] font-bold text-slate-400 uppercase tracking-widest pointer-events-none opacity-50 group-hover/template:opacity-100 whitespace-nowrap">
                 Template
              </div>
            )}
            {component.detailRows.map((row, rowIdx) => (
              <div
                key={row.id}
                className="grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns,
                  columnGap: colGap,
                  backgroundColor: getCellFill(component, 0, 0, false, false) || 'white',
                  borderBottom: rowIdx < component.detailRows!.length - 1 ? `1px solid ${borderColor}` : undefined,
                }}
              >
                {row.cells.map((cell, cellIdx) => (
                  <div
                    key={cell.id}
                    onMouseDown={(e) => handleCellMouseDown('data', row.id, cellIdx, e)}
                    onMouseEnter={() => handleCellMouseEnter('data', row.id, cellIdx)}
                    className={clsx(
                      "relative flex items-center p-2 border-r border-slate-300 last:border-r-0 overflow-hidden group/cell transition-all cursor-cell",
                      isCellSelected('data', row.id, cellIdx)
                        ? "ring-2 ring-blue-500 ring-inset bg-blue-50/30 z-10"
                        : "hover:bg-slate-50/20"
                    )}
                    style={{
                      gridColumn: cell.colspan ? `span ${cell.colspan}` : undefined,
                      gridRow: cell.rowspan ? `span ${cell.rowspan}` : undefined,
                      minHeight: '28px',
                      backgroundColor: cell.fill || undefined,
                      justifyContent: cell.align === 'center' ? 'center' : cell.align === 'right' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <InlineCellInput
                      className={clsx(
                        "w-full bg-transparent border-none focus:ring-0 text-[10px] font-mono outline-none placeholder:text-slate-300",
                        cell.fill ? "text-white" : "text-slate-600"
                      )}
                      style={{
                        textAlign: cell.align === 'center' ? 'center' : cell.align === 'right' ? 'right' : 'left',
                      }}
                      initialValue={cell.content || ''}
                      placeholder="{{binding}}"
                      onSave={(newVal) => {
                        if (newVal === cell.content) return;
                        const newRows = [...component.detailRows!];
                        const newCells = [...newRows[rowIdx].cells];
                        newCells[cellIdx] = { ...cell, content: newVal };
                        newRows[rowIdx] = { ...newRows[rowIdx], cells: newCells };
                        updateComponent(component.id, { detailRows: newRows } as any);
                      }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Skeleton to indicate loop */}
          {!component.isStatic && (
            <div className="h-6 flex flex-col gap-1.5 mt-2 ml-4">
               <div className="w-2/3 h-1.5 bg-slate-200 rounded-full opacity-50 mix-blend-multiply" />
               <div className="w-1/2 h-1.5 bg-slate-200 rounded-full opacity-30 mix-blend-multiply" />
            </div>
          )}
        </div>
      ) : (
        <div
          className="grid flex-1 overflow-hidden"
          style={{ display: 'grid', gridTemplateColumns, columnGap: colGap, rowGap }}
        >
          {[1, 2, 3].map((row) => {
            const coveredRow = new Set<number>();
            return (
              <div
                key={row}
                className="contents"
              >
                {component.columns.map((col, x) => {
                  if (coveredRow.has(x)) return null;
                  const cs = col.colspan || 1;
                  for (let i = 1; i < cs; i++) coveredRow.add(x + i);
  
                  const cellBg = getCellFill(component, x, row, false, false);
  
                  return (
                    <div
                      key={`${row}-${col.id}`}
                      className="p-2 border-r border-b flex items-center relative group/cell"
                      style={{
                        gridColumn: `${x + 1} / span ${cs}`,
                        backgroundColor: cellBg || (col.background || 'white'),
                        borderColor,
                        justifyContent:
                          col.align === 'center'
                            ? 'center'
                            : col.align === 'right'
                              ? 'flex-end'
                              : 'flex-start',
                      }}
                    >
                      {row === 1 ? (
                        <div className="w-full flex items-center">
                          <InlineCellInput
                            className="w-full bg-transparent border-none text-[10px] text-slate-500 outline-none placeholder:text-slate-200 transition-colors pointer-events-auto"
                            style={{
                              textAlign: col.align === 'center' ? 'center' : col.align === 'right' ? 'right' : 'left',
                              fontFamily: 'monospace',
                            }}
                            initialValue={col.field ? `{{${col.field}}}` : ''}
                            placeholder="{...}"
                            title="Data Binding"
                            onSave={(newVal) => {
                              let val = newVal.replace(/[{}]/g, '');
                              if (val === col.field) return;
                              const newCols = [...component.columns];
                              newCols[x] = { ...col, field: val };
                              updateComponent(component.id, { columns: newCols } as any);
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-1.5 bg-slate-200 rounded-full w-2/3 opacity-30 mix-blend-multiply" />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ---- FOOTER SECTION ---- */}
      {footerRows.length > 0 && (
        <div className="border-t border-slate-400">
          {footerRows.map((row, rowIdx) => (
            <div
              key={row.id}
              className="grid"
              style={{
                display: 'grid',
                gridTemplateColumns,
                columnGap: colGap,
                backgroundColor: getCellFill(component, 0, 0, false, true) || '#f8fafc',
                borderBottom: rowIdx < footerRows.length - 1 ? `1px solid ${borderColor}` : undefined,
              }}
            >
              {row.cells.map((cell, cellIdx) => (
                <div
                  key={cell.id}
                  onMouseDown={(e) => handleCellMouseDown('footer', row.id, cellIdx, e)}
                  onMouseEnter={() => handleCellMouseEnter('footer', row.id, cellIdx)}
                  className={clsx(
                    "relative flex items-center p-2 border-r border-slate-300 last:border-r-0 overflow-hidden group/cell transition-all cursor-cell",
                    isCellSelected('footer', row.id, cellIdx)
                      ? "ring-2 ring-blue-500 ring-inset bg-blue-50/30 z-10"
                      : "hover:bg-slate-50/20"
                  )}
                  style={{
                    gridColumn: cell.colspan ? `span ${cell.colspan}` : undefined,
                    minHeight: '28px',
                    backgroundColor: cell.fill || undefined,
                    justifyContent: cell.align === 'center' ? 'center' : cell.align === 'right' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <InlineCellInput
                    className={clsx(
                      "w-full bg-transparent border-none focus:ring-0 text-[10px] font-bold outline-none placeholder:text-slate-300",
                      cell.fill ? "text-white" : "text-slate-600"
                    )}
                    style={{
                      textAlign: cell.align === 'center' ? 'center' : cell.align === 'right' ? 'right' : 'left',
                    }}
                    initialValue={cell.content || ''}
                    placeholder=""
                    onSave={(newVal) => {
                      if (newVal === cell.content) return;
                      const newRows = [...footerRows];
                      const newCells = [...newRows[rowIdx].cells];
                      newCells[cellIdx] = { ...cell, content: newVal };
                      newRows[rowIdx] = { ...newRows[rowIdx], cells: newCells };
                      updateComponent(component.id, { footerRows: newRows } as any);
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ---- HLINE / VLINE OVERLAY (visual indicators) ---- */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* VLines Overlay */}
        {(component.vlines || []).map((vl) => {
          // Calculate X position based on column widths
          let offsetMm = 0;
          for(let i=0; i < vl.x; i++) {
             const col = component.columns[i];
             if (col) offsetMm += parseFloat(col.width || '20');
          }
          return (
            <div
              key={vl.id}
              className="absolute top-0 bottom-0 w-px border-l border-blue-400 border-dashed opacity-40"
              style={{ left: `${LayoutEngine.mmToPx(offsetMm)}px` }}
            />
          );
        })}
      </div>
    </div>
  );
}
