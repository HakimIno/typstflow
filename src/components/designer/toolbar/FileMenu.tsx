'use client';
import {
  DropdownMenu,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/shared/DropdownMenu';
import { useDesignerStore } from '@/store/designer-store';
import { FilePlus, RefreshCcw, Trash2 } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

export function FileMenu() {
  const loadTemplate = useDesignerStore((state) => state.loadTemplate);

  const showDialog = useDesignerStore((state) => state.showDialog);

  const handleNew = () => {
    showDialog({
      title: 'Create New Report',
      message:
        'Are you sure you want to start a new blank report? This will clear all current work.',
      variant: 'warning',
      confirmLabel: 'New Report',
      onConfirm: () => loadTemplate('blank'),
    });
  };

  const handleReset = () => {
    showDialog({
      title: 'Critical System Reset',
      message:
        'This will clear ALL saved data, including history and preferences, and reload the application. This action cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Hard Reset',
      onConfirm: () => {
        localStorage.clear();
        window.indexedDB.deleteDatabase('typstflow-storage');
        window.location.reload();
      },
    });
  };

  return (
    <DropdownMenu trigger={<ToolbarButton label="File" variant="toolbar-item" showChevron />}>
      <DropdownMenuHeader>Document Actions</DropdownMenuHeader>

      <DropdownMenuItem icon={FilePlus} label="New Blank Report" onClick={handleNew} />

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
