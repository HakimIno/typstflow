'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { DesignerInput } from '@/components/shared/DesignerInput';
import type { SignatureBlockComponent, SignatureBlockSlot } from '@/types/schema';
import { Plus, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { CollapsibleSection, PropertyRow } from './Shared';

interface Props {
  component: SignatureBlockComponent;
  onUpdate: (updates: Partial<SignatureBlockComponent>) => void;
}

export function SignatureBlockProperties({ component, onUpdate }: Props) {
  const slots = component.slots ?? [];

  const updateSlot = (idx: number, updates: Partial<SignatureBlockSlot>) => {
    const next = [...slots];
    next[idx] = { ...next[idx], ...updates };
    onUpdate({ slots: next });
  };

  const addSlot = () => {
    onUpdate({
      slots: [
        ...slots,
        {
          id: nanoid(),
          role: 'ผู้อนุมัติ',
          name: '{{signatures.approver}}',
          date: 'วันที่ ___/___/______',
          lineStyle: 'dotted',
        },
      ],
    });
  };

  const removeSlot = (idx: number) => {
    onUpdate({ slots: slots.filter((_, i) => i !== idx) });
  };

  return (
    <>
      <CollapsibleSection label="Layout">
        <PropertyRow label="Variant">
          <Select
            value={component.variant ?? 'thai-form'}
            onValueChange={(v) =>
              onUpdate({ variant: v as SignatureBlockComponent['variant'] })
            }
          >
            <SelectTrigger className="h-6 text-[10px] bg-[var(--bg-surface)] border-[var(--border-default)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thai-form">Thai form</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
            </SelectContent>
          </Select>
        </PropertyRow>
        <PropertyRow label="Show date">
          <button
            type="button"
            onClick={() => onUpdate({ showDate: component.showDate === false })}
            className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded border transition-colors ${
              component.showDate !== false
                ? 'bg-[var(--accent)]/20 border-[var(--accent)]/30 text-[var(--accent)]'
                : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)]'
            }`}
          >
            {component.showDate !== false ? 'On' : 'Off'}
          </button>
        </PropertyRow>
        <PropertyRow label="Slot gap">
          <DesignerInput
            variant="mini"
            value={component.slotSpacing ?? '5mm'}
            onChange={(v) => onUpdate({ slotSpacing: v })}
            placeholder="5mm"
            mono
          />
        </PropertyRow>
      </CollapsibleSection>

      <CollapsibleSection label="Slots">
        <div className="flex items-center justify-between py-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">
            Signatures ({slots.length})
          </span>
          <button
            type="button"
            onClick={addSlot}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded transition-colors uppercase tracking-wider"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
        <div className="space-y-1">
          {slots.map((slot, idx) => (
            <div
              key={slot.id}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded p-2 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold text-[var(--text-muted)]">#{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeSlot(idx)}
                  className="p-0.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <DesignerInput
                variant="mini"
                value={slot.role}
                onChange={(v) => updateSlot(idx, { role: v })}
                placeholder="Role / ตำแหน่ง"
              />
              <DesignerInput
                variant="mini"
                value={slot.name ?? ''}
                onChange={(v) => updateSlot(idx, { name: v })}
                placeholder="{{signatures.name}}"
                mono
              />
              <DesignerInput
                variant="mini"
                value={slot.date ?? ''}
                onChange={(v) => updateSlot(idx, { date: v })}
                placeholder="วันที่ ___/___/______"
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </>
  );
}
