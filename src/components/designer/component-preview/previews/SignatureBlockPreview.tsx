'use client';

import { useAutoFitHeight } from '@/hooks/use-auto-fit-height';
import { resolveBindings } from '@/lib/utils/json-path';
import type { SignatureBlockComponent } from '@/types/schema';
import { memo, useRef } from 'react';

interface Props {
  component: SignatureBlockComponent;
  sampleData?: Record<string, unknown>;
}

export const SignatureBlockPreview = memo(function SignatureBlockPreview({
  component,
  sampleData,
}: Props) {
  const slots = component.slots ?? [];
  const variant = component.variant ?? 'thai-form';
  const lineColor = component.lineColor ?? '#334155';
  const labelSize = component.labelStyle?.fontSize ?? 8;
  const borderStyle =
    component.slots[0]?.lineStyle === 'dashed'
      ? 'dashed'
      : component.slots[0]?.lineStyle === 'solid'
        ? 'solid'
        : 'dotted';

  const ref = useRef<HTMLDivElement>(null);
  useAutoFitHeight(ref, component.id);

  return (
    <div ref={ref} className="w-full flex gap-2">
      {slots.map((slot) => {
        const role = resolveBindings(slot.role, sampleData) || slot.role;
        const name = slot.name
          ? resolveBindings(slot.name, sampleData)
          : '(......................)';
        const date = slot.date
          ? resolveBindings(slot.date, sampleData)
          : 'วันที่ ___/___/______';

        return (
          <div key={slot.id} className="flex-1 flex flex-col gap-0.5">
            {component.showDate !== false && component.datePosition !== 'right' && (
              <span style={{ fontSize: labelSize, color: lineColor }}>{date}</span>
            )}
            <div
              style={{
                borderBottomWidth: 1,
                borderBottomColor: lineColor,
                borderBottomStyle: borderStyle,
                marginTop: 4,
                marginBottom: 2,
              }}
            />
            {variant === 'thai-form' ? (
              <>
                <span style={{ fontSize: labelSize, color: lineColor }}>{name}</span>
                <span style={{ fontSize: labelSize, color: lineColor }}>{role}</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: labelSize, color: lineColor }}>{role}</span>
                <span style={{ fontSize: labelSize, color: lineColor, opacity: 0.8 }}>{name}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
});
