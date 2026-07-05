import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { useDesignerStore } from '@/store/designer-store';
import { useEffect } from 'react';

export function useKeyboardShortcuts() {
  // IMPORTANT: do NOT subscribe to the store here. This hook is mounted on the root
  // DesignerPage, so a reactive subscription — even one that only pulls stable action
  // refs — re-renders the ENTIRE page tree on every store change (drag deltas,
  // selection, cell edits, height auto-fit…). All actions and selection are read
  // fresh from getState() inside the handler, so no subscription is needed.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const key = e.key.toLowerCase();
      const isUndoKey = key === 'z' || e.code === 'KeyZ';
      const isRedoKey = key === 'y' || e.code === 'KeyY';

      // History shortcuts are app-level commands, same as the toolbar buttons.
      // Handle them before the text-field/table guards so focus inside a cell or
      // panel input doesn't make Cmd/Ctrl+Z look broken.
      if (isMod && !e.altKey && !isShift && isUndoKey) {
        e.preventDefault();
        useDesignerStore.getState().undo();
        return;
      }

      if (isMod && !e.altKey && ((isShift && isUndoKey) || isRedoKey)) {
        e.preventDefault();
        useDesignerStore.getState().redo();
        return;
      }

      // Ignore shortcuts if the user is typing in an input/textarea or a code editor
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.monaco-editor') ||
        target.closest('.cm-editor') // Support for CodeMirror in the future
      ) {
        return;
      }

      // Sheet mode owns the keyboard: cell navigation/clearing is handled by
      // use-sheet-keyboard, and component-level shortcuts (Delete removes the
      // whole table!) must not fire while a table sheet is being edited.
      if (useDesignerStore.getState().tableSheetEditId) return;

      // Read actions + selection fresh from the store (no reactive subscription).
      const {
        copySelected,
        paste,
        duplicateSelected,
        nudgeSelected,
        removeComponents,
        clearSelection,
        alignSelected,
        distributeSelected,
        alignToPage,
        selectedComponentIds,
      } = useDesignerStore.getState();

      // Copy: Cmd+C
      if (isMod && key === 'c') {
        e.preventDefault();
        copySelected();
      }

      // Paste: Cmd+V
      if (isMod && key === 'v') {
        e.preventDefault();
        paste();
      }

      // Duplicate: Cmd+D
      if (isMod && key === 'd') {
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

      // Zoom: Cmd+= / Cmd+- / Cmd+0
      const { zoom, setZoom } = useDesignerStore.getState();
      if (isMod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom(Math.min(3.0, zoom * 1.15));
      }
      if (isMod && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        setZoom(Math.max(0.2, zoom / 1.15));
      }
      if (isMod && e.key === '0') {
        e.preventDefault();
        setZoom(1.0);
      }

      // Smart Alignment: Cmd+Shift+H → Center H on Page, Cmd+Shift+V → Center V on Page
      if (isMod && isShift && key === 'h' && selectedComponentIds.length > 0) {
        e.preventDefault();
        const store = useDesignerStore.getState();
        const { width: pageW } = getPaperDimensions(
          store.schema.page.size,
          store.schema.page.orientation
        );
        for (const id of selectedComponentIds) {
          const comp = store.componentRegistry[id];
          if (comp) {
            store.updateComponent(id, { x: (pageW - (comp.width || 0)) / 2 });
          }
        }
      }
      if (isMod && isShift && key === 'v' && selectedComponentIds.length > 0) {
        // Skip if it conflicts with Paste (Cmd+V without shift)
        e.preventDefault();
        alignToPage('page-center-v');
      }

      // Alignment Shortcuts: Alt + Key
      if (e.altKey && selectedComponentIds.length > 1) {
        switch (e.key.toLowerCase()) {
          case 'l':
            e.preventDefault();
            alignSelected('left');
            break;
          case 'c':
            e.preventDefault();
            alignSelected('center');
            break;
          case 'r':
            e.preventDefault();
            alignSelected('right');
            break;
          case 't':
            e.preventDefault();
            alignSelected('top');
            break;
          case 'm':
            e.preventDefault();
            alignSelected('middle');
            break;
          case 'b':
            e.preventDefault();
            alignSelected('bottom');
            break;
          case 'h':
            e.preventDefault();
            distributeSelected('dist-h');
            break;
          case 'v':
            e.preventDefault();
            distributeSelected('dist-v');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
