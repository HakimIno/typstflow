'use client';

import { ColorPicker } from '@/components/shared/ColorPicker';
import { DesignerInput } from '@/components/shared/DesignerInput';
import type { RectangleComponent } from '@/types/schema';
import {
  CollapsibleSection,
  ControlField,
  InsetSection,
  PropertyGrid,
  PropertyRow,
  SegmentedControl,
} from './Shared';

interface RectanglePropertiesProps {
  component: RectangleComponent;
  onUpdate: (updates: Partial<RectangleComponent>) => void;
}

const STROKE_STYLES = [
  { value: 'solid' as const, label: 'Solid' },
  { value: 'dashed' as const, label: 'Dashed' },
  { value: 'dotted' as const, label: 'Dotted' },
];

const STROKE_CAPS = [
  { value: 'butt' as const, label: 'Butt' },
  { value: 'round' as const, label: 'Round' },
  { value: 'square' as const, label: 'Square' },
];

const STROKE_JOINS = [
  { value: 'miter' as const, label: 'Miter' },
  { value: 'round' as const, label: 'Round' },
  { value: 'bevel' as const, label: 'Bevel' },
];

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
type Side = (typeof SIDES)[number];

const toCssRadius = (val?: string) => (val ? `calc(${val} * 3.78)` : '0px');

