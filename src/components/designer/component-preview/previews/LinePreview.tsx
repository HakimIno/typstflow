import type { ComponentNode, LineComponent } from '@/types/schema';
import { memo } from 'react';

interface LinePreviewProps {
  component: ComponentNode;
}

export const LinePreview = memo(function LinePreview({ component }: LinePreviewProps) {
  const line = component as LineComponent;
  const thickness = line.thickness || '1pt';
  const color = line.color || '#000000';
  const lineStyle = line.style || 'solid';
  const orientation = line.orientation || 'horizontal';
  const cap = line.cap || 'butt';

  // CSS border style mapping
  const borderStyle = lineStyle === 'dotted' ? 'dotted' : lineStyle === 'dashed' ? 'dashed' : 'solid';

  if (orientation === 'vertical') {
    return (
      <div className="w-full h-full flex flex-row justify-center">
        <div
          style={{
            borderLeftWidth: thickness,
            borderLeftColor: color,
            borderLeftStyle: borderStyle,
            height: '100%',
            borderRadius: cap === 'round' ? '999px' : '0',
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col justify-center">
      <div
        style={{
          borderTopWidth: thickness,
          borderTopColor: color,
          borderTopStyle: borderStyle,
          width: '100%',
          borderRadius: cap === 'round' ? '999px' : '0',
        }}
      />
    </div>
  );
});

