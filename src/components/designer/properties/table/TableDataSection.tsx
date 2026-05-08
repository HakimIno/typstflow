import { getApplicableFormats } from '@/lib/utils/formatters';
import { getValueType } from '@/lib/utils/json-path';
import { useDesignerStore } from '@/store/designer-store';
import type { TableComponent } from '@/types/schema';
import { Minus, Plus } from 'lucide-react';
import { PropertyRow, SectionHeader } from '../Shared';
import { MiniInput } from './TableShared';
import { DesignerToggle } from '@/components/shared/DesignerToggle';

interface Props {
  component: TableComponent;
}

export const TableDataSection = ({ component }: Props) => {
  const sampleData = useDesignerStore((state) => state.sampleData);
  const updateComponent = useDesignerStore((state) => state.updateComponent);

  const updateColumn = (idx: number, updates: Record<string, any>) => {
    const newCols = [...component.columns];
    newCols[idx] = { ...newCols[idx], ...updates };
    updateComponent(component.id, { columns: newCols } as any);
  };

  return (
    <div className="bg-[var(--bg-widget)]">
      <section>
        <SectionHeader label="Batch Processing" />
        <PropertyRow label="Repeat Header">
          <DesignerToggle
            value={component.repeatHeaderOnPage}
            onChange={(v) => updateComponent(component.id, { repeatHeaderOnPage: v })}
          />
        </PropertyRow>
      </section>

      <section>
        <SectionHeader label="Column Mapping" />
        <div className="space-y-0">
          {component.columns.map((col, idx) => (
            <div key={col.id} className="flex items-center gap-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded p-1.5 shadow-sm">
              <span className="text-[9px] font-bold text-[var(--text-secondary)] w-16 truncate">{col.header || `Col ${idx + 1}`}</span>
              <MiniInput
                value={col.field || ''}
                onChange={(v) => updateColumn(idx, { field: v })}
                placeholder="path.to.field"
                mono
                className="flex-1 h-6"
              />
              <select
                value={col.format || 'text'}
                onChange={(e) => updateColumn(idx, { format: e.target.value })}
                className="text-[9px] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-1 h-6 outline-none text-[var(--text-primary)]"
              >
                {(() => {
                  const dataType = col.field ? getValueType(sampleData, col.field) : 'string';
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
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ));
                })()}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader label="Summary Totals" />
        <div className="space-y-1">
          {(component.summaryRows || []).map((row, idx) => (
            <div key={idx} className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded p-1.5 shadow-sm">
              <MiniInput
                value={row.label}
                onChange={(v) => {
                  const rows = [...(component.summaryRows || [])];
                  rows[idx].label = v;
                  updateComponent(component.id, { summaryRows: rows } as any);
                }}
                placeholder="Label"
                className="w-20 h-6"
              />
              <MiniInput
                value={row.value}
                onChange={(v) => {
                  const rows = [...(component.summaryRows || [])];
                  rows[idx].value = v;
                  updateComponent(component.id, { summaryRows: rows } as any);
                }}
                placeholder="{{total}}"
                mono
                className="flex-1 h-6"
              />
              <button
                onClick={() => {
                  const rows = (component.summaryRows || []).filter((_, i) => i !== idx);
                  updateComponent(component.id, { summaryRows: rows } as any);
                }}
                className="p-1 text-red-500 hover:bg-red-500/10 rounded"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const rows = [...(component.summaryRows || []), { label: '', value: '', separator: false }];
              updateComponent(component.id, { summaryRows: rows } as any);
            }}
            className="w-full py-1 text-[9px] font-bold border border-dashed border-[var(--border-default)] rounded text-[var(--text-muted)] flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add Summary
          </button>
        </div>
      </section>
    </div>
  );
};
