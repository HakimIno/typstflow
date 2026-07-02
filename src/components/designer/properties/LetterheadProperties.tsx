'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { DesignerInput } from '@/components/shared/DesignerInput';
import type { LetterheadComponent } from '@/types/schema';
import { CollapsibleSection, PropertyRow } from './Shared';

interface Props {
  component: LetterheadComponent;
  onUpdate: (updates: Partial<LetterheadComponent>) => void;
}

export function LetterheadProperties({ component, onUpdate }: Props) {
  return (
    <>
      <CollapsibleSection label="Company">
        <PropertyRow label="Name">
          <DesignerInput
            variant="mini"
            value={component.companyName}
            onChange={(v) => onUpdate({ companyName: v })}
            placeholder="{{company.name}}"
            mono
          />
        </PropertyRow>
        <PropertyRow label="Address">
          <DesignerInput
            variant="mini"
            value={component.companyAddress ?? ''}
            onChange={(v) => onUpdate({ companyAddress: v || undefined })}
            placeholder="{{company.address}}"
            mono
          />
        </PropertyRow>
        <PropertyRow label="Tax ID">
          <DesignerInput
            variant="mini"
            value={component.taxId ?? ''}
            onChange={(v) => onUpdate({ taxId: v || undefined })}
            placeholder="{{company.taxId}}"
            mono
          />
        </PropertyRow>
      </CollapsibleSection>

      <CollapsibleSection label="Document Title">
        <PropertyRow label="Title">
          <DesignerInput
            variant="mini"
            value={component.title}
            onChange={(v) => onUpdate({ title: v })}
            placeholder="ใบขอซื้อ/ขอจ้าง"
          />
        </PropertyRow>
        <PropertyRow label="Subtitle">
          <DesignerInput
            variant="mini"
            value={component.subtitle ?? ''}
            onChange={(v) => onUpdate({ subtitle: v || undefined })}
            placeholder=""
          />
        </PropertyRow>
        <PropertyRow label="Underline">
          <button
            type="button"
            onClick={() => onUpdate({ underlineTitle: !component.underlineTitle })}
            className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded border transition-colors ${
              component.underlineTitle
                ? 'bg-[var(--accent)]/20 border-[var(--accent)]/30 text-[var(--accent)]'
                : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)]'
            }`}
          >
            {component.underlineTitle ? 'On' : 'Off'}
          </button>
        </PropertyRow>
        <PropertyRow label="Page no.">
          <button
            type="button"
            onClick={() => onUpdate({ showPageNumber: component.showPageNumber === false })}
            className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded border transition-colors ${
              component.showPageNumber !== false
                ? 'bg-[var(--accent)]/20 border-[var(--accent)]/30 text-[var(--accent)]'
                : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)]'
            }`}
          >
            {component.showPageNumber !== false ? 'Show' : 'Hide'}
          </button>
        </PropertyRow>
      </CollapsibleSection>
    </>
  );
}
