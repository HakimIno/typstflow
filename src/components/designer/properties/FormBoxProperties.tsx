'use client';

import { ColorPicker } from '@/components/shared/ColorPicker';
import { DesignerInput } from '@/components/shared/DesignerInput';
import type { FormBoxComponent } from '@/types/schema';
import { CollapsibleSection, PropertyRow } from './Shared';

interface Props {
  component: FormBoxComponent;
  onUpdate: (updates: Partial<FormBoxComponent>) => void;
}

export function FormBoxProperties({ component, onUpdate }: Props) {
  return (
    <>
      <CollapsibleSection label="Box Style">
        <PropertyRow label="Fill">
          <ColorPicker
            color={component.fill ?? '#ffffff'}
            onChange={(v) => onUpdate({ fill: v })}
          />
        </PropertyRow>
        <PropertyRow label="Border">
          <ColorPicker
            color={component.strokeColor ?? '#64748b'}
            onChange={(v) => onUpdate({ strokeColor: v })}
          />
        </PropertyRow>
        <PropertyRow label="Border width">
          <DesignerInput
            type="text"
            variant="mini"
            value={component.strokeWidth ?? '0.1mm'}
            onChange={(v) => onUpdate({ strokeWidth: v })}
            placeholder="0.1mm"
            mono
          />
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
        <PropertyRow label="Radius">
          <DesignerInput
            type="text"
            variant="mini"
            value={component.radius ?? ''}
            onChange={(v) => onUpdate({ radius: v || undefined })}
            placeholder="0mm"
            mono
          />
        </PropertyRow>
        <PropertyRow label="Inner gap">
          <DesignerInput
            type="text"
            variant="mini"
            value={component.innerGap ?? '2mm'}
            onChange={(v) => onUpdate({ innerGap: v })}
            placeholder="2mm"
            mono
          />
        </PropertyRow>
      </CollapsibleSection>

      <CollapsibleSection label="Nested Content">
        <p className="text-[8px] text-[var(--text-muted)] opacity-60 leading-relaxed px-1">
          Drag components from the palette into the form box on canvas. Children stack vertically
          in flow mode.
        </p>
        <p className="text-[8px] text-[var(--text-muted)] opacity-50 px-1 pt-1">
          {(component.components ?? []).length} nested component
          {(component.components ?? []).length === 1 ? '' : 's'}
        </p>
      </CollapsibleSection>
    </>
  );
}
