'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { DesignerInput } from '@/components/shared/DesignerInput';
import type { FieldGridComponent, FormFieldDefinition } from '@/types/schema';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { CollapsibleSection, PropertyRow } from './Shared';

interface Props {
  component: FieldGridComponent;
  onUpdate: (updates: Partial<FieldGridComponent>) => void;
}

export function FieldGridProperties({ component, onUpdate }: Props) {
  const fields = component.fields ?? [];

  const updateField = (idx: number, updates: Partial<FormFieldDefinition>) => {
    const next = [...fields];
    next[idx] = { ...next[idx], ...updates };
    onUpdate({ fields: next });
  };

  const addField = () => {
    onUpdate({
      fields: [
        ...fields,
        {
          id: nanoid(),
          label: 'Label',
          value: '{{value}}',
          column: component.columns === 2 ? (fields.length % 2) as 0 | 1 : undefined,
        },
      ],
    });
  };

  const removeField = (idx: number) => {
    onUpdate({ fields: fields.filter((_, i) => i !== idx) });
  };

  return (
    <>
      <CollapsibleSection label="Grid Layout">
        <PropertyRow label="Columns">
          <Select
            value={String(component.columns ?? 1)}
            onValueChange={(v) => onUpdate({ columns: Number(v) as 1 | 2 })}
          >
            <SelectTrigger className="h-6 text-[10px] bg-[var(--bg-surface)] border-[var(--border-default)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 column</SelectItem>
              <SelectItem value="2">2 columns</SelectItem>
            </SelectContent>
          </Select>
        </PropertyRow>
        <PropertyRow label="Label width">
          <DesignerInput
            type="text"
            variant="mini"
            value={component.labelWidth ?? '28mm'}
            onChange={(v) => onUpdate({ labelWidth: v })}
            placeholder="28mm"
            mono
          />
        </PropertyRow>
        <div className="grid grid-cols-2 gap-2 px-1">
          <div className="space-y-0.5">
            <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">Row gap</span>
            <DesignerInput
              type="text"
              variant="mini"
              value={component.rowGap ?? '1.5mm'}
              onChange={(v) => onUpdate({ rowGap: v })}
              placeholder="1.5mm"
              mono
            />
          </div>
          {component.columns === 2 && (
            <div className="space-y-0.5">
              <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">
                Column gap
              </span>
              <DesignerInput
                type="text"
                variant="mini"
                value={component.columnGap ?? '4mm'}
                onChange={(v) => onUpdate({ columnGap: v })}
                placeholder="4mm"
                mono
              />
            </div>
          )}
        </div>
        <PropertyRow label="Show colon">
          <button
            type="button"
            onClick={() => onUpdate({ showColon: component.showColon === false })}
            className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded border transition-colors ${
              component.showColon !== false
                ? 'bg-[var(--accent)]/20 border-[var(--accent)]/30 text-[var(--accent)]'
                : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)]'
            }`}
          >
            {component.showColon !== false ? 'On' : 'Off'}
          </button>
        </PropertyRow>
      </CollapsibleSection>

      <CollapsibleSection label="Border">
        <PropertyRow label="Border width">
          <DesignerInput
            type="text"
            variant="mini"
            value={component.strokeWidth ?? '0'}
            onChange={(v) => onUpdate({ strokeWidth: v })}
            placeholder="0 or 0.1mm"
            mono
          />
        </PropertyRow>
        <PropertyRow label="Border color">
          <ColorPicker
            color={component.strokeColor ?? '#64748b'}
            onChange={(v) => onUpdate({ strokeColor: v })}
          />
        </PropertyRow>
        <PropertyRow label="Fill">
          <ColorPicker color={component.fill ?? '#ffffff'} onChange={(v) => onUpdate({ fill: v })} />
        </PropertyRow>
        <PropertyRow label="Inset">
          <DesignerInput
            type="text"
            variant="mini"
            value={component.inset ?? '2mm'}
            onChange={(v) => onUpdate({ inset: v })}
            placeholder="2mm"
            mono
          />
        </PropertyRow>
      </CollapsibleSection>

      <CollapsibleSection label="Fields">
        <div className="flex items-center justify-between py-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">
            Rows ({fields.length})
          </span>
          <button
            type="button"
            onClick={addField}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded transition-colors uppercase tracking-wider"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>

        <div className="space-y-1">
          {fields.map((field, idx) => (
            <div
              key={field.id}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded p-2 space-y-1.5"
            >
              <div className="flex items-center gap-1">
                <GripVertical className="w-3 h-3 text-[var(--text-muted)] opacity-30 shrink-0" />
                <span className="text-[8px] font-bold text-[var(--text-muted)]">#{idx + 1}</span>
                {component.columns === 2 && (
                  <Select
                    value={String(field.column ?? idx % 2)}
                    onValueChange={(v) => updateField(idx, { column: Number(v) as 0 | 1 })}
                  >
                    <SelectTrigger className="h-5 text-[9px] flex-1 bg-[var(--bg-widget)] border-[var(--border-default)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Left col</SelectItem>
                      <SelectItem value="1">Right col</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <button
                  type="button"
                  onClick={() => removeField(idx)}
                  className="p-0.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors ml-auto shrink-0"
                  title="Remove field"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <DesignerInput
                variant="mini"
                value={field.label}
                onChange={(v) => updateField(idx, { label: v })}
                placeholder="Label"
              />
              <DesignerInput
                variant="mini"
                value={field.value}
                onChange={(v) => updateField(idx, { value: v })}
                placeholder="{{binding}}"
                mono
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </>
  );
}
