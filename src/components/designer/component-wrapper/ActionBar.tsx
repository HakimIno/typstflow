import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode } from '@/types/schema';
import { clsx } from 'clsx';
import {
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronUp,
  Copy,
  GripVertical,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { memo } from 'react';

interface ActionBarProps {
  component: ComponentNode;
  isSelected: boolean;
  selectedIds: string[];
  isDragging: boolean;
  dragHandleRef: React.RefObject<HTMLDivElement | null>;
  handleDuplicate: (e: React.MouseEvent) => void;
}

export const ActionBar = memo(function ActionBar({
  component,
  isSelected,
  selectedIds,
  isDragging,
  dragHandleRef,
  handleDuplicate,
}: ActionBarProps) {
  const bringToFront = useDesignerStore((s) => s.bringToFront);
  const sendToBack = useDesignerStore((s) => s.sendToBack);
  const moveUp = useDesignerStore((s) => s.moveUp);
  const moveDown = useDesignerStore((s) => s.moveDown);
  const removeComponent = useDesignerStore((s) => s.removeComponent);
  const removeComponents = useDesignerStore((s) => s.removeComponents);

  return (
    <div
      className={clsx(
        'absolute -top-7 right-0 flex items-center bg-[var(--accent)] border border-[var(--border-accent)] rounded-md px-0.5 h-6.5 shadow-sm transition-opacity duration-200',
        !isSelected || isDragging || selectedIds.length > 1
          ? 'opacity-0 pointer-events-none'
          : 'opacity-100'
      )}
    >
      <div
        ref={dragHandleRef}
        data-drag-handle="true"
        className="p-1 hover:bg-white/10 text-white cursor-grab active:cursor-grabbing border-r border-white/10"
      >
        <GripVertical className="w-3 h-3" />
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          bringToFront(component.id);
        }}
        className="p-1 hover:bg-white/10 text-white border-r border-white/10"
        title="Bring to Front"
      >
        <ChevronLast className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          moveUp(component.id);
        }}
        className="p-1 hover:bg-white/10 text-white border-r border-white/10"
        title="Bring Forward"
      >
        <ChevronUp className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          moveDown(component.id);
        }}
        className="p-1 hover:bg-white/10 text-white border-r border-white/10"
        title="Send Backward"
      >
        <ChevronDown className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          sendToBack(component.id);
        }}
        className="p-1 hover:bg-white/10 text-white border-r border-white/10"
        title="Send to Back"
      >
        <ChevronFirst className="w-3 h-3" />
      </button>

      <button
        type="button"
        onClick={handleDuplicate}
        className="p-1 hover:bg-white/10 text-white border-r border-white/10"
        title="Duplicate"
      >
        <Copy className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (selectedIds.length > 1) {
            removeComponents(selectedIds);
          } else {
            removeComponent(component.id);
          }
        }}
        className="p-1 hover:bg-red-600 text-white"
        title="Delete"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
});
