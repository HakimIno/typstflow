'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { parseTypstUnit } from '@/lib/utils/units';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronUp,
  Maximize2,
  Trash2,
} from 'lucide-react';
import { memo, useMemo } from 'react';

export const SelectionToolbar = memo(function SelectionToolbar({
  pageId,
}: {
  pageId?: string;
}) {
  const selectedComponentIds = useDesignerStore((state) => state.selectedComponentIds);
  const schema = useDesignerStore((state) => state.schema);
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const removeComponents = useDesignerStore((state) => state.removeComponents);
  const zoom = useDesignerStore((state) => state.zoom);
  const bringToFront = useDesignerStore((state) => state.bringToFront);
  const sendToBack = useDesignerStore((state) => state.sendToBack);
  const moveUp = useDesignerStore((state) => state.moveUp);
  const moveDown = useDesignerStore((state) => state.moveDown);

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

  if (selectedComponents.length === 0) return null;

  const isMulti = selectedComponents.length > 1;

  // Calculate selection bounds in MM
  const minX = Math.min(...selectedComponents.map((c) => c.x || 0));
  const maxX = Math.max(...selectedComponents.map((c) => (c.x || 0) + (c.width || 0)));
  const minY = Math.min(...selectedComponents.map((c) => c.absY || 0));
  const maxY = Math.max(...selectedComponents.map((c) => (c.absY || 0) + (c.height || 0)));

  const selectionWidth = maxX - minX;
  const selectionHeight = maxY - minY;

  // Position the toolbar above the selection
  const toolbarTop = LayoutEngine.mmToPx(minY) - 45;
  const toolbarLeft = LayoutEngine.mmToPx(minX + selectionWidth / 2);

  // --- Alignment Handlers ---

  const handleAlignToPage = (type: string) => {
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
          // Center within the zone's local coordinate space
          // For body zone, the y is relative to the zone, not the full page
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
      if (Object.keys(updates).length > 0) updateComponent(comp.id, updates);
    }
  };

  const handleAlignToSelection = (type: string) => {
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
          updates.y = comp.y - (comp.absY - minY);
          break;
        case 'middle':
          updates.y = comp.y + (minY + selectionHeight / 2 - (comp.absY + (comp.height || 0) / 2));
          break;
        case 'bottom':
          updates.y = comp.y + (maxY - (comp.absY + (comp.height || 0)));
          break;
      }
      if (Object.keys(updates).length > 0) updateComponent(comp.id, updates);
    }

    if (type === 'dist-h') {
      const sorted = [...selectedComponents].sort((a, b) => (a.x || 0) - (b.x || 0));
      const totalCompsWidth = sorted.reduce((sum, c) => sum + (c.width || 0), 0);
      const gap = (selectionWidth - totalCompsWidth) / (sorted.length - 1);
      let currentX = minX;
      for (const comp of sorted) {
        updateComponent(comp.id, { x: currentX });
        currentX += (comp.width || 0) + gap;
      }
    } else if (type === 'dist-v') {
      const sorted = [...selectedComponents].sort((a, b) => (a.absY || 0) - (b.absY || 0));
      const totalCompsHeight = sorted.reduce((sum, c) => sum + (c.height || 0), 0);
      const gap = (selectionHeight - totalCompsHeight) / (sorted.length - 1);
      let currentAbsY = minY;
      for (const comp of sorted) {
        const diff = currentAbsY - comp.absY;
        updateComponent(comp.id, { y: (comp.y || 0) + diff });
        currentAbsY += (comp.height || 0) + gap;
      }
    }
  };

  return (
    <div
      data-toolbar="true"
      className="absolute z-[1000] flex items-center gap-0.5 bg-[var(--accent)] border border-[var(--border-accent)] rounded-lg p-0.5 shadow-2xl transition-all duration-200"
      style={{
        top: `${toolbarTop}px`,
        left: `${toolbarLeft}px`,
        transform: `translateX(-50%) scale(${1 / zoom})`,
        transformOrigin: 'bottom center',
      }}
    >
      {/* Align to Page (always available) */}
      <div className="flex items-center gap-0.5 px-0.5 border-r border-white/20">
        <ActionButton
          icon={AlignStartHorizontal}
          title={isMulti ? "Align Left" : "Align Left to Page"}
          onClick={() => isMulti ? handleAlignToSelection('left') : handleAlignToPage('page-left')}
        />
        <ActionButton
          icon={AlignCenterHorizontal}
          title={isMulti ? "Center Horizontally" : "Center H on Page"}
          onClick={() => isMulti ? handleAlignToSelection('center') : handleAlignToPage('page-center-h')}
        />
        <ActionButton
          icon={AlignEndHorizontal}
          title={isMulti ? "Align Right" : "Align Right to Page"}
          onClick={() => isMulti ? handleAlignToSelection('right') : handleAlignToPage('page-right')}
        />
      </div>

      <div className="flex items-center gap-0.5 px-0.5 border-r border-white/20">
        <ActionButton
          icon={AlignStartVertical}
          title={isMulti ? "Align Top" : "Align Top to Page"}
          onClick={() => isMulti ? handleAlignToSelection('top') : handleAlignToPage('page-top')}
        />
        <ActionButton
          icon={AlignCenterVertical}
          title={isMulti ? "Center Vertically" : "Center V on Page"}
          onClick={() => isMulti ? handleAlignToSelection('middle') : handleAlignToPage('page-center-v')}
        />
        <ActionButton
          icon={AlignEndVertical}
          title={isMulti ? "Align Bottom" : "Align Bottom to Page"}
          onClick={() => isMulti ? handleAlignToSelection('bottom') : handleAlignToPage('page-bottom')}
        />
      </div>

      {/* Center on Page — quick action (always available) */}
      <div className="flex items-center gap-0.5 px-0.5 border-r border-white/20">
        <ActionButton
          icon={Maximize2}
          title="Center on Page (H+V)"
          onClick={() => handleAlignToPage('page-center-both')}
        />
      </div>

      {/* Distribute (multi-select only) */}
      {isMulti && (
        <div className="flex items-center gap-0.5 px-0.5 border-r border-white/20">
          <ActionButton
            icon={AlignHorizontalDistributeCenter}
            title="Distribute Horizontally"
            onClick={() => handleAlignToSelection('dist-h')}
          />
          <ActionButton
            icon={AlignVerticalDistributeCenter}
            title="Distribute Vertically"
            onClick={() => handleAlignToSelection('dist-v')}
          />
        </div>
      )}

      {/* Z-Order */}
      <div className="flex items-center gap-0.5 px-0.5 border-r border-white/20">
        <ActionButton
          icon={ChevronLast}
          title="Bring to Front"
          onClick={() => {
            for (const id of selectedComponentIds) bringToFront(id);
          }}
        />
        <ActionButton
          icon={ChevronUp}
          title="Bring Forward"
          onClick={() => {
            for (const id of selectedComponentIds) moveUp(id);
          }}
        />
        <ActionButton
          icon={ChevronDown}
          title="Send Backward"
          onClick={() => {
            for (const id of selectedComponentIds) moveDown(id);
          }}
        />
        <ActionButton
          icon={ChevronFirst}
          title="Send to Back"
          onClick={() => {
            for (const id of selectedComponentIds) sendToBack(id);
          }}
        />
      </div>

      {/* Delete */}
      <div className="flex items-center gap-0.5 px-0.5">
        <ActionButton
          icon={Trash2}
          title="Delete Selection"
          onClick={() => removeComponents(selectedComponentIds)}
          className="hover:bg-red-500"
        />
      </div>
    </div>
  );
});

function ActionButton({ icon: Icon, title, onClick, className }: any) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={clsx(
        'p-1.5 rounded-md hover:bg-white/20 text-white transition-colors duration-150',
        className
      )}
      title={title}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
