'use client';

import { DesignerInput } from '@/components/shared/DesignerInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import type { FillInComponent, FillInSegment } from '@/types/schema';
import { Plus, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { CollapsibleSection, PropertyRow } from './Shared';

interface Props {
  component: FillInComponent;
  onUpdate: (updates: Partial<FillInComponent>) => void;
}

export function FillInProperties({ component, onUpdate }: Props) {
  const segments = component.segments ?? [];
  const marker = component.marker ?? 'none';

  const updateSegment = (idx: number, updates: Partial<FillInSegment>) => {
    const next = [...segments];
    next[idx] = { ...next[idx], ...updates };
    onUpdate({ segments: next });
  };

  const addSegment = () => {
    onUpdate({ segments: [...segments, { id: nanoid(), kind: 'text', text: '' }] });
  };

  const removeSegment = (idx: number) => {
    onUpdate({ segments: segments.filter((_, i) => i !== idx) });
  };

  return (
    <>
      <CollapsibleSection label="Segments">
        <div className="flex items-center justify-between py-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">
            Segments ({segments.length})
          </span>
          <button
            type="button"
            onClick={addSegment}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded transition-colors uppercase tracking-wider"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
        <div className="space-y-1">
          {segments.map((seg, idx) => (
            <div
              key={seg.id}
              className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded p-2 space-y-1"
            >
              <div className="flex items-center justify-between gap-1">
                <Select
                  value={seg.kind}
                  onValueChange={(v) => updateSegment(idx, { kind: v as FillInSegment['kind'] })}
                >
                  <SelectTrigger className="h-6 flex-1 text-[10px] bg-[var(--bg-widget)] border-[var(--border-default)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="blank">Blank</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => removeSegment(idx)}
                  className="p-0.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {seg.kind === 'text' ? (
                <DesignerInput
                  variant="mini"
                  value={seg.text ?? ''}
                  onChange={(v) => updateSegment(idx, { text: v })}
                  placeholder="ลงชื่อ"
                />
              ) : (
                <div className="flex items-center gap-1">
                  <DesignerInput
                    variant="mini"
                    className="flex-1 min-w-0"
                    value={seg.width ?? ''}
                    onChange={(v) => updateSegment(idx, { width: v })}
                    placeholder="1fr"
                    mono
                  />
                  <Select
                    value={seg.align ?? 'center'}
                    onValueChange={(v) =>
                      updateSegment(idx, { align: v as FillInSegment['align'] })
                    }
                  >
                    <SelectTrigger className="h-6 w-20 text-[10px] bg-[var(--bg-widget)] border-[var(--border-default)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="Line">
        <PropertyRow label="Style">
          <Select
            value={component.lineStyle ?? 'dotted'}
            onValueChange={(v) => onUpdate({ lineStyle: v as FillInComponent['lineStyle'] })}
          >
            <SelectTrigger className="h-6 text-[10px] bg-[var(--bg-surface)] border-[var(--border-default)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dotted">Dotted</SelectItem>
              <SelectItem value="dashed">Dashed</SelectItem>
              <SelectItem value="solid">Solid</SelectItem>
            </SelectContent>
          </Select>
        </PropertyRow>
        <PropertyRow label="Gap">
          <DesignerInput
            variant="mini"
            value={component.gap ?? '1mm'}
            onChange={(v) => onUpdate({ gap: v })}
            placeholder="1mm"
            mono
          />
        </PropertyRow>
      </CollapsibleSection>

      <CollapsibleSection label="Marker">
        <PropertyRow label="Type">
          <Select
            value={marker}
            onValueChange={(v) => onUpdate({ marker: v as FillInComponent['marker'] })}
          >
            <SelectTrigger className="h-6 text-[10px] bg-[var(--bg-surface)] border-[var(--border-default)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="checkbox">Checkbox</SelectItem>
              <SelectItem value="circle">Circle</SelectItem>
            </SelectContent>
          </Select>
        </PropertyRow>
        {marker !== 'none' && (
          <>
            <PropertyRow label="Checked">
              <button
                type="button"
                onClick={() => onUpdate({ checked: !component.checked })}
                className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded border transition-colors ${
                  component.checked
                    ? 'bg-[var(--accent)]/20 border-[var(--accent)]/30 text-[var(--accent)]'
                    : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)]'
                }`}
              >
                {component.checked ? 'On' : 'Off'}
              </button>
            </PropertyRow>
            <PropertyRow label="Size">
              <DesignerInput
                variant="mini"
                type="number"
                value={component.markerSize ?? 8}
                onChange={(v) => onUpdate({ markerSize: Number(v) || 8 })}
                placeholder="8"
              />
            </PropertyRow>
          </>
        )}
      </CollapsibleSection>
    </>
  );
}
