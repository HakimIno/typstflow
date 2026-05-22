import type { RectangleComponent } from '@/types/schema';
import { memo } from 'react';

interface RectanglePreviewProps {
  component: RectangleComponent;
}

export const RectanglePreview = memo(function RectanglePreview({
  component,
}: RectanglePreviewProps) {
  const borderStyle =
    component.strokeStyle === 'dashed'
      ? 'dashed'
      : component.strokeStyle === 'dotted'
        ? 'dotted'
        : 'solid';

  const hasBorder = !!(component.strokeColor || component.strokeWidth);

  return (
    <div
      className="w-full h-full"
      style={{
        backgroundColor: component.fill ?? 'transparent',
        // CSS supports pt and mm units directly — no manual conversion needed
        borderWidth: hasBorder ? (component.strokeWidth ?? '1pt') : 0,
        borderColor: hasBorder ? (component.strokeColor ?? '#000000') : 'transparent',
        borderStyle: hasBorder ? borderStyle : 'none',
        // CSS mm unit matches LayoutEngine.mmToPx at 96 DPI exactly
        borderRadius: component.radius ?? 0,
        boxSizing: 'border-box',
      }}
    />
  );
});
