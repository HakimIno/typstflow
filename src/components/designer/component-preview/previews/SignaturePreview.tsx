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

  return (
    <div className="w-full h-full flex gap-2">
      {slots.map((slot) => (
        <div key={slot.id} className="flex-1 flex flex-col justify-end gap-0.5">
          <div
            style={{
              borderBottomWidth: 1,
              borderBottomColor: lineColor,
              borderBottomStyle: borderStyle,
              marginBottom: 2,
            }}
          />
          <span style={{ fontSize: labelSize, color: labelColor, lineHeight: 1.3 }}>
            {slot.label}
          </span>
          {showName && (
            <span style={{ fontSize: labelSize - 1, color: labelColor, opacity: 0.7, lineHeight: 1.3 }}>
              {slot.nameLabel ?? '(......................)'}
            </span>
          )}
          {showDate && (
            <span style={{ fontSize: labelSize - 1, color: labelColor, opacity: 0.7, lineHeight: 1.3 }}>
              {slot.dateLabel ?? 'Date: ___/___/______'}
            </span>
          )}
        </div>
      ))}
    </div>
  );
});
