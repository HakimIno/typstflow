'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { parseTypstUnit } from '@/lib/utils/units';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { Icon } from '@iconify/react';
import { memo, useMemo, useRef } from 'react';
import type { ComponentNode } from '@/types/schema';

export const SelectionToolbar = memo(function SelectionToolbar({
  pageId,
}: {
  pageId?: string;
}) {
  const selectedComponentIds = useDesignerStore((state) => state.selectedComponentIds);
  const schema = useDesignerStore((state) => state.schema);
  const updateComponents = useDesignerStore((state) => state.updateComponents);
  const removeComponents = useDesignerStore((state) => state.removeComponents);
  const zoom = useDesignerStore((state) => state.zoom);
  const bringToFrontMany = useDesignerStore((state) => state.bringToFrontMany);
  const sendToBackMany = useDesignerStore((state) => state.sendToBackMany);
  const moveUpMany = useDesignerStore((state) => state.moveUpMany);
  const moveDownMany = useDesignerStore((state) => state.moveDownMany);
  const duplicateSelected = useDesignerStore((state) => state.duplicateSelected);


  const selectedComponents = useMemo(() => {
    if (selectedComponentIds.length === 0) return [];

    const allComps: any[] = [];
    // Check Global Zones
    for (const key of ['header', 'footer'] as ('header' | 'footer')[]) {
      const zone = schema.zones[key];
      for (const c of zone.components) {
        if (selectedComponentIds.includes(c.id)) {
          const zoneOffset = LayoutEngine.calculateZoneOffset(key, schema, pageId);
          allComps.push({ ...c, absY: (c.y || 0) + zoneOffset, zoneKey: key });
        }
      }
    }

    // Check Page Body
    const page = schema.pages.find((p) => p.id === pageId);
    if (page) {
      for (const c of page.body.components) {
        if (selectedComponentIds.includes(c.id)) {
          const zoneOffset = LayoutEngine.calculateZoneOffset('body', schema, pageId);
          allComps.push({ ...c, absY: (c.y || 0) + zoneOffset, zoneKey: 'body' });
        }
      }
    }

    return allComps;
  }, [selectedComponentIds, schema, pageId]);

  // Page content area bounds (inside margins)
  const pageBounds = useMemo(() => {
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
  const minX = selectedComponents.length > 1 ? Math.min(...selectedComponents.map((c) => c.x || 0)) : 0;
  const maxX = selectedComponents.length > 1 ? Math.max(...selectedComponents.map((c) => (c.x || 0) + (c.width || 20))) : 0;
  const minY = selectedComponents.length > 1 ? Math.min(...selectedComponents.map((c) => c.absY || 0)) : 0;
  const maxY = selectedComponents.length > 1 ? Math.max(...selectedComponents.map((c) => {
    const h = c.height || (c.type === 'text' ? 5 : 10);
    return (c.absY || 0) + h;
  })) : 0;

  const selectionWidth = maxX - minX;
  const selectionHeight = maxY - minY;

  // Base position (schema-derived, no drag offset)
  const baseTop = LayoutEngine.mmToPx(minY) - 40;
  const baseLeft = LayoutEngine.mmToPx(minX + selectionWidth / 2);

  // Ref needed to set data-toolbar attribute; CSS vars set directly by ComponentWrapper in same rAF
  const toolbarRef = useRef<HTMLDivElement>(null);

  if (selectedComponents.length <= 1) return null;

  const isMulti = selectedComponents.length > 1;

  // --- Alignment Handlers ---

  const handleAlignToPage = (type: string) => {
    const updatesMap: Record<string, Partial<ComponentNode>> = {};
    for (const comp of selectedComponents) {
      const updates: any = {};
      const cw = comp.width || 0;
      const ch = comp.height || 0;

      switch (type) {
        case 'page-left':
          updates.x = 0;
          break;
        case 'page-center-h':
          updates.x = (pageBounds.pageWidth - cw) / 2;
          break;
        case 'page-right':
          updates.x = pageBounds.pageWidth - cw;
          break;
        case 'page-top':
          updates.y = 0;
          break;
        case 'page-center-v':
          updates.y = (pageBounds.height - ch) / 2;
          break;
        case 'page-bottom':
          updates.y = pageBounds.height - ch;
          break;
        case 'page-center-both':
          updates.x = (pageBounds.pageWidth - cw) / 2;
          updates.y = (pageBounds.height - ch) / 2;
          break;
      }
      if (Object.keys(updates).length > 0) updatesMap[comp.id] = updates;
    }
    if (Object.keys(updatesMap).length > 0) updateComponents(updatesMap);
  };

  const handleAlignToSelection = (type: string) => {
    const updatesMap: Record<string, Partial<ComponentNode>> = {};

    if (type === 'dist-h') {
      const sorted = [...selectedComponents].sort((a, b) => (a.x || 0) - (b.x || 0));
      const totalCompsWidth = sorted.reduce((sum, c) => sum + (c.width || 0), 0);
      const gap = (selectionWidth - totalCompsWidth) / (sorted.length - 1);
      let currentX = minX;
      for (const comp of sorted) {
        updatesMap[comp.id] = { x: currentX };
        currentX += (comp.width || 0) + gap;
      }
    } else if (type === 'dist-v') {
      const sorted = [...selectedComponents].sort((a, b) => (a.absY || 0) - (b.absY || 0));
      const totalCompsHeight = sorted.reduce((sum, c) => sum + (c.height || (c.type === 'text' ? 5 : 10)), 0);
      const gap = (selectionHeight - totalCompsHeight) / (sorted.length - 1);
      let currentAbsY = minY;
      for (const comp of sorted) {
        const diff = currentAbsY - comp.absY;
        updatesMap[comp.id] = { y: (comp.y || 0) + diff };
        currentAbsY += (comp.height || 0) + gap;
      }
    } else if (type === 'stack-v') {
      const sorted = [...selectedComponents].sort((a, b) => (a.absY || 0) - (b.absY || 0));
      let currentAbsY = minY;
      const fixedGap = 5; // Increased to 5mm for better visibility
      for (const comp of sorted) {
        const diff = currentAbsY - comp.absY;
        updatesMap[comp.id] = { y: (comp.y || 0) + diff };
        // Use component height or fallback to 10mm (text) or 15mm (others)
        const h = comp.height || (comp.type === 'text' ? 10 : 15);
        currentAbsY += h + fixedGap;
      }
    } else if (type === 'stack-h') {
      const sorted = [...selectedComponents].sort((a, b) => (a.x || 0) - (b.x || 0));
      let currentX = minX;
      const fixedGap = 5; // 5mm gap
      for (const comp of sorted) {
        updatesMap[comp.id] = { x: currentX };
        const w = comp.width || (comp.type === 'text' ? 40 : 30);
        currentX += w + fixedGap;
      }
    } else {
      for (const comp of selectedComponents) {
        const updates: any = {};
        switch (type) {
          case 'left':
            updates.x = minX;
            break;
          case 'center':
            updates.x = minX + selectionWidth / 2 - (comp.width || 0) / 2;
            break;
          case 'right':
            updates.x = maxX - (comp.width || 0);
            break;
          case 'top':
            updates.y = (comp.y || 0) - (comp.absY - minY);
            break;
          case 'middle':
            updates.y = (comp.y || 0) + (minY + selectionHeight / 2 - (comp.absY + (comp.height || 0) / 2));
            break;
          case 'bottom':
            updates.y = (comp.y || 0) + (maxY - (comp.absY + (comp.height || 0)));
            break;
        }
        if (Object.keys(updates).length > 0) updatesMap[comp.id] = updates;
      }
    }

    if (Object.keys(updatesMap).length > 0) updateComponents(updatesMap);
  };

  return (
    <div
      ref={toolbarRef}
      data-toolbar="true"
      className="absolute z-[1000] flex items-center gap-1 bg-[var(--bg-surface)] backdrop-blur-2xl  p-0.5"
      style={{
        top: `${baseTop}px`,
        left: `${baseLeft}px`,
        transform: `translateX(calc(-50% + var(--toolbar-drag-dx, 0px))) translateY(var(--toolbar-drag-dy, 0px)) scale(${1 / zoom})`,
        transformOrigin: 'bottom center',
        borderRadius: '100px',
      }}
    >
      {/* Alignment Section */}
      <div className="flex items-center gap-1 px-1 border-r border-white/5">
        <ActionButton
          icon="solar:align-left-bold-duotone"
          title={isMulti ? "Align Left" : "Align Left to Page"}
          onClick={() => isMulti ? handleAlignToSelection('left') : handleAlignToPage('page-left')}
        />
        <ActionButton
          icon="solar:align-horizontal-center-bold-duotone"
          title={isMulti ? "Center Horizontally" : "Center H on Page"}
          onClick={() => isMulti ? handleAlignToSelection('center') : handleAlignToPage('page-center-h')}
        />
        <ActionButton
          icon="solar:align-right-bold-duotone"
          title={isMulti ? "Align Right" : "Align Right to Page"}
          onClick={() => isMulti ? handleAlignToSelection('right') : handleAlignToPage('page-right')}
        />
      </div>


      {/* Distribution & Stacking (Spacing) */}
      {isMulti && (
        <div className="flex items-center gap-1 px-1 border-r border-white/5">
          <ActionButton
            icon="solar:documents-minimalistic-bold-duotone"
            title="Stack Vertically (5mm gap)"
            onClick={() => handleAlignToSelection('stack-v')}
          />
        </div>
      )}

      {/* Z-Order Tools */}
      <div className="flex items-center gap-0.5 px-0.5 border-r border-white/5">
        <ActionButton
          icon="solar:double-alt-arrow-up-bold-duotone"
          title="Bring to Front"
          onClick={() => bringToFrontMany(selectedComponentIds)}
        />
        <ActionButton
          icon="solar:alt-arrow-up-bold-duotone"
          title="Bring Forward"
          onClick={() => moveUpMany(selectedComponentIds)}
        />
        <ActionButton
          icon="solar:alt-arrow-down-bold-duotone"
          title="Send Backward"
          onClick={() => moveDownMany(selectedComponentIds)}
        />
        <ActionButton
          icon="solar:double-alt-arrow-down-bold-duotone"
          title="Send to Back"
          onClick={() => sendToBackMany(selectedComponentIds)}
        />
      </div>

      {/* Duplicate Section */}
      <div className="flex items-center gap-0.5 px-0.5 border-r border-white/5">
        <ActionButton
          icon="solar:copy-bold-duotone"
          title="Duplicate Selection"
          onClick={() => duplicateSelected()}
        />
      </div>

      {/* Destruction Section */}
      <div className="flex items-center gap-0.5 px-1">
        <ActionButton
          icon="solar:trash-bin-trash-bold-duotone"
          title="Delete Selection"
          onClick={() => removeComponents(selectedComponentIds)}
          className="hover:bg-red-500/20 text-red-400 hover:text-red-300"
        />
      </div>
    </div>
  );
});

function ActionButton({ icon, title, onClick, className }: { icon: string; title: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={clsx(
        'p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-all duration-150 group relative',
        className
      )}
      title={title}
    >
      <Icon icon={icon} className="w-4 h-4" />

      {/* Simple minimalist tooltip effect on hover can be handled by 'title' attribute or a custom one if requested */}
    </button>
  );
}
