import type { ColumnLayoutComponent } from '@/types/schema';
import { ComponentPreview } from '../ComponentPreview';

interface Props {
  component: ColumnLayoutComponent;
  pageIndex?: number;
  totalPages?: number;
}

/**
 * Converts a column width string from the schema into a valid CSS grid column value.
 * Handles: "1fr" → "1fr", "60mm" → "60mm", "30%" → "30%", "auto" → "auto"
 */
function toCssGridWidth(w: string): string {
  if (!w) return '1fr';
  // Already valid CSS fr unit
  if (w.endsWith('fr')) return w;
  // mm, cm, pt, px, % — pass through directly (CSS supports mm natively)
  if (/^\d+(\.\d+)?(mm|cm|pt|px|%)$/.test(w)) return w;
  // "auto"
  if (w === 'auto') return 'auto';
  // Fallback: treat as fr
  return '1fr';
}

export function ColumnLayoutPreview({ component, pageIndex, totalPages }: Props) {
  const gap = component.gap ?? '10mm';

  const gridTemplateColumns = component.columns.map((c) => toCssGridWidth(c.width)).join(' ');

  return (
    <div
      className="w-full h-full"
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap,
      }}
    >
      {component.columns.map((col, colIdx) => (
        <div key={colIdx} className="flex flex-col relative overflow-hidden" style={{ gap: '0px' }}>
          {col.components.map((child) => {
            // For children inside a column, we render their preview
            // at full column width (ignoring the child's absolute x/width
            // since the grid cell determines the available space).
            const isText = child.type === 'text';
            return (
              <div
                key={child.id}
                className="relative w-full"
                style={{
                  height: isText ? 'auto' : child.height ? `${child.height}mm` : 'auto',
                  minHeight: '2mm',
                }}
              >
                <ComponentPreview
                  component={child}
                  pageIndex={pageIndex}
                  totalPages={totalPages}
                  autoHeight={isText}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
