
'use client';

import { resolveBindings } from '@/lib/utils/json-path';
import { buildPreviewFontStack } from '@/lib/utils/preview-fonts';
import { parseTypstUnit } from '@/lib/utils/units';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import type { FillInComponent } from '@/types/schema';
import { memo } from 'react';

interface Props {
  component: FillInComponent;
  sampleData?: Record<string, unknown>;
}

export const FillInPreview = memo(function FillInPreview({ component, sampleData }: Props) {
  const segments = component.segments ?? [];
  const marker = component.marker ?? 'none';
  const markerSize = component.markerSize ?? 8;
  const lineStyle = component.lineStyle ?? 'dotted';
  const lineColor = component.lineColor ?? '#111111';
  const fontSize = component.style?.fontSize ?? 9;
  const color = component.style?.color ?? '#111111';
  const fontStack = buildPreviewFontStack(component.style?.fontFamily ?? 'Sarabun');
  const gapPx = LayoutEngine.mmToPx(parseTypstUnit(component.gap ?? '1mm'));

  return (
    <div
      className="w-full h-full flex items-end"
      style={{ gap: gapPx, fontFamily: fontStack, fontSize: `${fontSize}pt`, color }}
    >
      {marker !== 'none' && (
        <span
          className="inline-flex items-center justify-center shrink-0 self-center"
          style={{
            width: `${markerSize}pt`,
            height: `${markerSize}pt`,
            border: '0.8px solid #111111',
            borderRadius: marker === 'circle' ? '50%' : 2,
            fontSize: `${Math.max(4, markerSize - 2)}pt`,
            lineHeight: 1,
          }}
        >
          {component.checked ? '✓' : ''}
        </span>
      )}
      {segments.map((seg) => {
        if (seg.kind === 'blank') {
          const value = seg.text ? resolveBindings(seg.text, sampleData) : '';
          const isFr = !seg.width || seg.width.endsWith('fr');
          const widthPx = isFr
            ? undefined
            : LayoutEngine.mmToPx(parseTypstUnit(seg.width ?? '20mm'));
          return (
            <span
              key={seg.id}
              className="inline-block"
              style={{
                width: widthPx,
                flex: isFr ? 1 : undefined,
                borderBottom: `1px ${lineStyle} ${lineColor}`,
                textAlign: seg.align ?? 'center',
                minWidth: 12,
                lineHeight: 1.2,
              }}
            >
              {value || ' '}
            </span>
          );
        }
        return (
          <span key={seg.id} className="whitespace-nowrap" style={{ lineHeight: 1.2 }}>
            {seg.text ? resolveBindings(seg.text, sampleData) : ''}
          </span>
        );
      })}
    </div>
  );
});
