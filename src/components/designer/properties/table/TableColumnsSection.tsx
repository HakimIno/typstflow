import { useDesignerStore } from '@/store/designer-store';
import type { TableComponent } from '@/types/schema';
import { clsx } from 'clsx';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { ColorPicker } from '../../../shared/ColorPicker';
import { MiniInput } from './TableShared';

interface Props {
  component: TableComponent;
}

export const TableColumnsSection = ({ component }: Props) => {
  const [expandedColIndex, setExpandedColIndex] = useState<number | null>(null);
  const updateComponent = useDesignerStore((state) => state.updateComponent);

  const updateColumn = (idx: number, updates: Record<string, any>) => {
    const newCols = [...component.columns];
    newCols[idx] = { ...newCols[idx], ...updates };
    updateComponent(component.id, { columns: newCols } as any);
  };

  const addColumn = () => {
    const newCols = [
      ...component.columns,
      {
        id: crypto.randomUUID(),
        header: 'New Column',
        field: '',
        width: 'auto',
      },
    ];
    updateComponent(component.id, { columns: newCols } as any);
    setExpandedColIndex(newCols.length - 1);
  };

  return (
    <div className="p-2 space-y-1 bg-[var(--bg-widget)]">
      {component.columns.map((col, idx) => (
        <div
          key={col.id}
          className="flex flex-col bg-[var(--bg-surface)] border border-[var(--border-default)] rounded shadow-sm group/col overflow-hidden"
        >
          {/* Compact row */}
          <div
            className={clsx(
              'w-full flex items-center gap-2 p-1.5 cursor-pointer transition-colors border-0 text-left',
              expandedColIndex === idx ? 'bg-[var(--accent-glow)]' : 'hover:bg-[var(--bg-hover)]'
            )}
            onClick={() => setExpandedColIndex(expandedColIndex === idx ? null : idx)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setExpandedColIndex(expandedColIndex === idx ? null : idx);
              }
            }}
            role="button"
            tabIndex={0}
            aria-expanded={expandedColIndex === idx}
          >
            <span className="w-4 h-4 flex items-center justify-center bg-[var(--bg-widget)] text-[8px] font-bold text-[var(--text-muted)] rounded-full shrink-0">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                {col.header || 'Untitled'}
              </span>
              <span className="text-[8px] text-[var(--text-muted)] font-mono truncate">
                {col.field ? `{${col.field}}` : 'unbound'}
              </span>
            </div>
            <span className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-widget)] px-1 py-0.5 rounded border border-[var(--border-default)]">
              {col.width}
            </span>
            {expandedColIndex === idx ? (
              <ChevronDown className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
            )}
            <button
              type="button"
              className="p-1 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 rounded opacity-0 group-hover/col:opacity-100 transition-all shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                const newCols = component.columns.filter((_, i) => i !== idx);
                updateComponent(component.id, { columns: newCols } as any);
              }}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Expanded */}
          {expandedColIndex === idx && (
            <div className="p-2 bg-[var(--bg-widget)] border-t border-[var(--border-default)] space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                    Header
                  </span>
                  <MiniInput
                    value={col.header || ''}
                    onChange={(v) => updateColumn(idx, { header: v })}
                    placeholder="Column Header"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                    Field Binding
                  </span>
                  <MiniInput
                    value={col.field || ''}
                    onChange={(v) => updateColumn(idx, { field: v })}
                    placeholder="e.g. qty"
                    mono
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-0.5 min-w-[60px]">
                  <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                    Width
                  </span>
                  <MiniInput
                    value={col.width}
                    onChange={(v) => updateColumn(idx, { width: v })}
                    className="w-full"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                    Colspan
                  </span>
                  <MiniInput
                    type="number"
                    value={col.colspan || 1}
                    onChange={(v) =>
                      updateColumn(idx, { colspan: Math.max(1, Number.parseInt(v) || 1) })
                    }
                    className="w-10 text-center"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                   <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">Align</span>
                   <div className="flex border border-[var(--border-default)] rounded overflow-hidden">
                    {[
                      { id: 'left', Icon: AlignLeft },
                      { id: 'center', Icon: AlignCenter },
                      { id: 'right', Icon: AlignRight },
                    ].map(({ id, Icon }) => (
                      <button
                        type="button"
                        key={id}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateColumn(idx, { align: id });
                        }}
                        className={clsx(
                          'p-0.5 transition-all',
                          (col.align || 'left') === id
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                        )}
                      >
                        <Icon className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--border-default)]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">Cell BG</span>
                  <ColorPicker
                    color={col.background || '#ffffff'}
                    onChange={(color) => updateColumn(idx, { background: color })}
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">Border</span>
                  <MiniInput
                    value={col.borderWidth || ''}
                    onChange={(v) => updateColumn(idx, { borderWidth: v })}
                    placeholder="0.5pt"
                    mono
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addColumn}
        className="w-full flex items-center justify-center gap-1.5 p-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-[var(--accent)] text-[10px] font-bold rounded border border-dashed border-[var(--border-default)] transition-all"
      >
        <Plus className="w-3 h-3" />
        Add New Column
      </button>
    </div>
  );
};
