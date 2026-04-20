'use client';

import { memo } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { FileText, Save } from 'lucide-react';
import { PanelSwitcher } from './PanelSwitcher';
import { UndoRedoTools } from './UndoRedoTools';
import { AlignmentTools } from './AlignmentTools';
import { ZoomControls } from './ZoomControls';
import { ToolbarActions } from './ToolbarActions';
import { ToolbarButton } from './ToolbarButton';

export const SubToolbar = memo(function SubToolbar() {
  const schemaName = useDesignerStore((state) => state.schema.name);
  const updateSchema = useDesignerStore((state) => state.updateSchema);

  return (
    <div className="h-10 bg-slate-100 border-b border-slate-300 flex items-center justify-between px-4">
      <div className="flex items-center gap-1">
        <PanelSwitcher />
        <UndoRedoTools />
        
        <div className="h-6 w-px bg-slate-300 mx-1" />
        <AlignmentTools />
        
        <div className="h-6 w-px bg-slate-300 mx-1" />
        <ZoomControls />
        
        <div className="h-6 w-px bg-slate-300 mx-1" />
        
        <div className="flex items-center gap-1 h-7 px-2 bg-white border border-slate-300 rounded-none mr-2 focus-within:border-slate-500">
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={schemaName}
            onChange={(e) => updateSchema({ name: e.target.value })}
            className="text-[11px] font-bold text-slate-700 bg-transparent border-none focus:ring-0 w-32 outline-none"
            placeholder="Report name"
          />
        </div>

        <ToolbarButton
          icon={Save}
          label="Save"
          onClick={() => {}}
          title="Save Layout (Cmd+S)"
        />
      </div>

      <ToolbarActions />
    </div>
  );
});
