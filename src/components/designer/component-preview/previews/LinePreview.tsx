import type { ComponentNode } from '@/types/schema';
import { memo } from 'react';

interface LinePreviewProps {
  component: ComponentNode;
}

export const LinePreview = memo(function LinePreview({ component }: LinePreviewProps) {
  const thickness = (component as any).thickness || '1pt';
  const color = (component as any).color || '#0f172a';
  const lineStyle = (component as any).style || 'solid';

  return (
    <div className="w-full h-full flex flex-col justify-center">
      <div
        style={{
          borderTopWidth: thickness,
          borderTopColor: color,
          borderTopStyle:
            lineStyle === 'dotted' ? 'dotted' : lineStyle === 'dashed' ? 'dashed' : 'solid',
        }}
      />
    </div>
  );
});
