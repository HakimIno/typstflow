'use client';

import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode } from '@/types/schema';
import { clsx } from 'clsx';
import {
  GripHorizontal,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Trash2,
} from 'lucide-react';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import type React from 'react';
import { memo, useRef } from 'react';

interface ActionBarProps {
  component: ComponentNode;
  isSelected: boolean;
  selectedIds: string[];
  isDragging: boolean;
  flowMode?: boolean;
  handleDuplicate: (e: React.MouseEvent) => void;
  handleFlowIndentLeft?: (e: React.MouseEvent) => void;
  handleFlowIndentRight?: (e: React.MouseEvent) => void;
}

export const ActionBar = memo(function ActionBar({
  component,
  isSelected,
  selectedIds,
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

  const handleScrubberPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    startCompXRef.current = component.x || 0;

    const handleMove = (ev: PointerEvent) => {
      const deltaPx = (ev.clientX - startXRef.current) / zoom;
      const deltaMm = LayoutEngine.pxToMm(deltaPx);
      const newX = Math.max(0, Math.round(startCompXRef.current + deltaMm));
      updateComponent(component.id, { x: newX }, true); // skip history during drag
    };

    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      const deltaPx = (ev.clientX - startXRef.current) / zoom;
      const deltaMm = LayoutEngine.pxToMm(deltaPx);
      const newX = Math.max(0, Math.round(startCompXRef.current + deltaMm));
      updateComponent(component.id, { x: newX }); // finalize with history
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const isVisible = isSelected && !isDragging && selectedIds.length === 1;

  if (!isVisible) return null;

  return (
    <div
      className={clsx(
        'absolute -top-10 -right-2 flex items-center gap-0.5 bg-black backdrop-blur-md p-1 z-[1000] border border-white/10 shadow-2xl transition-transform duration-200',
      )}
      style={{
        transform: `scale(${Math.min(1.2, 1 / zoom)})`,
        transformOrigin: 'bottom right',
        borderRadius: '12px',
      }}
      onClick={(e) => e.stopPropagation()}
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
            <ActionButton
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
            <ActionButton
              icon={ChevronRight}
              title="Indent Right 5mm"
              onClick={(e) => handleFlowIndentRight?.(e)}
            />
            <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
            <ActionButton
              icon={ChevronUp}
              title="Move Up"
              onClick={() => moveDown(component.id)}
            />
            <ActionButton
              icon={ChevronDown}
              title="Move Down"
              onClick={() => moveUp(component.id)}
            />
          </>
        ) : (
          <>
            <ActionButton
              icon={ChevronsUp}
              title="Bring to Front"
              onClick={() => bringToFront(component.id)}
            />
            <ActionButton
              icon={ChevronUp}
              title="Bring Forward"
              onClick={() => moveUp(component.id)}
            />
            <ActionButton
              icon={ChevronDown}
              title="Send Backward"
              onClick={() => moveDown(component.id)}
            />
            <ActionButton
              icon={ChevronsDown}
              title="Send to Back"
              onClick={() => sendToBack(component.id)}
            />
          </>
        )}
      </div>

      {/* Duplicate */}
      <div className="flex items-center gap-0.5 px-0.5 border-r border-white/10">
        <ActionButton
          icon={Copy}
          title="Duplicate"
          onClick={handleDuplicate}
        />
      </div>

      {/* Delete */}
      <div className="flex items-center px-0.5">
        <ActionButton
          icon={Trash2}
          title="Delete"
          onClick={() => {
            if (selectedIds.length > 1) {
              removeComponents(selectedIds);
            } else {
              removeComponent(component.id);
            }
          }}
          className="hover:bg-red-500/20 text-red-500/70 hover:text-red-400"
        />
      </div>
    </div>
  );
});

function ActionButton({
  icon: Icon,
  title,
  onClick,
  className
}: {
  icon: any;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={clsx(
        'p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-all duration-150',
        className
      )}
      title={title}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

