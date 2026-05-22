'use client';

import { ColorPicker } from '@/components/shared/ColorPicker';
import { DesignerInput } from '@/components/shared/DesignerInput';
import type { RectangleComponent } from '@/types/schema';
import { CollapsibleSection, ControlField, PropertyGrid, PropertyRow, SegmentedControl } from './Shared';

interface RectanglePropertiesProps {
  component: RectangleComponent;
  onUpdate: (updates: Partial<RectangleComponent>) => void;
}

const STROKE_STYLES = [
  { value: 'solid' as const, label: 'Solid' },
  { value: 'dashed' as const, label: 'Dashed' },
  { value: 'dotted' as const, label: 'Dotted' },
];

export function RectangleProperties({ component, onUpdate }: RectanglePropertiesProps) {
  const hasBorder = !!(component.strokeColor || component.strokeWidth);
  const borderStyle =
    component.strokeStyle === 'dashed' ? 'dashed' : component.strokeStyle === 'dotted' ? 'dotted' : 'solid';

  return (
    <>
      {/* Live Mini Preview */}
      <div className="px-3 py-3 border-b border-[var(--border-default)]">
        <div
          className="mx-auto rounded"
          style={{
            width: 80,
            height: 40,
            backgroundColor: component.fill ?? 'transparent',
            borderWidth: hasBorder ? 1 : 0,
            borderColor: component.strokeColor ?? '#d1d5db',
            borderStyle,
            borderRadius: component.radius ? `calc(${component.radius} * 3.78)` : 2,
            boxSizing: 'border-box',
            backgroundImage:
              !component.fill
                ? 'repeating-linear-gradient(45deg, #374151 0, #374151 1px, transparent 0, transparent 50%)'
                : undefined,
            backgroundSize: !component.fill ? '6px 6px' : undefined,
          }}
        />
        <p className="text-center text-[8px] text-[var(--text-muted)] mt-1.5 font-medium">Preview</p>
      </div>

      {/* Fill */}
      <CollapsibleSection label="Fill">
        <PropertyGrid cols={2}>
          <ControlField label="Fill Color">
            <ColorPicker
              color={component.fill ?? '#ffffff'}
              onChange={(fill) => onUpdate({ fill })}
            />
          </ControlField>
          <ControlField label="Corner Radius">
            <DesignerInput
              type="text"
              variant="mini"
              value={component.radius ?? ''}
              onChange={(v) => onUpdate({ radius: v || undefined })}
              mono
              placeholder="0mm"
            />
          </ControlField>
        </PropertyGrid>

        <PropertyRow label="No Fill (Transparent)">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!component.fill}
              onChange={(e) => onUpdate({ fill: e.target.checked ? undefined : '#ffffff' })}
              className="w-3 h-3 accent-[var(--accent)]"
            />
            <span className="text-[11px] text-[var(--text-secondary)]">Transparent background</span>
          </label>
        </PropertyRow>
      </CollapsibleSection>

      {/* Border */}
      <CollapsibleSection label="Border">
        <PropertyGrid cols={2}>
          <ControlField label="Color">
            <ColorPicker
              color={component.strokeColor ?? '#000000'}
              onChange={(strokeColor) => onUpdate({ strokeColor })}
            />
          </ControlField>
          <ControlField label="Thickness">
            <DesignerInput
              type="text"
              variant="mini"
              value={component.strokeWidth ?? ''}
              onChange={(v) => onUpdate({ strokeWidth: v || undefined })}
              mono
              placeholder="1pt"
            />
          </ControlField>
        </PropertyGrid>

        <PropertyRow label="Border Style">
          <SegmentedControl
            options={STROKE_STYLES}
            value={component.strokeStyle ?? 'solid'}
            onChange={(strokeStyle) => onUpdate({ strokeStyle })}
          />
        </PropertyRow>

        <PropertyRow label="No Border">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!hasBorder}
              onChange={(e) =>
                onUpdate(
                  e.target.checked
                    ? { strokeColor: undefined, strokeWidth: undefined }
                    : { strokeColor: '#000000', strokeWidth: '1pt' }
                )
              }
              className="w-3 h-3 accent-[var(--accent)]"
            />
            <span className="text-[11px] text-[var(--text-secondary)]">Remove border</span>
          </label>
        </PropertyRow>
      </CollapsibleSection>
    </>
  );
}
