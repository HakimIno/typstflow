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
        borderWidth: hasBorder ? (component.strokeWidth?.replace('pt', 'px') ?? '1px') : 0,
        borderColor: component.strokeColor ?? 'transparent',
        borderStyle,
        borderRadius: component.radius?.replace('mm', 'px') ?? 0,
        boxSizing: 'border-box',
      }}
    />
  );
});
