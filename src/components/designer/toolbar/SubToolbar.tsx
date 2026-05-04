'use client';

import { memo } from 'react';
import { AlignmentTools } from './AlignmentTools';
import { CanvasLayoutSwitcher } from './CanvasLayoutSwitcher';
import { ToolbarActions } from './ToolbarActions';
import { UndoRedoTools } from './UndoRedoTools';
import { ZoomControls } from './ZoomControls';

export const SubToolbar = memo(function SubToolbar() {
  return (
    <div className="h-[48px] bg-transparent border-b border-[var(--border-default)] flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5 p-0.5 bg-[var(--bg-widget)]  rounded-[var(--radius-md)]">
          <UndoRedoTools />
        </div>

        <div className="flex items-center gap-0.5 p-0.5  bg-[var(--bg-widget)]  rounded-[var(--radius-md)]">
          <AlignmentTools />
        </div>

        <div className="flex items-center gap-0.5 p-0.5  bg-[var(--bg-widget)]  rounded-[var(--radius-md)]">
          <ZoomControls />
          <div className="w-[1px] h-3 bg-[var(--border-default)] mx-1" />
          <CanvasLayoutSwitcher />
        </div>
      </div>

      <div className="flex items-center gap-0.5 p-0.5  bg-[var(--bg-widget)]  rounded-[var(--radius-md)]">
        <ToolbarActions />
      </div>
    </div>
  );
});
