'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import { memo, useMemo } from 'react';

interface Props {
  pageId: string;
}

/**
 * Renders a visual bounding box around all selected components on a specific page.
 * Provides professional feedback for multi-selection and layout grouping.
 */
export const SelectionOverlay = memo(function SelectionOverlay({ pageId }: Props) {
  const selectedIds = useDesignerStore((state) => state.selectedComponentIds);
  const schema = useDesignerStore((state) => state.schema);
  const zoom = useDesignerStore((state) => state.zoom);

  const bounds = useMemo(() => {
    if (selectedIds.length <= 1) return null;

    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    let maxY = Number.MIN_VALUE;
    let found = false;

    // Helper to calculate absolute Y based on zone
    const getAbsY = (c: any, zoneKey: string) => {
      const zoneOffset = LayoutEngine.calculateZoneOffset(zoneKey, schema, pageId);
      return (c.y || 0) + zoneOffset;
    };

    // Check Global Zones
    for (const key of ['header', 'footer'] as const) {
      const zone = schema.zones[key];
      for (const c of zone.components) {
        if (selectedIds.includes(c.id)) {
          const absY = getAbsY(c, key);
          minX = Math.min(minX, c.x || 0);
          minY = Math.min(minY, absY);
          maxX = Math.max(maxX, (c.x || 0) + (c.width || 40));
          maxY = Math.max(maxY, absY + (c.height || 10));
          found = true;
        }
      }
    }

    // Check Page Body
    const page = schema.pages.find((p) => p.id === pageId);
    if (page) {
      for (const c of page.body.components) {
        if (selectedIds.includes(c.id)) {
          const absY = getAbsY(c, 'body');
          minX = Math.min(minX, c.x || 0);
          minY = Math.min(minY, absY);
          maxX = Math.max(maxX, (c.x || 0) + (c.width || 40));
          maxY = Math.max(maxY, absY + (c.height || 10));
          found = true;
        }
      }
    }

    if (!found) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [selectedIds, schema, pageId]);

  if (!bounds) return null;

  const left = LayoutEngine.mmToPx(bounds.x);
  const top = LayoutEngine.mmToPx(bounds.y);
  const width = LayoutEngine.mmToPx(bounds.width);
  const height = LayoutEngine.mmToPx(bounds.height);

  return (
    <div
      className="absolute border border-[var(--accent)]/40 pointer-events-none z-[40] bg-[var(--accent)]/5"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        boxShadow: '0 0 0 1px var(--accent-glow)',
      }}
    >
      {/* Dimension Badge */}
      <div
        className="absolute -top-6 left-0 bg-[var(--accent)] text-[9px] text-white px-1.5 py-0.5 rounded-sm font-bold shadow-lg flex items-center gap-1.5 whitespace-nowrap"
        style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'bottom left' }}
      >
        <span className="opacity-70 uppercase tracking-tighter">Selection</span>
        <span className="font-black tabular-nums">
          {bounds.width.toFixed(1)} <span className="opacity-50 text-[7px]">mm</span>
          <span className="mx-1 opacity-30">×</span>
          {bounds.height.toFixed(1)} <span className="opacity-50 text-[7px]">mm</span>
        </span>
      </div>

      {/* Corner Accents */}
      <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-[var(--accent)]" />
      <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-[var(--accent)]" />
      <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-[var(--accent)]" />
      <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-[var(--accent)]" />
    </div>
  );
});
