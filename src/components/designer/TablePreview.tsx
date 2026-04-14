'use client';

import type { TableComponent } from '@/types/schema';
import { useDesignerStore } from '@/store/designer-store';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { clsx } from 'clsx';
import React, { useState } from 'react';

interface Props {
  component: TableComponent;
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

  // Tracks for span tracking
  const coveredHeader = new Set<number>();

  return (
    <div className="w-full h-full bg-white flex flex-col border border-slate-300 shadow-sm overflow-hidden select-none">
      <div
        className="grid border-b border-slate-300"
        style={{
          display: 'grid',
          gridTemplateColumns,
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

      {/* Mock Data Rows */}
      <div
        className="grid flex-1 overflow-hidden"
        style={{ display: 'grid', gridTemplateColumns }}
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

                return (
                  <div
                    key={`${row}-${col.id}`}
                    className="p-2 border-r border-b border-slate-100 flex items-center relative group"
                    style={{
                      gridColumn: `${x + 1} / span ${cs}`,
                      backgroundColor:
                        row % 2 === 0 ? component.style?.alternateRowBackground || 'white' : 'white',
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
    </div>
  );
}
