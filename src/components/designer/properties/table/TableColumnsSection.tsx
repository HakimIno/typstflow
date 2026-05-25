import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { getApplicableFormats } from '@/lib/utils/formatters';
import { getValueType } from '@/lib/utils/json-path';
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
import { ControlField, PropertyGrid } from '../Shared';
import { MiniInput } from './TableShared';

interface Props {
  component: TableComponent;
}

export const TableColumnsSection = ({ component }: Props) => {
  const [expandedColIndex, setExpandedColIndex] = useState<number | null>(null);
  const sampleData = useDesignerStore((state) => state.sampleData);
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
    <div className="space-y-1 min-w-0">
      {component.columns.map((col, idx) => {
        return (
          <div
            key={col.id}
            className="flex flex-col bg-[var(--bg-surface)] border border-[var(--border-default)] rounded shadow-sm group/col overflow-hidden transition-all"
          >
            {/* Compact row */}
            <div className="w-full flex items-center pr-2 hover:bg-[var(--bg-hover)] transition-colors">
              <button
                type="button"
                className={clsx(
                  'flex-1 flex items-center gap-2 p-2 text-left transition-colors border-0',
                  expandedColIndex === idx && 'bg-[var(--accent-glow)]'
                )}
                onClick={() => setExpandedColIndex(expandedColIndex === idx ? null : idx)}
                aria-expanded={expandedColIndex === idx}
              >
                <span className="w-4 h-4 flex items-center justify-center bg-[var(--bg-widget)] text-[8px] font-bold text-[var(--text-muted)] rounded-full shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                    {col.header || 'Untitled'}
                  </span>
                  <span className="text-[8px] text-[var(--text-muted)] font-mono truncate mt-0.5">
                    {col.field ? `{${col.field}}` : 'unbound'}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-widget)] px-1 py-0.5 rounded border border-[var(--border-default)] shrink-0 mr-1">
                  {col.width}
                </span>
                {expandedColIndex === idx ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                )}
              </button>
              <button
                type="button"
                className="p-1 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 rounded opacity-0 group-hover/col:opacity-100 transition-all shrink-0 ml-0.5"
                onClick={() => {
                  const newCols = component.columns.filter((_, i) => i !== idx);
                  updateComponent(component.id, { columns: newCols } as any);
                }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {/* Expanded */}
            {expandedColIndex === idx && (
              <div className="p-2.5 bg-[var(--bg-widget)] border-t border-[var(--border-default)] space-y-3 animate-in fade-in duration-200">
                <PropertyGrid cols={2}>
                  <ControlField label="Header">
                    <MiniInput
                      value={col.header || ''}
                      onChange={(v) => updateColumn(idx, { header: v })}
                      placeholder="Column Header"
                    />
                  </ControlField>
                  <ControlField label="Field Binding">
                    <MiniInput
                      value={col.field || ''}
                      onChange={(v) => updateColumn(idx, { field: v })}
                      placeholder="e.g. qty"
                      mono
                    />
                  </ControlField>
                </PropertyGrid>

                <PropertyGrid cols={2}>
                  <ControlField label="Width">
                    <MiniInput
                      value={col.width}
                      onChange={(v) => updateColumn(idx, { width: v })}
                    />
                  </ControlField>
                  <ControlField label="Colspan">
                    <MiniInput
                      type="number"
                      value={col.colspan || 1}
                      onChange={(v) =>
                        updateColumn(idx, { colspan: Math.max(1, Number.parseInt(v) || 1) })
                      }
                    />
                  </ControlField>
                </PropertyGrid>

                <PropertyGrid cols={2}>
                  <ControlField label="Format">
                    <Select
                      value={col.format || 'text'}
                      onValueChange={(val) => updateColumn(idx, { format: val })}
                    >
                      <SelectTrigger className="h-6 text-[9px] bg-[var(--bg-surface)] border-[var(--border-default)] px-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const dataType = col.field
                            ? getValueType(sampleData, col.field)
                            : 'string';
                          const applicable = getApplicableFormats(dataType);
                          const options = [
                            { id: 'text', label: 'Text' },
                            { id: 'number', label: 'Number' },
                            { id: 'currency-thb', label: '฿ THB' },
                            { id: 'currency-usd', label: '$ USD' },
                            { id: 'percent', label: '%' },
                            { id: 'date-th', label: 'Date TH' },
                            { id: 'date-en', label: 'Date EN' },
                            { id: 'boolean', label: 'Bool' },
                          ];
                          return options
                            .filter((opt) => applicable.includes(opt.id as any))
                            .map((opt) => (
                              <SelectItem key={opt.id} value={opt.id} className="text-[9px]">
                                {opt.label}
                              </SelectItem>
                            ));
                        })()}
                      </SelectContent>
                    </Select>
                  </ControlField>
                  <ControlField label="Align">
                    <div className="flex border border-[var(--border-default)] rounded overflow-hidden h-6 w-full">
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
                            'flex-1 flex items-center justify-center transition-all',
                            (col.align || 'left') === id
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </ControlField>
                </PropertyGrid>

                <PropertyGrid cols={2}>
                  <ControlField label="Cell BG">
                    <ColorPicker
                      color={col.background || '#ffffff'}
                      onChange={(color) => updateColumn(idx, { background: color })}
                    />
                  </ControlField>
                  <ControlField label="Border">
                    <MiniInput
                      value={col.borderWidth || ''}
                      onChange={(v) => updateColumn(idx, { borderWidth: v })}
                      placeholder="0.5pt"
                      mono
                    />
                  </ControlField>
                </PropertyGrid>

                {component.autoGroupFooter && (
                  <div className="pt-2 border-t border-[var(--border-default)]/60 animate-in slide-in-from-top-1 duration-200">
                    <ControlField label="Footer Expr (Auto Group)">
                      <MiniInput
                        value={col.footerExpr || ''}
                        onChange={(v) => updateColumn(idx, { footerExpr: v })}
                        placeholder="{{SUM(...)}} or static text"
                        mono
                      />
                    </ControlField>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={addColumn}
        className="w-full flex items-center justify-center gap-1.5 p-1 bg-white/[0.04] hover:bg-white/[0.08] text-[var(--accent)] text-[10px] font-bold rounded border border-dashed border-[var(--border-default)] transition-all"
      >
        <Plus className="w-3 h-3" />
        Add New Column
      </button>
    </div>
  );
};
