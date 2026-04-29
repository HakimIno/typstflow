'use client';

import { memo } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { Undo, Redo } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

export const UndoRedoTools = memo(function UndoRedoTools() {
  const undo = useDesignerStore((state) => state.undo);
  const redo = useDesignerStore((state) => state.redo);
  const historyIndex = useDesignerStore((state) => state.historyIndex);
  const historyLength = useDesignerStore((state) => state.history.length);

  return (
    <div className="flex items-center bg-[var(--bg-widget)] border border-[var(--border-default)] rounded-md p-0.5 shadow-sm mr-2">
      <ToolbarButton
        icon={Undo}
        onClick={undo}
        disabled={historyIndex <= 0}
        variant="ghost"
        title="Undo (Cmd+Z)"
        className="!h-7 !w-7 !p-1.5 opacity-80 hover:opacity-100"
      />
      <ToolbarButton
        icon={Redo}
        onClick={redo}
        disabled={historyIndex >= historyLength - 1}
        variant="ghost"
        title="Redo (Cmd+Shift+Z)"
        className="!h-7 !w-7 !p-1.5 opacity-80 hover:opacity-100"
      />
    </div>
  );
});
