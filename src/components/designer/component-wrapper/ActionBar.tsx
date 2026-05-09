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
  Copy,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { memo } from 'react';

interface ActionBarProps {
  component: ComponentNode;
  isSelected: boolean;
  selectedIds: string[];
  isDragging: boolean;
  handleDuplicate: (e: React.MouseEvent) => void;
}

export const ActionBar = memo(function ActionBar({
  component,
  isSelected,
  selectedIds,
  isDragging,
  handleDuplicate,
}: ActionBarProps) {
  const bringToFront = useDesignerStore((s) => s.bringToFront);
  const sendToBack = useDesignerStore((s) => s.sendToBack);
  const moveUp = useDesignerStore((s) => s.moveUp);
  const moveDown = useDesignerStore((s) => s.moveDown);
  const removeComponent = useDesignerStore((s) => s.removeComponent);
  const removeComponents = useDesignerStore((state) => state.removeComponents);
  const zoom = useDesignerStore((state) => state.zoom);

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
      <div className="flex items-center px-1 text-zinc-500 cursor-move border-r border-white/10">
        <GripHorizontal className="w-3.5 h-3.5" />
      </div>

      {/* Z-Order */}
      <div className="flex items-center gap-0.5 px-0.5 border-r border-white/10">
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

