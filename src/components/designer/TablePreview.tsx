'use client';

import type { TableComponent } from '@/types/schema';
import { useDesignerStore } from '@/store/designer-store';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { clsx } from 'clsx';
import React, { useState, useMemo } from 'react';

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
  const [resizingColIndex, setResizingColIndex] = useState<number | null>(null);

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

  return (
    <div className="w-full h-full bg-white flex flex-col border border-slate-300 shadow-sm overflow-hidden select-none">
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
                  className="relative flex items-center justify-center p-2 border-r border-slate-300 last:border-r-0 overflow-hidden"
                  style={{
                    gridColumn: cell.colspan ? `span ${cell.colspan}` : undefined,
                    gridRow: cell.rowspan ? `span ${cell.rowspan}` : undefined,
                    minHeight: '28px',
                    backgroundColor: cell.fill || undefined,
                  }}
                >
                  <input
                    className="w-full bg-transparent border-none focus:ring-0 text-center text-[10px] font-bold text-slate-700 outline-none placeholder:text-slate-400"
                    value={cell.content || ''}
                    placeholder={component.columns[cellIdx]?.header || `Col ${cellIdx + 1}`}
                    onChange={(e) => {
                      const newRows = [...headerRows];
                      const newCells = [...newRows[rowIdx].cells];
                      newCells[cellIdx] = { ...cell, content: e.target.value };
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
                className="relative flex items-center justify-center p-2 border-r border-slate-300 last:border-r-0 overflow-hidden"
                style={{
                  gridColumn: `${x + 1} / span ${cs}`,
                  gridRow: `span ${rs}`,
                  minHeight: '32px',
                }}
              >
                {/* Inline Header Edit */}
                <input
                  className="w-full bg-transparent border-none focus:ring-0 text-center text-[10px] font-bold text-slate-700 outline-none placeholder:text-slate-400"
                  value={col.header || ''}
                  placeholder="Header"
                  onChange={(e) => {
                    const newCols = [...component.columns];
                    newCols[x] = { ...col, header: e.target.value };
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
                    className="p-2 border-r border-b flex items-center relative group"
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
                      <div className="w-full flex items-center justify-center">
                        <span className="text-[9px] text-slate-400 font-mono mr-1 opacity-0 group-hover:opacity-100 transition-opacity select-none flex-shrink-0">
                          {`{`}
                        </span>
                        <input
                          className="w-full bg-transparent border-b border-transparent focus:border-blue-300 text-[10px] text-slate-600 outline-none placeholder:text-slate-300 transition-colors"
                          style={{
                            textAlign: col.align === 'center' ? 'center' : col.align === 'right' ? 'right' : 'left',
                          }}
                          value={col.field || ''}
                          placeholder="field"
                          title="Data Field Mapping"
                          onChange={(e) => {
                            const newCols = [...component.columns];
                            newCols[x] = { ...col, field: e.target.value };
                            updateComponent(component.id, { columns: newCols } as any);
                          }}
                        />
                        <span className="text-[9px] text-slate-400 font-mono ml-1 opacity-0 group-hover:opacity-100 transition-opacity select-none flex-shrink-0">
                          {`}`}
                        </span>
                      </div>
                    ) : (
                      <div className="h-1.5 bg-slate-200 rounded-full w-2/3 opacity-40 mix-blend-multiply" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ---- FOOTER SECTION ---- */}
      {footerRows.length > 0 && (
        <div className="border-t-2 border-slate-400">
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
                  className="relative flex items-center justify-center p-2 border-r border-slate-300 last:border-r-0 overflow-hidden"
                  style={{
                    gridColumn: cell.colspan ? `span ${cell.colspan}` : undefined,
                    minHeight: '28px',
                    backgroundColor: cell.fill || undefined,
                  }}
                >
                  <input
                    className="w-full bg-transparent border-none focus:ring-0 text-center text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-400"
                    value={cell.content || ''}
                    placeholder={`Footer ${cellIdx + 1}`}
                    onChange={(e) => {
                      const newRows = [...footerRows];
                      const newCells = [...newRows[rowIdx].cells];
                      newCells[cellIdx] = { ...cell, content: e.target.value };
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
      {(component.hlines || []).length > 0 && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
          {(component.hlines || []).map((hl) => (
            <div
              key={hl.id}
              className="absolute left-0 right-0 h-0 border-t-2 border-red-400 opacity-60"
              style={{ top: `${(hl.y + 1) * 32}px` }}
              title={`HLine y=${hl.y}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
