'use client';

import { ColorPicker } from '@/components/shared/ColorPicker';
import { DesignerInput } from '@/components/shared/DesignerInput';
import type { SignatureComponent, SignatureSlot } from '@/types/schema';
import { PenLine, Plus, Trash2 } from 'lucide-react';
import {
  CheckboxField,
  CollapsibleSection,
  ControlField,
  InsetSection,
  PropertyGrid,
  PropertyRow,
  SegmentedControl,
  ToggleChip,
  ToggleChipGroup,
} from './Shared';

interface SignaturePropertiesProps {
  component: SignatureComponent;
  onUpdate: (updates: Partial<SignatureComponent>) => void;
}

const STROKE_STYLES = [
  { value: 'solid' as const, label: 'Solid' },
  { value: 'dashed' as const, label: 'Dashed' },
  { value: 'dotted' as const, label: 'Dotted' },
];

const FONT_WEIGHTS = [
  { value: 'regular' as const, label: 'Regular' },
  { value: 'bold' as const, label: 'Bold' },
];

let _slotCounter = 0;
function makeSlotId() {
  return `sig-${Date.now()}-${++_slotCounter}`;
}

export function SignatureProperties({ component, onUpdate }: SignaturePropertiesProps) {
  const slots = component.slots ?? [];

  const updateSlot = (id: string, updates: Partial<SignatureSlot>) =>
    onUpdate({ slots: slots.map((s) => (s.id === id ? { ...s, ...updates } : s)) });

  const addSlot = () => {
    if (slots.length >= 4) return;
    onUpdate({
      slots: [
        ...slots,
        {
          id: makeSlotId(),
          label: 'Signature',
          nameLabel: '(______________)',
          dateLabel: 'Date: ___/___/______',
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
          {slots.map((slot, i) => {
            // Resolve effective visibility (per-slot overrides component default)
            const nameOn = slot.showNameLine ?? component.showNameLine ?? true;
            const dateOn = slot.showDateLine ?? component.showDateLine ?? true;

            return (
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

                {/* Slot header + per-slot toggles */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <PenLine className="w-3 h-3 text-[var(--accent)] shrink-0" />
                    <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.1em]">
                      Slot {i + 1}
                    </span>
                  </div>
                  <ToggleChipGroup>
                    <ToggleChip
                      checked={nameOn}
                      onChange={(v) => updateSlot(slot.id, { showNameLine: v })}
                      label="Name"
                    />
                    <ToggleChip
                      checked={dateOn}
                      onChange={(v) => updateSlot(slot.id, { showDateLine: v })}
                      label="Date"
                    />
                  </ToggleChipGroup>
                </div>

                {/* Title label */}
                <div className="space-y-0.5">
                  <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">
                    Title Label
                  </span>
                  <DesignerInput
                    type="text"
                    variant="mini"
                    value={slot.label}
                    onChange={(v) => updateSlot(slot.id, { label: v })}
                    placeholder="e.g. Approved by"
                  />
                </div>

                {/* Name text */}
                {nameOn && (
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">
                      Name Text
                    </span>
                    <DesignerInput
                      type="text"
                      variant="mini"
                      value={slot.nameLabel ?? ''}
                      onChange={(v) => updateSlot(slot.id, { nameLabel: v || undefined })}
                      placeholder="(______________)"
                    />
                  </div>
                )}

                {/* Date text */}
                {dateOn && (
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">
                      Date Text
                    </span>
                    <DesignerInput
                      type="text"
                      variant="mini"
                      value={slot.dateLabel ?? ''}
                      onChange={(v) => updateSlot(slot.id, { dateLabel: v || undefined })}
                      placeholder="Date: ___/___/______"
                    />
                  </div>
                )}
              </div>
            );
          })}

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

      {/* Signature Line */}
      <CollapsibleSection label="Signature Line">
        <PropertyGrid cols={2}>
          <ControlField label="Color">
            <ColorPicker
              color={component.lineColor ?? '#000000'}
              onChange={(lineColor) => onUpdate({ lineColor })}
            />
          </ControlField>
          <ControlField label="Thickness">
            <DesignerInput
              type="text"
              variant="mini"
              value={component.lineWidth ?? ''}
              onChange={(v) => onUpdate({ lineWidth: v || undefined })}
              mono
              placeholder="0.5pt"
            />
          </ControlField>
        </PropertyGrid>

        <PropertyRow label="Style">
          <SegmentedControl
            options={STROKE_STYLES}
            value={component.lineStyle ?? 'solid'}
            onChange={(lineStyle) => onUpdate({ lineStyle })}
          />
        </PropertyRow>

        <PropertyGrid cols={2}>
          <ControlField label="Column Gap">
            <DesignerInput
              type="text"
              variant="mini"
              value={component.slotSpacing ?? ''}
              onChange={(v) => onUpdate({ slotSpacing: v || undefined })}
              mono
              placeholder="5mm"
            />
          </ControlField>
        </PropertyGrid>
      </CollapsibleSection>

      {/* Label Style */}
      <CollapsibleSection label="Label Style">
        <PropertyGrid cols={2}>
          <ControlField label="Font Size">
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
          <ControlField label="Color">
            <ColorPicker
              color={component.labelStyle?.color ?? '#000000'}
              onChange={(color) => onUpdate({ labelStyle: { ...component.labelStyle, color } })}
            />
          </ControlField>
        </PropertyGrid>

        <PropertyRow label="Weight">
          <SegmentedControl
            options={FONT_WEIGHTS}
            value={
              component.labelStyle?.fontWeight === 'bold' ||
              component.labelStyle?.fontWeight === 700 ||
              component.labelStyle?.fontWeight === 'extrabold' ||
              component.labelStyle?.fontWeight === 'black'
                ? 'bold'
                : 'regular'
            }
            onChange={(w) => onUpdate({ labelStyle: { ...component.labelStyle, fontWeight: w } })}
          />
        </PropertyRow>
      </CollapsibleSection>

      {/* Defaults */}
      <CollapsibleSection label="Slot Defaults" defaultOpen={false}>
        <InsetSection label="Apply to all slots without per-slot override">
          <div className="space-y-2">
            <CheckboxField
              checked={component.showNameLine !== false}
              onChange={(v) => onUpdate({ showNameLine: v })}
              label="Show Name Field"
            />
            <CheckboxField
              checked={component.showDateLine !== false}
              onChange={(v) => onUpdate({ showDateLine: v })}
              label="Show Date Field"
            />
          </div>
        </InsetSection>
      </CollapsibleSection>
    </>
  );
}
