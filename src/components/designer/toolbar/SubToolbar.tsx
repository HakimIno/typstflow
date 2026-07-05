'use client';

import { memo } from 'react';
import { AlignmentTools } from './AlignmentTools';
import { CanvasLayoutSwitcher } from './CanvasLayoutSwitcher';
import { ToolbarActions } from './ToolbarActions';
import { ToolbarSeparator } from './ToolbarSeparator';
import { UndoRedoTools } from './UndoRedoTools';
import { ZoomControls } from './ZoomControls';

export const SubToolbar = memo(function SubToolbar() {
  return (
    <div className="h-[48px] bg-transparent border-b border-[var(--border-default)] flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="pro-capsule">
          <UndoRedoTools />
        </div>

        <div className="pro-capsule">
          <AlignmentTools />
        </div>

        <div className="pro-capsule">
          <ZoomControls />
          <ToolbarSeparator className="h-3" />
          <CanvasLayoutSwitcher />
        </div>
      </div>

      <div className="pro-capsule">
        <ToolbarActions />
      </div>
    </div>
  );
});
