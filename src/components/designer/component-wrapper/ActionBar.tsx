'use client';

import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode } from '@/types/schema';
import { clsx } from 'clsx';
import { Icon } from '@iconify/react';
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
  const removeComponents = useDesignerStore((s) => s.removeComponents);
  const zoom = useDesignerStore((state) => state.zoom);

  const isVisible = isSelected && !isDragging && selectedIds.length === 1;

  if (!isVisible) return null;

  return (
    <div
      className={clsx(
        'absolute -top-8 -right-2 flex items-center gap-1 bg-[var(--bg-surface)] p-0.5 px-2 z-[1000]',
      )}
      style={{
        transform: `scale(${1 / zoom})`,
        transformOrigin: 'bottom right',
        borderRadius: '100px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Grip */}
      <div className="flex items-center px-1 text-gray-400 cursor-move border-r border-white/20">
        <Icon icon="fa-solid:grip-horizontal" className="w-4 h-4" />
      </div>

      {/* Z-Order */}
      <div className="flex items-center gap-1 px-1 border-r border-white/20">
        <ActionButton
          icon="solar:double-alt-arrow-up-bold-duotone"
          title="Bring to Front"
          onClick={() => bringToFront(component.id)}
        />
        <ActionButton
          icon="solar:alt-arrow-up-bold-duotone"
          title="Bring Forward"
          onClick={() => moveUp(component.id)}
        />
        <ActionButton
          icon="solar:alt-arrow-down-bold-duotone"
          title="Send Backward"
          onClick={() => moveDown(component.id)}
        />
        <ActionButton
          icon="solar:double-alt-arrow-down-bold-duotone"
          title="Send to Back"
          onClick={() => sendToBack(component.id)}
        />
      </div>

      {/* Duplicate */}
      <div className="flex items-center gap-1 px-1 border-r border-white/20">
        <ActionButton
          icon="solar:copy-bold-duotone"
          title="Duplicate"
          onClick={handleDuplicate}
        />
      </div>

      {/* Delete */}
      <div className="flex items-center px-0.5">
        <ActionButton
          icon="solar:trash-bin-trash-bold-duotone"
          title="Delete"
          onClick={() => {
            if (selectedIds.length > 1) {
              removeComponents(selectedIds);
            } else {
              removeComponent(component.id);
            }
          }}
          className="hover:bg-red-500/20 text-red-400 hover:text-red-300"
        />
      </div>
    </div>
  );
});

function ActionButton({
  icon,
  title,
  onClick,
  className
}: {
  icon: string;
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
        'p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all duration-150',
        className
      )}
      title={title}
    >
      <Icon icon={icon} className="w-4 h-4" />
    </button>
  );
}
