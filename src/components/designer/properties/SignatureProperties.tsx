'use client';

import { ColorPicker } from '@/components/shared/ColorPicker';
import { DesignerInput } from '@/components/shared/DesignerInput';
import type { SignatureComponent, SignatureSlot } from '@/types/schema';
import { PenLine, Plus, Trash2 } from 'lucide-react';
import { CollapsibleSection, ControlField, PropertyGrid, PropertyRow, SegmentedControl } from './Shared';

interface SignaturePropertiesProps {
  component: SignatureComponent;
  onUpdate: (updates: Partial<SignatureComponent>) => void;
}

const STROKE_STYLES = [
  { value: 'solid' as const, label: 'Solid' },
  { value: 'dashed' as const, label: 'Dashed' },
  { value: 'dotted' as const, label: 'Dotted' },
];

let _slotCounter = 0;
function makeSlotId() {
  return `sig-${Date.now()}-${++_slotCounter}`;
}

export function SignatureProperties({ component, onUpdate }: SignaturePropertiesProps) {
  const slots = component.slots ?? [];

  const updateSlot = (id: string, updates: Partial<SignatureSlot>) => {
    onUpdate({ slots: slots.map((s) => (s.id === id ? { ...s, ...updates } : s)) });
  };

  const addSlot = () => {
    if (slots.length >= 4) return;
    onUpdate({
      slots: [
        ...slots,
        {
          id: makeSlotId(),
          label: 'ผู้อนุมัติ',
          nameLabel: '(......................)',
          dateLabel: 'วันที่: ___/___/______',
        },
      ],
    });
  };

  const removeSlot = (id: string) => {
    if (slots.length <= 1) return;
    onUpdate({ slots: slots.filter((s) => s.id !== id) });
  };

  return (
    <>
      {/* Slots */}
      <CollapsibleSection label={`Signature Slots (${slots.length}/4)`}>
        <div className="space-y-2.5">
          {slots.map((slot, i) => (
            <div
              key={slot.id}
              className="bg-[var(--bg-widget)] border border-[var(--border-default)] rounded p-2.5 space-y-2 group/slot relative"
            >
              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeSlot(slot.id)}
                disabled={slots.length <= 1}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity shadow-sm z-10 disabled:hidden"
              >
                <Trash2 className="w-3 h-3" />
              </button>

              {/* Slot header */}
              <div className="flex items-center gap-1.5">
                <PenLine className="w-3 h-3 text-[var(--accent)] shrink-0" />
                <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.1em]">
                  Slot {i + 1}
                </span>
              </div>

              {/* Label */}
              <div className="space-y-0.5">
                <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">Title Label</span>
                <DesignerInput
                  type="text"
                  variant="mini"
                  value={slot.label}
                  onChange={(v) => updateSlot(slot.id, { label: v })}
                  placeholder="e.g. ผู้อนุมัติ"
                />
              </div>

              {/* Name line */}
              {component.showNameLine !== false && (
                <div className="space-y-0.5">
                  <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">Name Text</span>
                  <DesignerInput
                    type="text"
                    variant="mini"
                    value={slot.nameLabel ?? ''}
                    onChange={(v) => updateSlot(slot.id, { nameLabel: v || undefined })}
                    placeholder="(......................)"
                  />
                </div>
              )}

              {/* Date line */}
              {component.showDateLine !== false && (
                <div className="space-y-0.5">
                  <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">Date Text</span>
                  <DesignerInput
                    type="text"
                    variant="mini"
                    value={slot.dateLabel ?? ''}
                    onChange={(v) => updateSlot(slot.id, { dateLabel: v || undefined })}
                    placeholder="วันที่: ___/___/______"
                  />
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addSlot}
            disabled={slots.length >= 4}
            className="w-full py-1.5 border border-dashed border-[var(--border-default)] rounded text-[9px] font-bold uppercase text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all flex items-center justify-center gap-1 disabled:opacity-30 disabled:pointer-events-none"
          >
            <Plus className="w-3 h-3" />
            Add Slot (max 4)
          </button>
        </div>
      </CollapsibleSection>

      {/* Line Appearance */}
      <CollapsibleSection label="Signature Line">
        <PropertyGrid cols={2}>
          <ControlField label="Line Color">
            <ColorPicker
              color={component.lineColor ?? '#000000'}
              onChange={(lineColor) => onUpdate({ lineColor })}
            />
          </ControlField>
          <ControlField label="Label Size">
            <DesignerInput
              type="number"
              variant="mini"
              value={String(component.labelStyle?.fontSize ?? 8)}
              onChange={(v) =>
                onUpdate({ labelStyle: { ...component.labelStyle, fontSize: Number(v) } })
              }
              mono
              placeholder="8"
            />
          </ControlField>
        </PropertyGrid>

        <PropertyRow label="Line Style">
          <SegmentedControl
            options={STROKE_STYLES}
            value={component.lineStyle ?? 'solid'}
            onChange={(lineStyle) => onUpdate({ lineStyle })}
          />
        </PropertyRow>
      </CollapsibleSection>

      {/* Visibility */}
      <CollapsibleSection label="Show / Hide Fields" defaultOpen={false}>
        <div className="space-y-2">
          {(
            [
              { key: 'showNameLine', label: 'Show Name Field' },
              { key: 'showDateLine', label: 'Show Date Field' },
            ] as const
          ).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={component[key] !== false}
                onChange={(e) => onUpdate({ [key]: e.target.checked })}
                className="w-3 h-3 accent-[var(--accent)]"
              />
              <span className="text-[11px] text-[var(--text-secondary)]">{label}</span>
            </label>
          ))}
        </div>
      </CollapsibleSection>
    </>
  );
}
