'use client';

import { DesignerInput } from '@/components/shared/DesignerInput';
import type { FormTableComponent, FormTableFooterSummaryRow } from '@/types/schema';
import { Plus, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { CollapsibleSection, PropertyRow } from './Shared';

interface Props {
  component: FormTableComponent;
  onUpdate: (updates: Partial<FormTableComponent>) => void;
}

export function FormTableProperties({ component, onUpdate }: Props) {
  const summary = component.footerSummary ?? [];

  const updateRow = (idx: number, updates: Partial<FormTableFooterSummaryRow>) => {
    const next = [...summary];
    next[idx] = { ...next[idx], ...updates };
    onUpdate({ footerSummary: next });
  };

  const addRow = () => {
    onUpdate({
      footerSummary: [
        ...summary,
        {
          id: nanoid(),
          label: 'รวมทั้งสิ้น',
          value: '{{sum(items, "amount")}}',
          align: 'right',
          format: 'number',
          labelColumn: Math.max(0, component.columns.length - 2),
          valueColumn: Math.max(0, component.columns.length - 1),
        },
      ],
    });
  };

  const removeRow = (idx: number) => {
    onUpdate({ footerSummary: summary.filter((_, i) => i !== idx) });
  };

  return (
    <>
      <CollapsibleSection label="Form Table">
        <PropertyRow label="Footer mode">
          <button
            type="button"
            onClick={() =>
              onUpdate({ footerMode: component.footerMode === 'bottom' ? 'flow' : 'bottom' })
            }
            className="w-full h-7 px-2 rounded border border-(--border-default) bg-(--bg-surface) text-[9px] font-bold uppercase tracking-wider text-(--text-secondary) hover:border-(--accent)/40 transition-colors"
          >
            {component.footerMode === 'bottom' ? 'Bottom' : 'Flow'}
          </button>
        </PropertyRow>
        <PropertyRow label="Body min height">
          <DesignerInput
            variant="mini"
            value={component.bodyMinHeight ?? ''}
            onChange={(v) => onUpdate({ bodyMinHeight: v || undefined })}
            placeholder="95mm"
            mono
          />
        </PropertyRow>
        <PropertyRow label="Min rows">
          <DesignerInput
            type="number"
            variant="mini"
            value={String(component.minRows ?? 0)}
            onChange={(v) => onUpdate({ minRows: Number.parseInt(v, 10) || 0 })}
            mono
          />
        </PropertyRow>
        <p className="text-[8px] text-[var(--text-muted)] opacity-60 px-1 leading-relaxed">
          Pads empty rows when data has fewer items — keeps fixed form height.
          Use bottom mode + body height for PO/PR forms with a large blank body area.
        </p>
      </CollapsibleSection>

      <CollapsibleSection label="Footer Summary">
        <div className="flex items-center justify-between py-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">
            Rows ({summary.length})
          </span>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded transition-colors uppercase tracking-wider"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
        <div className="space-y-1">
          {summary.map((row, idx) => (
            <div
              key={row.id}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded p-2 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold text-[var(--text-muted)]">#{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="p-0.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <DesignerInput
                variant="mini"
                value={row.label}
                onChange={(v) => updateRow(idx, { label: v })}
                placeholder="Label"
              />
              <DesignerInput
                variant="mini"
                value={row.value}
                onChange={(v) => updateRow(idx, { value: v })}
                placeholder="{{sum(...)}}"
                mono
              />
              <div className="grid grid-cols-2 gap-1">
                <DesignerInput
                  type="number"
                  variant="mini"
                  value={String(row.labelColumn ?? 0)}
                  onChange={(v) => updateRow(idx, { labelColumn: Number.parseInt(v, 10) || 0 })}
                  placeholder="Label col"
                  mono
                />
                <DesignerInput
                  type="number"
                  variant="mini"
                  value={String(row.valueColumn ?? component.columns.length - 1)}
                  onChange={(v) =>
                    updateRow(idx, { valueColumn: Number.parseInt(v, 10) || 0 })
                  }
                  placeholder="Value col"
                  mono
                />
                <DesignerInput
                  type="number"
                  variant="mini"
                  value={String(row.labelColspan ?? row.valueColumn ?? component.columns.length - 1)}
                  onChange={(v) =>
                    updateRow(idx, { labelColspan: Number.parseInt(v, 10) || 1 })
                  }
                  placeholder="Label span"
                  mono
                />
                <DesignerInput
                  type="number"
                  variant="mini"
                  value={String(row.valueColspan ?? 1)}
                  onChange={(v) =>
                    updateRow(idx, { valueColspan: Number.parseInt(v, 10) || 1 })
                  }
                  placeholder="Value span"
                  mono
                />
              </div>
              <DesignerInput
                variant="mini"
                value={row.height ?? ''}
                onChange={(v) => updateRow(idx, { height: v || undefined })}
                placeholder="Row height e.g. 6mm"
                mono
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </>
  );
}
