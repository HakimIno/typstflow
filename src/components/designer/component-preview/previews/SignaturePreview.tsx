import { LayoutEngine } from '@/lib/engine/layout-engine';
import type { SignatureComponent } from '@/types/schema';
import { memo } from 'react';

interface SignaturePreviewProps {
  component: SignatureComponent;
}

export const SignaturePreview = memo(function SignaturePreview({ component }: SignaturePreviewProps) {
  const slots = component.slots ?? [];
  const showName = component.showNameLine !== false;
  const showDate = component.showDateLine !== false;
  const lineColor = component.lineColor ?? '#000000';
  const borderStyle =
    component.lineStyle === 'dashed'
      ? 'dashed'
      : component.lineStyle === 'dotted'
        ? 'dotted'
        : 'solid';

  const labelSize = component.labelStyle?.fontSize ?? 8;
  const labelColor = component.labelStyle?.color ?? '#000000';
  // Match Typst column-gutter: 5mm exactly
  const gapPx = LayoutEngine.mmToPx(5);

  return (
    <div className="w-full h-full flex" style={{ gap: gapPx }}>
      {slots.map((slot) => (
        <div key={slot.id} className="flex-1 flex flex-col justify-end" style={{ minWidth: 0 }}>
          {/* Signature line */}
          <div
            style={{
              borderBottomWidth: 1,
              borderBottomColor: lineColor,
              borderBottomStyle: borderStyle,
              marginBottom: 2,
            }}
          />
          {/* Title label */}
          <span
            style={{
              fontSize: labelSize,
              color: labelColor,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {slot.label}
          </span>
          {/* Name */}
          {showName && (
            <span
              style={{
                fontSize: Math.max(labelSize - 1, 6),
                color: labelColor,
                opacity: 0.65,
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {slot.nameLabel ?? '(......................)'}
            </span>
          )}
          {/* Date */}
          {showDate && (
            <span
              style={{
                fontSize: Math.max(labelSize - 1, 6),
                color: labelColor,
                opacity: 0.65,
                lineHeight: 1.3,
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {slot.dateLabel ?? 'Date: ___/___/______'}
            </span>
          )}
        </div>
      ))}
    </div>
  );
});
