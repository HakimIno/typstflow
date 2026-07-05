'use client';

import { useAutoFitHeight } from '@/hooks/use-auto-fit-height';
import { resolveBindings } from '@/lib/utils/json-path';
import type { LetterheadComponent } from '@/types/schema';
import { memo, useRef } from 'react';

interface Props {
  component: LetterheadComponent;
  sampleData?: Record<string, unknown>;
}

export const LetterheadPreview = memo(function LetterheadPreview({
  component,
  sampleData,
}: Props) {
  const companyName = resolveBindings(component.companyName, sampleData) || 'Company Name';
  const address = component.companyAddress
    ? resolveBindings(component.companyAddress, sampleData)
    : '';
  const taxId = component.taxId ? resolveBindings(component.taxId, sampleData) : '';
  const title = resolveBindings(component.title, sampleData) || 'Document Title';
  const subtitle = component.subtitle ? resolveBindings(component.subtitle, sampleData) : '';

  const companySize = component.companyStyle?.fontSize ?? 13;
  const titleSize = component.titleStyle?.fontSize ?? 15;
  const addressSize = component.addressStyle?.fontSize ?? 9;

  const ref = useRef<HTMLDivElement>(null);
  useAutoFitHeight(ref, component.id);

  return (
    <div ref={ref} className="w-full relative" style={{ fontFamily: 'Sarabun, sans-serif' }}>
      {component.showPageNumber !== false && (
        <div
          className="absolute top-0 right-0"
          style={{ fontSize: '8pt', color: '#334155' }}
        >
          หน้า 1 / 1
        </div>
      )}
      <div className="flex flex-col items-center text-center gap-0.5 pt-1">
        <div style={{ fontSize: `${companySize}pt`, fontWeight: 700, color: '#111827' }}>
          {companyName}
        </div>
        {address && (
          <div style={{ fontSize: `${addressSize}pt`, color: '#475569' }}>{address}</div>
        )}
        {taxId && (
          <div style={{ fontSize: `${addressSize}pt`, color: '#475569' }}>
            {component.showTaxIdLabel !== false
              ? `${component.taxIdLabel ?? 'เลขประจำตัวผู้เสียภาษี'} ${taxId}`
              : taxId}
          </div>
        )}
        <div className="w-full mt-1">
          <div style={{ fontSize: `${titleSize}pt`, fontWeight: 700, color: '#111827' }}>
            {title}
          </div>
          {component.underlineTitle && (
            <div className="w-full h-px bg-slate-600 mt-0.5 mx-auto" style={{ maxWidth: '80%' }} />
          )}
        </div>
        {subtitle && (
          <div style={{ fontSize: `${(component.subtitleStyle?.fontSize ?? 10)}pt`, color: '#334155' }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
});
