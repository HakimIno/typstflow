import { useDesignerStore } from '@/store/designer-store';
import type { TableComponent, TableRow } from '@/types/schema';
import { clsx } from 'clsx';
import {
  ChevronDown,
  ChevronRight,
  Merge,
  Plus,
  Split,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { MiniInput } from './TableShared';

interface Props {
  component: TableComponent;
  type: 'header' | 'detail' | 'footer';
}

export const TableRowsSection = ({ component, type }: Props) => {
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);
  const updateComponent = useDesignerStore((state) => state.updateComponent);

  const rows = type === 'header' ? component.headerRows : type === 'detail' ? component.detailRows : component.footerRows;
  const rowKey = type === 'header' ? 'headerRows' : type === 'detail' ? 'detailRows' : 'footerRows';

  const updateRows = (newRows: TableRow[]) => {
    updateComponent(component.id, { [rowKey]: newRows } as any);
  };

  const addRow = () => {
    const newRow: TableRow = {
      id: crypto.randomUUID(),
      type: type === 'detail' ? 'data' : (type as 'header' | 'footer'),
      cells: Array(component.columns.length).fill(null).map(() => ({
        id: crypto.randomUUID(),
        content: '',
      })),
    };
    const currentRows = rows || [];
    updateRows([...currentRows, newRow]);
    setExpandedRowIndex(currentRows.length);
  };

  if (!rows || rows.length === 0) {
    return (
      <div className="p-4 text-center space-y-3">
        <p className="text-[10px] text-[var(--text-muted)]">No custom {type} rows defined.</p>
        <button
          type="button"
          onClick={addRow}
          className="px-4 py-1.5 bg-[var(--accent)] text-white text-[10px] font-bold rounded shadow-sm hover:bg-[var(--accent)]/90 transition-all"
        >
          Initialize {type} Rows
        </button>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1 bg-[var(--bg-widget)]">
      {rows.map((row, rIdx) => (
        <div key={row.id} className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded overflow-hidden">
          <div 
            className="flex items-center gap-2 p-1.5 cursor-pointer hover:bg-white/[0.02]"
            onClick={() => setExpandedRowIndex(expandedRowIndex === rIdx ? null : rIdx)}
          >
             <span className="text-[9px] font-bold text-[var(--text-muted)] w-10 uppercase">Row {rIdx + 1}</span>
             <div className="flex-1 flex gap-1 overflow-hidden">
                {row.cells.map((cell, cIdx) => (
                  <div 
                    key={cell.id} 
                    className="h-4 flex-1 bg-white/[0.04] rounded border border-white/[0.05] text-[7px] flex items-center justify-center truncate px-0.5"
                  >
                    {cell.content || '-'}
                  </div>
                ))}
             </div>
             {expandedRowIndex === rIdx ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </div>

          {expandedRowIndex === rIdx && (
            <div className="p-2 space-y-3 border-t border-[var(--border-default)] bg-black/10">
               {row.cells.map((cell, cIdx) => (
                 <div key={cell.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                       <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Cell {cIdx + 1}</span>
                       <div className="flex gap-1">
                          <button className="p-1 hover:bg-white/10 rounded"><Merge className="w-3 h-3" /></button>
                          <button className="p-1 hover:bg-white/10 rounded"><Split className="w-3 h-3" /></button>
                       </div>
                    </div>
                    <MiniInput 
                      value={cell.content || ''}
                      onChange={(v) => {
                        const newRows = [...rows];
                        newRows[rIdx].cells[cIdx].content = v;
                        updateRows(newRows);
                      }}
                      placeholder="Cell content..."
                    />
                 </div>
               ))}
               <button
                 type="button"
                 onClick={() => {
                   const newRows = rows.filter((_, i) => i !== rIdx);
                   updateRows(newRows);
                 }}
                 className="w-full mt-2 py-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[9px] font-bold rounded border border-red-500/20 transition-all"
               >
                 Remove Row {rIdx + 1}
               </button>
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="w-full mt-2 flex items-center justify-center gap-1.5 p-1.5 bg-white/[0.02] border border-dashed border-[var(--border-default)] text-[var(--text-muted)] text-[9px] font-bold rounded"
      >
        <Plus className="w-3 h-3" />
        Add Row
      </button>
    </div>
  );
};
