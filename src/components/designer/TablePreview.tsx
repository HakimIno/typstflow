'use client';

import type { TableComponent } from '@/types/schema';
import { useDesignerStore } from '@/store/designer-store';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { clsx } from 'clsx';
import { useState } from 'react';

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
    const initialWidths = columns.map(col => {
        if (col.width.endsWith('mm')) return parseFloat(col.width);
        // Fallback or handle proportional widths
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
        width: `${newWidths[i]}mm`
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

  return (
    <div className="w-full h-full bg-white flex flex-col border border-slate-300 shadow-sm overflow-hidden select-none">
      {/* Header Row */}
      <div 
        className="flex border-b border-slate-300"
        style={{ backgroundColor: component.style?.headerBackground || '#f1f5f9' }}
      >
        {component.columns.map((col, i) => (
          <div
            key={col.id}
            className="relative flex items-center justify-center p-2 border-r border-slate-300 last:border-r-0 overflow-hidden"
            style={{ 
                width: col.width.includes('mm') ? `${LayoutEngine.mmToPx(parseFloat(col.width))}px` : 'auto',
                flex: col.width.includes('fr') ? parseFloat(col.width) : 'none',
                minWidth: '20px'
            }}
          >
            <span className="text-[10px] font-bold text-slate-700 truncate">
              {col.header}
            </span>
            
            {/* Resize Handle */}
            <div
              onMouseDown={(e) => handleResizeStart(e, i)}
              className={clsx(
                "absolute top-0 right-0 w-1 h-full cursor-col-resize z-10 transition-colors",
                resizingColIndex === i ? "bg-blue-500" : "hover:bg-blue-300"
              )}
            />
          </div>
        ))}
      </div>

      {/* Mock Data Rows */}
      {[1, 2, 3].map((row) => (
        <div 
          key={row} 
          className="flex border-b border-slate-100 last:border-0"
          style={{ backgroundColor: row % 2 === 0 ? (component.style?.alternateRowBackground || 'white') : 'white' }}
        >
          {component.columns.map((col) => (
            <div
              key={col.id}
              className="p-2 border-r border-slate-100 last:border-r-0 flex items-center"
              style={{ 
                width: col.width.includes('mm') ? `${LayoutEngine.mmToPx(parseFloat(col.width))}px` : 'auto',
                flex: col.width.includes('fr') ? parseFloat(col.width) : 'none',
                justifyContent: col.align === 'center' ? 'center' : col.align === 'right' ? 'flex-end' : 'flex-start'
              }}
            >
              <div className="h-1.5 bg-slate-200 rounded-full w-2/3 animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
