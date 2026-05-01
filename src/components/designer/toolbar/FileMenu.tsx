'use client';
import {
  DropdownMenu,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/shared/DropdownMenu';
import { useDesignerStore } from '@/store/designer-store';
import { FilePlus, RefreshCcw, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { ToolbarButton } from './ToolbarButton';

export function FileMenu() {
  const loadTemplate = useDesignerStore((state) => state.loadTemplate);

  const handleNew = () => {
    if (confirm('Are you sure you want to start a new blank report? This will clear all current work.')) {
      loadTemplate('blank');
    }
  };

  const handleReset = () => {
    if (confirm('CRITICAL RESET: This will clear ALL saved data, including history and preferences, and reload the application. Proceed?')) {
      localStorage.clear();
      // IndexedDB cleanup is more complex but clearing localStorage will trigger a re-render/reset in many cases 
      // if the persistence key is there. 
      // For this app, we use async-storage (IndexedDB).
      window.indexedDB.deleteDatabase('typstflow-storage');
      window.location.reload();
    }
  };

  return (
    <DropdownMenu trigger={<ToolbarButton label="File" variant="toolbar-item" showChevron />}>
      <DropdownMenuHeader>Document Actions</DropdownMenuHeader>
      
      <DropdownMenuItem
        icon={FilePlus}
        label="New Blank Report"
        onClick={handleNew}
      />
      
      <DropdownMenuSeparator />
      
      <DropdownMenuItem
        icon={Trash2}
        label="Clear All Elements"
        variant="danger"
        onClick={handleNew}
      />

      <DropdownMenuSeparator />
      
      <DropdownMenuItem
        icon={RefreshCcw}
        label="Hard Reset System"
        variant="danger"
        onClick={handleReset}
      />
    </DropdownMenu>
  );
}
