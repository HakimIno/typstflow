'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { parseTypstUnit } from '@/lib/utils/units';
import type { ComponentNode, LayoutSchema, Zone } from '@/types/schema';
import { memo, useState } from 'react';

const ZOOM_DEFAULT = 0.9;
const COMPONENT_COLORS: Record<string, string> = {
  text: 'bg-blue-100 border-blue-300 text-blue-800',
  table: 'bg-emerald-100 border-emerald-300 text-emerald-800',
  image: 'bg-amber-100 border-amber-300 text-amber-800',
  line: 'bg-slate-100 border-slate-300 text-slate-700',
  spacer: 'bg-slate-50 border-dashed border-slate-200 text-slate-400',
  barcode: 'bg-zinc-100 border-zinc-300 text-zinc-800',
  qr: 'bg-zinc-100 border-zinc-300 text-zinc-800',
  'summary-box': 'bg-purple-100 border-purple-300 text-purple-800',
  columns: 'bg-cyan-100 border-cyan-300 text-cyan-800',
  repeater: 'bg-orange-100 border-orange-300 text-orange-800',
  rectangle: 'bg-rose-100 border-rose-300 text-rose-800',
  checklist: 'bg-lime-100 border-lime-300 text-lime-800',
  signature: 'bg-violet-100 border-violet-300 text-violet-800',
  'page-number': 'bg-slate-100 border-slate-300 text-slate-700',
  'page-break-indicator': 'bg-slate-50 border-dashed border-slate-300 text-slate-400',
};

const ComponentBlock = memo(function ComponentBlock({
  component,
  zoom,
}: {
  component: ComponentNode;
  zoom: number;
}) {
  const x = LayoutEngine.mmToPx(component.x ?? 0) * zoom;
  const y = LayoutEngine.mmToPx(component.y ?? 0) * zoom;
  const w = LayoutEngine.mmToPx(component.width ?? 30) * zoom;
  const h = LayoutEngine.mmToPx(component.height ?? 10) * zoom;
  const colorClass = COMPONENT_COLORS[component.type] ?? 'bg-slate-100 border-slate-300';
  const label =
    component.type === 'text' && 'content' in component
      ? ((component as { content?: string }).content?.slice(0, 40) ?? component.type)
      : component.type;

  return (
    <div
      className={`absolute border rounded-sm overflow-hidden flex items-center justify-center text-[10px] font-medium select-none ${colorClass}`}
      style={{ left: x, top: y, width: w, height: Math.max(h, 12 * zoom) }}
      title={component.type}
    >
      <span className="truncate px-1 opacity-80">{label}</span>
    </div>
  );
});

function ZoneLayer({
  zone,
  zoom,
  offsetY,
}: {
  zone: Zone;
  zoom: number;
  offsetY: number;
}) {
  return (
    <>
      {zone.components.map((comp) => (
        <ComponentBlock
          key={comp.id}
          component={{ ...comp, y: (comp.y ?? 0) + offsetY } as ComponentNode}
          zoom={zoom}
        />
      ))}
    </>
  );
}

export const ReadOnlyCanvas = memo(function ReadOnlyCanvas({
  schema,
}: {
  schema: LayoutSchema;
}) {
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);

  const { width: pageW, height: pageH } = getPaperDimensions(
    schema.page.size,
    schema.page.orientation
  );
  const marginTop = parseTypstUnit(schema.page.margin.top);
  const marginBottom = parseTypstUnit(schema.page.margin.bottom);
  const marginLeft = parseTypstUnit(schema.page.margin.left);
  const marginRight = parseTypstUnit(schema.page.margin.right);

  const pageWpx = LayoutEngine.mmToPx(pageW);
  const pageHpx = LayoutEngine.mmToPx(pageH);

  const headerH =
    schema.zones.header.components.length > 0
      ? parseTypstUnit(schema.zones.header.minHeight ?? '20mm')
      : 0;
  const footerH =
    schema.zones.footer.components.length > 0
      ? parseTypstUnit(schema.zones.footer.minHeight ?? '15mm')
      : 0;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Zoom controls */}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
          className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded text-white/70"
        >
          −
        </button>
        <span className="text-xs text-white/50 w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
          className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded text-white/70"
        >
          +
        </button>
      </div>

      {/* Pages */}
      {schema.pages.map((page, pIdx) => (
        <div
          key={page.id}
          className="relative bg-white shadow-2xl rounded flex-shrink-0"
          style={{ width: pageWpx * zoom, height: pageHpx * zoom }}
        >
          {/* Margin guide */}
          <div
            className="absolute border border-blue-200 border-dashed pointer-events-none z-10"
            style={{
              top: LayoutEngine.mmToPx(marginTop) * zoom,
              bottom: LayoutEngine.mmToPx(marginBottom) * zoom,
              left: LayoutEngine.mmToPx(marginLeft) * zoom,
              right: LayoutEngine.mmToPx(marginRight) * zoom,
            }}
          />

          {/* Page label */}
          <div className="absolute -top-5 left-0 text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
            Page {pIdx + 1}
          </div>

          {/* Header zone */}
          {schema.zones.header.components.length > 0 && (
            <ZoneLayer zone={schema.zones.header} zoom={zoom} offsetY={0} />
          )}

          {/* Body zone */}
          <ZoneLayer zone={page.body} zoom={zoom} offsetY={headerH} />

          {/* Footer zone */}
          {schema.zones.footer.components.length > 0 && (
            <ZoneLayer
              zone={schema.zones.footer}
              zoom={zoom}
              offsetY={pageH - footerH - marginBottom}
            />
          )}
        </div>
      ))}
    </div>
  );
});
