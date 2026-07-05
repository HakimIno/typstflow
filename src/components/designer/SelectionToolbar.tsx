'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { parseTypstUnit } from '@/lib/utils/units';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import {
  AlignCenter,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Columns2,
  Copy,
  Layers,
  Rows2,
  Trash2,
} from 'lucide-react';
import { memo, useMemo, useRef, useState } from 'react';
import {
  FloatingToolbar,
  FloatingToolbarButton,
  FloatingToolbarFlyout,
} from './toolbar/FloatingToolbar';
import { ToolbarSeparator } from './toolbar/ToolbarSeparator';

export const SelectionToolbar = memo(function SelectionToolbar({
  pageId,
}: {
  pageId?: string;
}) {
  const selectedComponentIds = useDesignerStore((state) => state.selectedComponentIds);
  const schema = useDesignerStore((state) => state.schema);
  const _updateComponents = useDesignerStore((state) => state.updateComponents);
  const removeComponents = useDesignerStore((state) => state.removeComponents);
  const zoom = useDesignerStore((state) => state.zoom);
  const bringToFrontMany = useDesignerStore((state) => state.bringToFrontMany);
  const sendToBackMany = useDesignerStore((state) => state.sendToBackMany);
  const moveUpMany = useDesignerStore((state) => state.moveUpMany);
  const moveDownMany = useDesignerStore((state) => state.moveDownMany);
  const duplicateSelected = useDesignerStore((state) => state.duplicateSelected);
  const alignSelected = useDesignerStore((state) => state.alignSelected);
  const distributeSelected = useDesignerStore((state) => state.distributeSelected);
  const stackSelected = useDesignerStore((state) => state.stackSelected);
  const alignToPage = useDesignerStore((state) => state.alignToPage);
  const [stackGap, setStackGap] = useState(5);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  const selectedComponents = useMemo(() => {
    if (selectedComponentIds.length === 0) return [];

    const allComps: any[] = [];
    // Check Global Zones
    for (const key of ['header', 'footer'] as ('header' | 'footer')[]) {
      const zone = schema.zones[key];
      for (const c of zone.components) {
        if (selectedComponentIds.includes(c.id)) {
          const zoneOffset = LayoutEngine.calculateZoneOffset(key, schema, pageId);
          allComps.push({ ...c, absY: (c.y ?? 0) + zoneOffset, zoneKey: key });
        }
      }
    }

    // Check Page Body
    const page = schema.pages.find((p) => p.id === pageId);
    if (page) {
      for (const c of page.body.components) {
        if (selectedComponentIds.includes(c.id)) {
          const zoneOffset = LayoutEngine.calculateZoneOffset('body', schema, pageId);
          allComps.push({ ...c, absY: (c.y ?? 0) + zoneOffset, zoneKey: 'body' });
        }
      }
    }

    return allComps;
  }, [selectedComponentIds, schema, pageId]);

  // Page content area bounds (inside margins)
  const _pageBounds = useMemo(() => {
    const { width, height } = getPaperDimensions(schema.page.size, schema.page.orientation);
    const mTop = parseTypstUnit(schema.page.margin.top);
    const mBottom = parseTypstUnit(schema.page.margin.bottom);
    const mLeft = parseTypstUnit(schema.page.margin.left);
    const mRight = parseTypstUnit(schema.page.margin.right);
    return {
      x: mLeft,
      y: mTop,
      width: width - mLeft - mRight,
      height: height - mTop - mBottom,
      pageWidth: width,
      pageHeight: height,
    };
  }, [schema.page]);

  // Calculate selection bounds (safe with empty array — guarded by early return below)
  const minX =
    selectedComponents.length > 1 ? Math.min(...selectedComponents.map((c) => c.x ?? 0)) : 0;
  const maxX =
    selectedComponents.length > 1
      ? Math.max(...selectedComponents.map((c) => (c.x ?? 0) + (c.width ?? 20)))
      : 0;
  const minY =
    selectedComponents.length > 1 ? Math.min(...selectedComponents.map((c) => c.absY ?? 0)) : 0;
  const maxY =
    selectedComponents.length > 1
      ? Math.max(
          ...selectedComponents.map((c) => {
            const h = c.height ?? (c.type === 'text' ? 5 : 10);
            return (c.absY ?? 0) + h;
          })
        )
      : 0;

  const selectionWidth = maxX - minX;
  const _selectionHeight = maxY - minY;

  const isNearTop = minY < 20; // Flip if within 20mm of the top
  const baseTop = isNearTop
    ? LayoutEngine.mmToPx(maxY) + 12 // Below selection
    : LayoutEngine.mmToPx(minY) - 56; // Above selection

  const baseLeft = LayoutEngine.mmToPx(minX + selectionWidth / 2);

  // Ref needed to set data-toolbar attribute; CSS vars set directly by ComponentWrapper in same rAF
  const toolbarRef = useRef<HTMLDivElement>(null);

  if (selectedComponents.length <= 1) return null;

  const isMulti = selectedComponents.length > 1;

  return (
    <FloatingToolbar
      ref={toolbarRef}
      data-toolbar="true"
      className="absolute z-[1000] transition-transform duration-200"
      style={{
        top: `${baseTop}px`,
        left: `${baseLeft}px`,
        transform: `translateX(calc(-50% + var(--toolbar-drag-dx, 0px))) translateY(var(--toolbar-drag-dy, 0px)) scale(${Math.min(1.2, 1 / zoom)})`,
        transformOrigin: isNearTop ? 'top center' : 'bottom center',
      }}
    >
      {/* Alignment Group */}
      <FloatingToolbarFlyout
        icon={AlignEndVertical}
        isActive={hoveredGroup === 'align'}
        onHover={(v) => setHoveredGroup(v ? 'align' : null)}
      >
        <div className="flex items-center gap-0.5 p-0.5">
          <FloatingToolbarButton
            icon={AlignLeft}
            title={isMulti ? 'Align Left' : 'Align Left to Page'}
            onClick={() =>
              isMulti ? alignSelected('left', pageId) : alignToPage('page-left', pageId)
            }
          />
          <FloatingToolbarButton
            icon={AlignCenter}
            title={isMulti ? 'Center Horizontally' : 'Center H on Page'}
            onClick={() =>
              isMulti ? alignSelected('center', pageId) : alignToPage('page-center-h', pageId)
            }
          />
          <FloatingToolbarButton
            icon={AlignRight}
            title={isMulti ? 'Align Right' : 'Align Right to Page'}
            onClick={() =>
              isMulti ? alignSelected('right', pageId) : alignToPage('page-right', pageId)
            }
          />
          <ToolbarSeparator tone="dark" className="mx-1" />
          <FloatingToolbarButton
            icon={AlignStartVertical}
            title={isMulti ? 'Align Top' : 'Align Top to Page'}
            onClick={() =>
              isMulti ? alignSelected('top', pageId) : alignToPage('page-top', pageId)
            }
          />
          <FloatingToolbarButton
            icon={AlignCenterVertical}
            title={isMulti ? 'Center Vertically' : 'Center V on Page'}
            onClick={() =>
              isMulti ? alignSelected('middle', pageId) : alignToPage('page-center-v', pageId)
            }
          />
          <FloatingToolbarButton
            icon={AlignEndVertical}
            title={isMulti ? 'Align Bottom' : 'Align Bottom to Page'}
            onClick={() =>
              isMulti ? alignSelected('bottom', pageId) : alignToPage('page-bottom', pageId)
            }
          />
        </div>
      </FloatingToolbarFlyout>

      <ToolbarSeparator tone="dark" />

      {/* Spacing & Distribution Group */}
      {isMulti && (
        <>
          <FloatingToolbarFlyout
            icon={ArrowUpDown}
            isActive={hoveredGroup === 'spacing'}
            onHover={(v) => setHoveredGroup(v ? 'spacing' : null)}
          >
            <div className="p-2 min-w-[160px] flex flex-col gap-2 relative">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-black text-blue-400 tabular-nums">{stackGap}</span>
                  <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-tighter">
                    mm
                  </span>
                </div>
                <div className="flex gap-0.5">
                  {[0, 5, 10].map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setStackGap(v)}
                      className={clsx(
                        'text-[8px] px-1 py-0.5 rounded transition-all font-bold',
                        stackGap === v
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/5 text-zinc-500 hover:bg-white/10'
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="50"
                step="0.5"
                value={stackGap}
                onChange={(e) => setStackGap(Number.parseFloat(e.target.value))}
                className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-blue-500"
              />

              <div className="flex items-center justify-center gap-1 mt-1">
                <FloatingToolbarButton
                  icon={Rows2}
                  title="Stack V"
                  onClick={() => stackSelected('stack-v', stackGap, pageId)}
                />
                <FloatingToolbarButton
                  icon={Columns2}
                  title="Stack H"
                  onClick={() => stackSelected('stack-h', stackGap, pageId)}
                />
                <ToolbarSeparator tone="dark" />
                <FloatingToolbarButton
                  icon={AlignVerticalDistributeCenter}
                  title="Dist V"
                  onClick={() => distributeSelected('dist-v', pageId)}
                />
                <FloatingToolbarButton
                  icon={AlignHorizontalDistributeCenter}
                  title="Dist H"
                  onClick={() => distributeSelected('dist-h', pageId)}
                />
              </div>
            </div>
          </FloatingToolbarFlyout>
          <ToolbarSeparator tone="dark" />
        </>
      )}

      {/* Layering Group */}
      <FloatingToolbarFlyout
        icon={Layers}
        isActive={hoveredGroup === 'layer'}
        onHover={(v) => setHoveredGroup(v ? 'layer' : null)}
      >
        <div className="flex items-center gap-0.5 p-0.5">
          <FloatingToolbarButton
            icon={ChevronsUp}
            title="Front"
            onClick={() => bringToFrontMany(selectedComponentIds)}
          />
          <FloatingToolbarButton
            icon={ChevronUp}
            title="Forward"
            onClick={() => moveUpMany(selectedComponentIds)}
          />
          <FloatingToolbarButton
            icon={ChevronDown}
            title="Backward"
            onClick={() => moveDownMany(selectedComponentIds)}
          />
          <FloatingToolbarButton
            icon={ChevronsDown}
            title="Back"
            onClick={() => sendToBackMany(selectedComponentIds)}
          />
        </div>
      </FloatingToolbarFlyout>

      <ToolbarSeparator tone="dark" />

      {/* Duplicate Section */}
      <FloatingToolbarButton icon={Copy} title="Duplicate" onClick={() => duplicateSelected()} />

      {/* Destruction Section */}
      <div className="flex items-center gap-0.5 border-l border-white/10 ml-0.5 pl-0.5">
        <FloatingToolbarButton
          icon={Trash2}
          title="Delete"
          onClick={() => removeComponents(selectedComponentIds)}
          className="hover:bg-red-500/20 text-red-500/70 hover:text-red-400"
        />
      </div>
    </FloatingToolbar>
  );
});
