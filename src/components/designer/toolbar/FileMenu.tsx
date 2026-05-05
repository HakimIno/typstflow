'use client';
import {
  DropdownMenu,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/shared/DropdownMenu';
import { useDesignerStore } from '@/store/designer-store';
import { Download, FilePlus, RefreshCcw, Trash2, Upload } from 'lucide-react';
import { useRef } from 'react';
import { ToolbarButton } from './ToolbarButton';

export function FileMenu() {
  const loadTemplate = useDesignerStore((state) => state.loadTemplate);
  const exportSchema = useDesignerStore((state) => state.exportSchema);
  const importSchema = useDesignerStore((state) => state.importSchema);
  const showDialog = useDesignerStore((state) => state.showDialog);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        showDialog({
          title: 'Import Design',
          message:
            'Are you sure you want to import this design? Your current work will be overwritten.',
          variant: 'warning',
          confirmLabel: 'Import',
          onConfirm: () => importSchema(content),
        });
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    showDialog({
      title: 'Critical System Reset',
      message:
        'This will clear ALL saved data, including history and preferences, and reload the application. This action cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Hard Reset',
      onConfirm: () => {
        // 1. Clear simple storage
        localStorage.clear();
        sessionStorage.clear();

        // 2. Clear IndexedDB (Correct name: typstflow-db)
        const req = window.indexedDB.deleteDatabase('typstflow-db');

        const forceReload = () => {
          window.location.reload();
        };

        req.onsuccess = forceReload;
        req.onerror = forceReload;
        req.onblocked = forceReload;

        // 3. Fallback reload if DB deletion takes too long
        setTimeout(forceReload, 2000);
      },
    });
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".json"
        onChange={handleFileChange}
      />
      <DropdownMenu trigger={<ToolbarButton label="File" variant="toolbar-item" showChevron />}>
        <DropdownMenuHeader>Document Actions</DropdownMenuHeader>

        <DropdownMenuItem icon={FilePlus} label="New Blank Report" onClick={handleNew} />

        <DropdownMenuSeparator />

        <DropdownMenuItem icon={Download} label="Export Design (.json)" onClick={exportSchema} />

        <DropdownMenuItem icon={Upload} label="Import Design (.json)" onClick={handleImportClick} />

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
    </>
  );
}