export function RectangleProperties({ component, onUpdate }: RectanglePropertiesProps) {
  const hasBorder = !!(component.strokeColor || component.strokeWidth);
  const borderStyle: 'solid' | 'dashed' | 'dotted' =
    component.strokeStyle === 'dashed'
      ? 'dashed'
      : component.strokeStyle === 'dotted'
        ? 'dotted'
        : 'solid';

  const hasPerCorner = !!(
    component.radiusTopLeft ||
    component.radiusTopRight ||
    component.radiusBottomLeft ||
    component.radiusBottomRight
  );

  const isPerSide = !!component.strokeSides;
  const sides = component.strokeSides ?? { top: true, right: true, bottom: true, left: true };

  const previewRadiusStyle = hasPerCorner
    ? {
        borderTopLeftRadius: toCssRadius(component.radiusTopLeft ?? component.radius),
        borderTopRightRadius: toCssRadius(component.radiusTopRight ?? component.radius),
        borderBottomLeftRadius: toCssRadius(component.radiusBottomLeft ?? component.radius),
        borderBottomRightRadius: toCssRadius(component.radiusBottomRight ?? component.radius),
      }
    : { borderRadius: component.radius ? toCssRadius(component.radius) : 2 };

  const previewBorderStyle = hasBorder
    ? isPerSide
      ? {
          borderTopWidth: sides.top ? 1 : 0,
          borderRightWidth: sides.right ? 1 : 0,
          borderBottomWidth: sides.bottom ? 1 : 0,
          borderLeftWidth: sides.left ? 1 : 0,
          borderColor: component.strokeColor ?? '#d1d5db',
          borderStyle,
        }
      : { borderWidth: 1, borderColor: component.strokeColor ?? '#d1d5db', borderStyle }
    : {};

  const handleSideToggle = (side: Side) =>
    onUpdate({ strokeSides: { ...sides, [side]: !sides[side] } });

  return (
    <>
      {/* Live Mini Preview */}
      <div className="px-3 py-3 border-b border-[var(--border-default)]">
        <div
          className="mx-auto"
          style={{
            width: 80,
            height: 40,
            backgroundColor: component.fill ?? 'transparent',
            ...previewRadiusStyle,
            ...previewBorderStyle,
            boxSizing: 'border-box',
            backgroundImage: !component.fill
              ? 'repeating-linear-gradient(45deg, #374151 0, #374151 1px, transparent 0, transparent 50%)'
              : undefined,
            backgroundSize: !component.fill ? '6px 6px' : undefined,
          }}
        />
        <p className="text-center text-[8px] text-[var(--text-muted)] mt-1.5 font-medium">
          Preview
        </p>
      </div>

      {/* Fill */}
      <CollapsibleSection label="Fill">
        <PropertyGrid cols={2}>
          <ControlField label="Color">
            <ColorPicker
              color={component.fill ?? '#ffffff'}
              onChange={(fill) => onUpdate({ fill })}
            />
          </ControlField>
        </PropertyGrid>
        <PropertyRow label="No Fill">
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

      {/* Corner Radius */}
      <CollapsibleSection label="Corner Radius">
        <PropertyRow label="Mode">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasPerCorner}
              onChange={(e) => {
                if (e.target.checked) {
                  const base = component.radius ?? '0mm';
                  onUpdate({
                    radiusTopLeft: base,
                    radiusTopRight: base,
                    radiusBottomLeft: base,
                    radiusBottomRight: base,
                  });
                } else {
                  onUpdate({
                    radiusTopLeft: undefined,
                    radiusTopRight: undefined,
                    radiusBottomLeft: undefined,
                    radiusBottomRight: undefined,
                  });
                }
              }}
              className="w-3 h-3 accent-[var(--accent)]"
            />
            <span className="text-[11px] text-[var(--text-secondary)]">Per-corner radius</span>
          </label>
        </PropertyRow>

        {!hasPerCorner ? (
          <PropertyGrid cols={2}>
            <ControlField label="All Corners">
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
        ) : (
          <PropertyGrid cols={2}>
            <ControlField label="Top Left">
              <DesignerInput
                type="text"
                variant="mini"
                value={component.radiusTopLeft ?? ''}
                onChange={(v) => onUpdate({ radiusTopLeft: v || undefined })}
                mono
                placeholder="0mm"
              />
            </ControlField>
            <ControlField label="Top Right">
              <DesignerInput
                type="text"
                variant="mini"
                value={component.radiusTopRight ?? ''}
                onChange={(v) => onUpdate({ radiusTopRight: v || undefined })}
                mono
                placeholder="0mm"
              />
            </ControlField>
            <ControlField label="Bot Left">
              <DesignerInput
                type="text"
                variant="mini"
                value={component.radiusBottomLeft ?? ''}
                onChange={(v) => onUpdate({ radiusBottomLeft: v || undefined })}
                mono
                placeholder="0mm"
              />
            </ControlField>
            <ControlField label="Bot Right">
              <DesignerInput
                type="text"
                variant="mini"
                value={component.radiusBottomRight ?? ''}
                onChange={(v) => onUpdate({ radiusBottomRight: v || undefined })}
                mono
                placeholder="0mm"
              />
            </ControlField>
          </PropertyGrid>
        )}
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

        <PropertyRow label="Style">
          <SegmentedControl
            options={STROKE_STYLES}
            value={component.strokeStyle ?? 'solid'}
            onChange={(strokeStyle) => onUpdate({ strokeStyle })}
          />
        </PropertyRow>

        <PropertyRow label="Sides">
          <div className="w-full space-y-1.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPerSide}
                onChange={(e) =>
                  onUpdate({
                    strokeSides: e.target.checked
                      ? { top: true, right: true, bottom: true, left: true }
                      : undefined,
                  })
                }
                className="w-3 h-3 accent-[var(--accent)]"
              />
              <span className="text-[11px] text-[var(--text-secondary)]">Per-side control</span>
            </label>
            {isPerSide && (
              <div className="flex items-center gap-3">
                {/* Mini rect diagram showing active sides */}
                <div className="relative w-8 h-6 shrink-0">
                  <div
                    className={`absolute inset-x-0 top-0 h-[2px] rounded-sm transition-colors ${sides.top ? 'bg-[var(--accent)]' : 'bg-[var(--border-default)]'}`}
                  />
                  <div
                    className={`absolute inset-y-0 right-0 w-[2px] rounded-sm transition-colors ${sides.right ? 'bg-[var(--accent)]' : 'bg-[var(--border-default)]'}`}
                  />
                  <div
                    className={`absolute inset-x-0 bottom-0 h-[2px] rounded-sm transition-colors ${sides.bottom ? 'bg-[var(--accent)]' : 'bg-[var(--border-default)]'}`}
                  />
                  <div
                    className={`absolute inset-y-0 left-0 w-[2px] rounded-sm transition-colors ${sides.left ? 'bg-[var(--accent)]' : 'bg-[var(--border-default)]'}`}
                  />
                </div>
                {/* T R B L toggle buttons */}
                <div className="grid grid-cols-4 gap-1 flex-1">
                  {SIDES.map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => handleSideToggle(side)}
                      className={`text-[9px] py-1 rounded font-bold uppercase tracking-wide transition-colors ${
                        sides[side]
                          ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                          : 'bg-white/[0.04] text-[var(--text-muted)]'
                      }`}
                    >
                      {side[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PropertyRow>

        <InsetSection label="Advanced">
          <PropertyRow label="Cap">
            <SegmentedControl
              options={STROKE_CAPS}
              value={component.strokeCap ?? 'butt'}
              onChange={(strokeCap) => onUpdate({ strokeCap })}
            />
          </PropertyRow>
          <PropertyRow label="Join">
            <SegmentedControl
              options={STROKE_JOINS}
              value={component.strokeJoin ?? 'miter'}
              onChange={(strokeJoin) => onUpdate({ strokeJoin })}
            />
          </PropertyRow>
        </InsetSection>

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

      {/* Spacing */}
      <CollapsibleSection label="Spacing" defaultOpen={false}>
        <PropertyGrid cols={2}>
          <ControlField label="Inset">
            <DesignerInput
              type="text"
              variant="mini"
              value={component.inset ?? ''}
              onChange={(v) => onUpdate({ inset: v || undefined })}
              mono
              placeholder="0mm"
            />
          </ControlField>
          <ControlField label="Outset">
            <DesignerInput
              type="text"
              variant="mini"
              value={component.outset ?? ''}
              onChange={(v) => onUpdate({ outset: v || undefined })}
              mono
              placeholder="0mm"
            />
          </ControlField>
        </PropertyGrid>
      </CollapsibleSection>
    </>
  );
}
