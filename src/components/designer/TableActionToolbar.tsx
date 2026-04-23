'use client';

import { useDesignerStore } from '@/store/designer-store';
import { TableComponent } from '@/types/schema';
import { 
  Merge, 
  Split, 
  Trash2, 
  Plus, 
  Minus, 
  AlignCenter, 
  AlignLeft, 
  AlignRight,
  ChevronUp,
  ChevronDown,
  Columns,
  Rows
} from 'lucide-react';
import { clsx } from 'clsx';
import React from 'react';

interface Props {
  component: TableComponent;
  selectedCells: {
    tableId: string;
    section: 'header' | 'footer' | 'data';
    rowIds: string[];
    cellIndices: number[];
  };
  onMerge: () => void;
  onSplit: () => void;
  onDelete: () => void;
  onInsertRow: () => void;
  onInsertCol: () => void;
}

export function TableActionToolbar({ component, selectedCells, onMerge, onSplit, onDelete, onInsertRow, onInsertCol }: Props) {
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const isMulti = selectedCells.rowIds.length > 1 || selectedCells.cellIndices.length > 1;
  const isSingle = !isMulti;

  const handleAlign = (align: 'left' | 'center' | 'right') => {
    // Basic alignment update for selected cells
    // Logic depends on section
    if (selectedCells.section === 'header' || selectedCells.section === 'footer') {
      const sectionKey = selectedCells.section === 'header' ? 'headerRows' : 'footerRows';
      const rows = [...(component[sectionKey] || [])];
      
      selectedCells.rowIds.forEach(rowId => {
        const rowIdx = rows.findIndex(r => r.id === rowId);
        if (rowIdx !== -1) {
          const newCells = [...rows[rowIdx].cells];
          selectedCells.cellIndices.forEach(cellIdx => {
            if (newCells[cellIdx]) {
              newCells[cellIdx] = { ...newCells[cellIdx], align };
            }
          });
          rows[rowIdx] = { ...rows[rowIdx], cells: newCells };
        }
      });
      
      updateComponent(component.id, { [sectionKey]: rows } as any);
    } else {
      // Data section updates columns
      const newCols = [...component.columns];
      selectedCells.cellIndices.forEach(idx => {
        if (newCols[idx]) newCols[idx] = { ...newCols[idx], align };
      });
      updateComponent(component.id, { columns: newCols } as any);
    }
  };

  return (
    <div className="absolute -top-10 left-0 flex items-center gap-1 bg-white border border-slate-300 shadow-xl rounded-lg p-1 z-[100] animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1 mr-1">
        <button
          onClick={onMerge}
          disabled={!isMulti}
          className="p-1.5 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-md disabled:opacity-30 transition-colors flex flex-col items-center"
          title="Merge Selected Cells"
        >
          <Merge className="w-3.5 h-3.5" />
          <span className="text-[7px] font-bold uppercase mt-0.5">Merge</span>
        </button>
        <button
          onClick={onSplit}
          disabled={isMulti}
          className="p-1.5 hover:bg-orange-50 text-slate-600 hover:text-orange-600 rounded-md disabled:opacity-30 transition-colors flex flex-col items-center"
          title="Split Merged Cell"
        >
          <Split className="w-3.5 h-3.5" />
          <span className="text-[7px] font-bold uppercase mt-0.5">Split</span>
        </button>
      </div>

      <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1 mr-1">
        <button onClick={() => handleAlign('left')} className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-md">
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => handleAlign('center')} className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-md">
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => handleAlign('right')} className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-md">
          <AlignRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1 mr-1">
        <button 
           onClick={onInsertRow}
           className="p-1.5 hover:bg-green-50 text-green-600 rounded-md flex flex-col items-center"
           title="Insert Row Below"
        >
          <Rows className="w-3.5 h-3.5" />
          <Plus className="w-2 h-2 absolute translate-x-2 translate-y-1" />
          <span className="text-[7px] font-bold uppercase mt-0.5">Row</span>
        </button>
        <button 
          onClick={onInsertCol}
          className="p-1.5 hover:bg-green-50 text-green-600 rounded-md flex flex-col items-center"
          title="Insert Column Right"
        >
          <Columns className="w-3.5 h-3.5" />
          <Plus className="w-2 h-2 absolute translate-x-2 translate-y-1" />
          <span className="text-[7px] font-bold uppercase mt-0.5">Col</span>
        </button>
      </div>

      <button
        onClick={onDelete}
        className="p-1.5 hover:bg-red-50 text-red-500 rounded-md flex flex-col items-center"
        title="Delete Selection"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span className="text-[7px] font-bold uppercase mt-0.5">Delete</span>
      </button>
    </div>
  );
}
