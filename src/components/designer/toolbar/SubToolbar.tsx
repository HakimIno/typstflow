'use client';

import { memo } from 'react';
import { UndoRedoTools } from './UndoRedoTools';
import { AlignmentTools } from './AlignmentTools';
import { ZoomControls } from './ZoomControls';
import { ToolbarActions } from './ToolbarActions';

export const SubToolbar = memo(function SubToolbar() {
  return (
    <div className="h-[48px] bg-transparent border-b border-[var(--border-default)] flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5  bg-[var(--bg-widget)]  rounded-[var(--radius-md)]">
          <UndoRedoTools />
        </div>

        <div className="flex items-center gap-0.5  bg-[var(--bg-widget)]  rounded-[var(--radius-md)]">
          <AlignmentTools />
        </div>

        <div className="flex items-center gap-0.5  bg-[var(--bg-widget)]  rounded-[var(--radius-md)]">
          <ZoomControls />
        </div>
      </div>

      <div className="flex items-center gap-0.5  bg-[var(--bg-widget)]  rounded-[var(--radius-md)]">
        <ToolbarActions />
      </div>
    </div>
  );
});
