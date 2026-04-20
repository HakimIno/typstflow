'use client';

import { memo, useEffect } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { TopHeader } from './toolbar/TopHeader';
import { SubToolbar } from './toolbar/SubToolbar';

export const Toolbar = memo(function Toolbar() {
  const undo = useDesignerStore((state) => state.undo);
  const redo = useDesignerStore((state) => state.redo);

  // Global Keyboard Shortcuts for the Designer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      } else if (isMod && e.key === 'y') {
        redo();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex flex-col flex-shrink-0 relative z-[100]">
      <TopHeader />
      <SubToolbar />
    </div>
  );
});
