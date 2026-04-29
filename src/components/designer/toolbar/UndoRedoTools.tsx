'use client';

import { useDesignerStore } from '@/store/designer-store';
import { Redo, Undo } from 'lucide-react';
import { memo } from 'react';
import { ToolbarButton } from './ToolbarButton';

export const UndoRedoTools = memo(function UndoRedoTools() {
  const undo = useDesignerStore((state) => state.undo);
  const redo = useDesignerStore((state) => state.redo);
  const historyIndex = useDesignerStore((state) => state.historyIndex);
  const historyLength = useDesignerStore((state) => state.history.length);

  return (
    <div className="flex items-center">
      <ToolbarButton
        icon={Undo}
        onClick={undo}
        disabled={historyIndex <= 0}
        variant="toolbar-item"
        title="Undo (Cmd+Z)"
        className="!h-7 !w-7 !p-1.5 opacity-80 hover:opacity-100"
      />
      <ToolbarButton
        icon={Redo}
        onClick={redo}
        disabled={historyIndex >= historyLength - 1}
        variant="toolbar-item"
        title="Redo (Cmd+Shift+Z)"
        className="!h-7 !w-7 !p-1.5 opacity-80 hover:opacity-100"
      />
    </div>
  );
});
