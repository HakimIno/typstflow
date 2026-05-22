import type { RectangleComponent } from '@/types/schema';
import { memo } from 'react';

interface RectanglePreviewProps {
  component: RectangleComponent;
}

const toPx = (val?: string): number => {
  if (!val) return 0;
  const n = parseFloat(val);
  if (isNaN(n)) return 0;
  if (val.endsWith('mm')) return n * 3.78;
  if (val.endsWith('cm')) return n * 37.8;
  if (val.endsWith('pt')) return n * 1.333;
  if (val.endsWith('in')) return n * 96;
  return n;
};

export const RectanglePreview = memo(function RectanglePreview({
  component,
}: RectanglePreviewProps) {
  const hasBorder = !!(component.strokeColor || component.strokeWidth);
  const strokePx = hasBorder ? toPx(component.strokeWidth ?? '1pt') : 0;
  const borderStyle =
    component.strokeStyle === 'dashed'
      ? 'dashed'
      : component.strokeStyle === 'dotted'
        ? 'dotted'
        : 'solid';

  const hasPerCorner = !!(
    component.radiusTopLeft ||
    component.radiusTopRight ||
    component.radiusBottomLeft ||
    component.radiusBottomRight
  );

  const radiusStyle = hasPerCorner
    ? {
        borderTopLeftRadius: toPx(component.radiusTopLeft ?? component.radius),
        borderTopRightRadius: toPx(component.radiusTopRight ?? component.radius),
        borderBottomLeftRadius: toPx(component.radiusBottomLeft ?? component.radius),
        borderBottomRightRadius: toPx(component.radiusBottomRight ?? component.radius),
      }
    : { borderRadius: toPx(component.radius) };

  const sides = component.strokeSides ?? { top: true, right: true, bottom: true, left: true };
  const borderWidthStyle = !hasBorder
    ? { borderWidth: 0 }
    : component.strokeSides
      ? {
          borderTopWidth: sides.top ? strokePx : 0,
          borderRightWidth: sides.right ? strokePx : 0,
          borderBottomWidth: sides.bottom ? strokePx : 0,
          borderLeftWidth: sides.left ? strokePx : 0,
        }
      : { borderWidth: strokePx };

  return (
    <div
      className="w-full h-full"
      style={{
        backgroundColor: component.fill ?? 'transparent',
        borderColor: component.strokeColor ?? 'transparent',
        borderStyle: hasBorder ? borderStyle : undefined,
        ...borderWidthStyle,
        ...radiusStyle,
        padding: component.inset ? toPx(component.inset) : undefined,
        boxSizing: 'border-box',
      }}
    />
  );
});
