import { useDesignerStore } from '@/store/designer-store';
import { useEffect } from 'react';

export function useKeyboardShortcuts() {
  const {
    undo,
    redo,
    copySelected,
    paste,
    duplicateSelected,
    nudgeSelected,
    removeComponents,
    selectedComponentIds,
    clearSelection,
  } = useDesignerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if the user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      // Undo: Cmd+Z
      if (isMod && !isShift && e.key === 'z') {
        e.preventDefault();
        undo();
      }

      // Redo: Cmd+Shift+Z or Cmd+Y
      if ((isMod && isShift && e.key === 'z') || (isMod && e.key === 'y')) {
        e.preventDefault();
        redo();
      }

      // Copy: Cmd+C
      if (isMod && e.key === 'c') {
        e.preventDefault();
        copySelected();
      }

      // Paste: Cmd+V
      if (isMod && e.key === 'v') {
        e.preventDefault();
        paste();
      }

      // Duplicate: Cmd+D
      if (isMod && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
      }

      // Delete: Backspace or Delete
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedComponentIds.length > 0) {
          e.preventDefault();
          removeComponents(selectedComponentIds);
        }
      }

      // Deselect: Escape
      if (e.key === 'Escape') {
        clearSelection();
      }

      // Nudging: Arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedComponentIds.length > 0) {
          e.preventDefault();
          const step = isShift ? 10 : 1; // 10mm if shift is held, else 1mm

          switch (e.key) {
            case 'ArrowUp':
              nudgeSelected(0, -step);
              break;
            case 'ArrowDown':
              nudgeSelected(0, step);
              break;
            case 'ArrowLeft':
              nudgeSelected(-step, 0);
              break;
            case 'ArrowRight':
              nudgeSelected(step, 0);
              break;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undo,
    redo,
    copySelected,
    paste,
    duplicateSelected,
    nudgeSelected,
    removeComponents,
    selectedComponentIds,
    clearSelection,
  ]);
}
