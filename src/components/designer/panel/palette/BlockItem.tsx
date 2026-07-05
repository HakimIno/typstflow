'use client';

import { DesignerInput } from '@/components/shared/DesignerInput';
import { useDesignerStore } from '@/store/designer-store';
import type { SavedBlock } from '@/types/schema';
import { clsx } from 'clsx';
import { Blocks, Plus, Trash2 } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { memo, useState } from 'react';

export const BlockItem = memo(function BlockItem({
  block,
  onInsert,
  onDelete,
}: {
  block: SavedBlock;
  onInsert: () => void;
  onDelete: () => void;
}) {
  const renameBlock = useDesignerStore((state) => state.renameBlock);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(block.name);

  const handleRename = () => {
    setIsEditing(false);
    if (name.trim()) {
      renameBlock(block.id, name.trim());
    } else {
      setName(block.name);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onInsert();
    }
  };

  return (
    <div
      className={clsx(
        'w-full group relative flex items-center gap-2 pr-3 py-1.5 cursor-pointer select-none transition-colors hover:bg-white/5'
      )}
      style={{ paddingLeft: '34px' }}
      onClick={onInsert}
      onKeyDown={handleKeyDown}
    >
      <div className="relative flex items-center gap-2.5 flex-1 min-w-0">
        <div className="w-5 flex items-center justify-center shrink-0">
          <Blocks className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors duration-200" />
        </div>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <DesignerInput
              autoFocus
              variant="ghost"
              className="text-[12px] font-medium p-0 text-[var(--accent)]"
              value={name}
              onChange={(v: string) => setName(v)}
              onBlur={handleRename}
              onKeyDown={(e: KeyboardEvent) => e.key === 'Enter' && handleRename()}
            />
          ) : (
            <>
              <span
                className="block text-[13px] font-medium truncate leading-tight transition-colors text-[var(--text-muted)] group-hover:text-[var(--accent)]"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
              >
                {block.name}
              </span>
              <span className="block text-[10px] text-[var(--text-muted)] mt-0.5 leading-none">
                {block.components.length} component{block.components.length !== 1 ? 's' : ''} ·{' '}
                {block.sourceZone}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInsert();
          }}
          className="p-1 hover:text-[var(--accent)] transition-colors text-[var(--accent)]/60"
          title="Insert block"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            useDesignerStore.getState().showDialog({
              title: 'Delete Block',
              message: `Are you sure you want to delete the block "${block.name}"?`,
              variant: 'danger',
              confirmLabel: 'Delete',
              onConfirm: onDelete,
            });
          }}
          className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-md text-[var(--text-muted)] transition-colors"
          title="Delete block"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});
