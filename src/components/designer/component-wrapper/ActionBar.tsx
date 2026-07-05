'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode } from '@/types/schema';
import { clsx } from 'clsx';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  GripHorizontal,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { memo, useRef } from 'react';
import { FloatingToolbar, FloatingToolbarButton } from '../toolbar/FloatingToolbar';
import { ToolbarSeparator } from '../toolbar/ToolbarSeparator';

interface ActionBarProps {
  component: ComponentNode;
  isSelected: boolean;
  selectedCount: number;
  isDragging: boolean;
  flowMode?: boolean;
  handleDuplicate: (e: React.MouseEvent) => void;
  handleFlowIndentLeft?: (e: React.MouseEvent) => void;
  handleFlowIndentRight?: (e: React.MouseEvent) => void;
}

export const ActionBar = memo(function ActionBar({
  component,
  isSelected,
  selectedCount,
  isDragging,
  flowMode = false,
  handleDuplicate,
  handleFlowIndentLeft,
  handleFlowIndentRight,
}: ActionBarProps) {
  const bringToFront = useDesignerStore((s) => s.bringToFront);
  const sendToBack = useDesignerStore((s) => s.sendToBack);
  const moveUp = useDesignerStore((s) => s.moveUp);
  const moveDown = useDesignerStore((s) => s.moveDown);
  const removeComponent = useDesignerStore((s) => s.removeComponent);
  const removeComponents = useDesignerStore((state) => state.removeComponents);
  const updateComponent = useDesignerStore((s) => s.updateComponent);
  const zoom = useDesignerStore((state) => state.zoom);

  const startXRef = useRef(0);
  const startCompXRef = useRef(0);

  // ─── Scrubber (x-position drag) ────────────────────────────────────────
  const handleScrubberPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    startCompXRef.current = component.x || 0;

    const handleMove = (ev: PointerEvent) => {
      const deltaMm = LayoutEngine.pxToMm((ev.clientX - startXRef.current) / zoom);
      updateComponent(
        component.id,
        { x: Math.max(0, Math.round(startCompXRef.current + deltaMm)) },
        true
      );
    };
    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      const deltaMm = LayoutEngine.pxToMm((ev.clientX - startXRef.current) / zoom);
      updateComponent(component.id, {
        x: Math.max(0, Math.round(startCompXRef.current + deltaMm)),
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const isVisible = isSelected && !isDragging && selectedCount === 1;
  if (!isVisible) return null;

  const isNearTop = (component.y || 0) < 20;

  return (
    <FloatingToolbar
      className={clsx(
        'absolute -right-2 z-[1000] transition-all duration-200',
        isNearTop ? 'top-full mt-2' : '-top-14'
      )}
      style={{
        transform: `scale(${Math.min(1.2, 1 / zoom)})`,
        transformOrigin: isNearTop ? 'top right' : 'bottom right',
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Grip */}
      {!flowMode && (
        <div className="flex items-center px-1 text-zinc-500 cursor-move border-r border-white/10">
          <GripHorizontal className="w-3.5 h-3.5" />
        </div>
      )}

      {/* Arrangement / Flow Controls */}
      <div className="flex items-center gap-0.5 px-0.5 border-r border-white/10">
        {flowMode ? (
          <>
            <FloatingToolbarButton
              icon={ChevronLeft}
              title="Indent Left 5mm"
              onClick={(e) => handleFlowIndentLeft?.(e)}
            />
            <div
              className="px-1.5 py-0.5 mx-0.5 rounded bg-white/10 hover:bg-white/20 cursor-ew-resize transition-colors"
              onPointerDown={handleScrubberPointerDown}
              title="Drag left/right to adjust"
            >
              <span className="text-[9px] text-white/90 font-mono leading-none select-none">
                ←{Math.round(component.x || 0)}mm
              </span>
            </div>
            <FloatingToolbarButton
              icon={ChevronRight}
              title="Indent Right 5mm"
              onClick={(e) => handleFlowIndentRight?.(e)}
            />
            <ToolbarSeparator tone="dark" />
            <FloatingToolbarButton
              icon={ChevronUp}
              title="Move Up"
              onClick={() => moveDown(component.id)}
            />
            <FloatingToolbarButton
              icon={ChevronDown}
              title="Move Down"
              onClick={() => moveUp(component.id)}
            />
          </>
        ) : (
          <>
            <FloatingToolbarButton
              icon={ChevronsUp}
              title="Bring to Front"
              onClick={() => bringToFront(component.id)}
            />
            <FloatingToolbarButton
              icon={ChevronUp}
              title="Bring Forward"
              onClick={() => moveUp(component.id)}
            />
            <FloatingToolbarButton
              icon={ChevronDown}
              title="Send Backward"
              onClick={() => moveDown(component.id)}
            />
            <FloatingToolbarButton
              icon={ChevronsDown}
              title="Send to Back"
              onClick={() => sendToBack(component.id)}
            />
          </>
        )}
      </div>

      {/* Duplicate */}
      <div className="flex items-center gap-0.5 px-0.5 border-r border-white/10">
        <FloatingToolbarButton icon={Copy} title="Duplicate" onClick={handleDuplicate} />
      </div>

      {/* Delete component */}
      <div className="flex items-center px-0.5">
        <FloatingToolbarButton
          icon={Trash2}
          title="Delete Component"
          onClick={() => {
            if (selectedCount > 1)
              removeComponents(useDesignerStore.getState().selectedComponentIds);
            else removeComponent(component.id);
          }}
          className="hover:bg-red-500/20 text-red-500/70 hover:text-red-400"
        />
      </div>
    </FloatingToolbar>
  );
});
