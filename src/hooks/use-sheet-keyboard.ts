'use client';

import type { CellCoord, CellsSelection } from '@/components/designer/table/useCellSelection';
import {
  applyPasteToRows,
  buildTsvFromSelection,
  parseClipboardTable,
} from '@/lib/utils/table-clipboard';
import type { SheetNavRow, SheetNavSection } from '@/lib/utils/table-nav';
import { findFlatRow, flattenNavRows, sectionRange, stepCell, tabStep } from '@/lib/utils/table-nav';
import type { AnyTableComponent, TableRow } from '@/types/schema';
import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

interface SheetKeyboardOptions {
  component: AnyTableComponent;
  /** Mount handlers only while THIS table is in sheet-edit mode. */
  enabled: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  sections: SheetNavSection[];
  selectedCell: CellCoord | null;
  selectedCells: CellsSelection | null;
  setSelectedCell: (cell: CellCoord | null) => void;
  setSelectedCells: (cells: CellsSelection | null) => void;
  clearContents: () => void;
  updateComponent: (id: string, updates: Record<string, unknown>) => void;
}

/** React's controlled-textarea write: set via the native setter + input event. */
function setEditorValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (!setter) return;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function isTextInput(el: EventTarget | null): el is HTMLElement {
  const node = el as HTMLElement | null;
  if (!node) return false;
  return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable;
}

/**
 * Excel-style keyboard flow for the table sheet (plan Phase 4):
 * arrows move the active cell (Shift extends within the section), Tab/Enter
 * commit-and-move, F2/typing starts editing, Delete clears, Ctrl+A selects the
 * section, and copy/cut/paste speak TSV so Excel/Sheets round-trips work.
 */
export function useSheetKeyboard(options: SheetKeyboardOptions) {
  // Latest-ref so the window listeners are registered once per `enabled` flip
  // and never see stale state.
  const opts = useRef(options);
  opts.current = options;

  // Focus corner of a Shift-extended range (the anchor is selectedCell).
  const shiftFocusRef = useRef<{ flatRow: number; col: number } | null>(null);

  useEffect(() => {
    if (!options.enabled) return;

    const flatRows = (): SheetNavRow[] => flattenNavRows(opts.current.sections);
    const colCount = () => opts.current.component.columns.length;

    const cellEditorOf = (rowId: string, col: number): HTMLTextAreaElement | null =>
      opts.current.containerRef.current?.querySelector<HTMLTextAreaElement>(
        `[data-cell-row="${CSS.escape(rowId)}"][data-cell-col="${col}"] textarea`
      ) ?? null;

    const isOwnCellEditor = (target: EventTarget | null): target is HTMLTextAreaElement => {
      const container = opts.current.containerRef.current;
      return (
        !!container &&
        target instanceof HTMLTextAreaElement &&
        container.contains(target) &&
        target.closest('[data-cell-row]') !== null
      );
    };

    const setActive = (flat: SheetNavRow[], pos: { flatRow: number; col: number }) => {
      const { component, setSelectedCell, setSelectedCells } = opts.current;
      const nav = flat[pos.flatRow];
      if (!nav) return;
      shiftFocusRef.current = null;
      setSelectedCell({
        tableId: component.id,
        section: nav.section,
        rowId: nav.row.id,
        cellIdx: pos.col,
      });
      setSelectedCells({
        tableId: component.id,
        section: nav.section,
        rowIds: [nav.row.id],
        cellIndices: [pos.col],
      });
    };

    const activePos = (flat: SheetNavRow[]): { flatRow: number; col: number } | null => {
      const { selectedCell } = opts.current;
      if (!selectedCell) return null;
      const flatRow = findFlatRow(flat, selectedCell.rowId);
      if (flatRow === -1) return null;
      return { flatRow, col: selectedCell.cellIdx };
    };

    const startEditing = (mode: 'selectAll' | 'caretEnd' | 'replace', seed = '') => {
      const { selectedCell } = opts.current;
      if (!selectedCell) return;
      const el = cellEditorOf(selectedCell.rowId, selectedCell.cellIdx);
      if (!el) return;
      el.focus();
      if (mode === 'replace') setEditorValue(el, seed);
      if (mode === 'selectAll') el.select();
      else el.setSelectionRange(el.value.length, el.value.length);
    };

    const extendSelection = (dRow: number, dCol: number) => {
      const { component, selectedCell, setSelectedCells } = opts.current;
      if (!selectedCell) return;
      const flat = flatRows();
      const from =
        shiftFocusRef.current ??
        (() => {
          const flatRow = findFlatRow(flat, selectedCell.rowId);
          return flatRow === -1 ? null : { flatRow, col: selectedCell.cellIdx };
        })();
      if (!from) return;
      const range = sectionRange(flat, colCount(), selectedCell.rowId, selectedCell.cellIdx, {
        flatRow: from.flatRow + dRow,
        col: from.col + dCol,
      });
      if (!range) return;
      shiftFocusRef.current = range.focus;
      setSelectedCells({
        tableId: component.id,
        section: range.section,
        rowIds: range.rowIds,
        cellIndices: range.cellIndices,
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const { component, selectedCell, selectedCells, clearContents } = opts.current;
      const editingCell = isOwnCellEditor(e.target);

      // Typing anywhere else (properties panel inputs, dialogs) is not ours.
      if (!editingCell && isTextInput(e.target)) return;

      const flat = flatRows();

      if (editingCell) {
        // Committing keys while the cell editor has focus.
        if (e.key === 'Escape') {
          // Exit the editor but stay in sheet mode (TablePreview's own Escape
          // listener would otherwise close the whole sheet).
          e.stopPropagation();
          (e.target as HTMLTextAreaElement).blur();
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          (e.target as HTMLTextAreaElement).blur(); // commits via CellEditor onBlur
          const pos = activePos(flat);
          if (pos) setActive(flat, tabStep(flat.length, colCount(), pos, e.shiftKey));
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          (e.target as HTMLTextAreaElement).blur();
          const pos = activePos(flat);
          if (pos) setActive(flat, stepCell(flat.length, colCount(), pos, 1, 0));
          return;
        }
        return; // arrows etc. move the caret inside the editor
      }

      // ── Not editing: sheet navigation ────────────────────────────────────
      const arrows: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };

      if (arrows[e.key]) {
        e.preventDefault();
        e.stopPropagation();
        const [dRow, dCol] = arrows[e.key];
        if (e.shiftKey) {
          extendSelection(dRow, dCol);
          return;
        }
        const pos = activePos(flat);
        if (pos) setActive(flat, stepCell(flat.length, colCount(), pos, dRow, dCol));
        else if (flat.length) setActive(flat, { flatRow: 0, col: 0 });
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        const pos = activePos(flat);
        if (pos) setActive(flat, tabStep(flat.length, colCount(), pos, e.shiftKey));
        return;
      }

      if (e.key === 'Enter' || e.key === 'F2') {
        if (!selectedCell) return;
        e.preventDefault();
        e.stopPropagation();
        startEditing(e.key === 'Enter' ? 'selectAll' : 'caretEnd');
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedCells) return;
        e.preventDefault();
        e.stopPropagation();
        clearContents();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        if (!selectedCell) return;
        e.preventDefault();
        e.stopPropagation();
        const sec = opts.current.sections.find(
          (s) =>
            s.section === selectedCell.section && s.rows.some((r) => r.id === selectedCell.rowId)
        );
        if (!sec) return;
        opts.current.setSelectedCells({
          tableId: component.id,
          section: sec.section,
          rowIds: sec.rows.map((r) => r.id),
          cellIndices: Array.from({ length: colCount() }, (_, i) => i),
        });
        return;
      }

      // Printable character → replace the active cell's content (Excel-style).
      if (
        selectedCell &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        e.stopPropagation();
        startEditing('replace', e.key);
      }
    };

    // ── Clipboard (TSV) ──────────────────────────────────────────────────
    const sectionRowsOf = (sectionKey: string): TableRow[] =>
      opts.current.sections.find((s) => s.sectionKey === sectionKey)?.rows ?? [];

    const copySelection = (e: ClipboardEvent): boolean => {
      const { selectedCell, selectedCells } = opts.current;
      if (isTextInput(e.target) || !selectedCells || !selectedCell) return false;
      const flat = flatRows();
      const nav = flat[findFlatRow(flat, selectedCell.rowId)];
      if (!nav) return false;
      const tsv = buildTsvFromSelection(
        sectionRowsOf(nav.sectionKey),
        selectedCells.rowIds,
        selectedCells.cellIndices,
        colCount()
      );
      e.clipboardData?.setData('text/plain', tsv);
      e.preventDefault();
      return true;
    };

    const handleCopy = (e: ClipboardEvent) => {
      copySelection(e);
    };

    const handleCut = (e: ClipboardEvent) => {
      if (copySelection(e)) opts.current.clearContents();
    };

    const handlePaste = (e: ClipboardEvent) => {
      const { component, selectedCell, updateComponent } = opts.current;
      if (isTextInput(e.target) || !selectedCell) return;
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;

      const flat = flatRows();
      const nav = flat[findFlatRow(flat, selectedCell.rowId)];
      if (!nav) return;
      const rows = sectionRowsOf(nav.sectionKey);

      // Only the data band grows to fit the pasted block; header/footer clamp.
      const makeRow =
        nav.section === 'data'
          ? (cols: number): TableRow => ({
              id: `dr-${Math.random().toString(36).substring(7)}`,
              type: 'data',
              cells: Array.from({ length: cols }, () => ({
                id: Math.random().toString(36).substring(7),
                content: '',
              })),
            })
          : undefined;

      const newRows = applyPasteToRows(
        rows,
        nav.rowIdxInSection,
        selectedCell.cellIdx,
        parseClipboardTable(text),
        colCount(),
        makeRow
      );
      if (!newRows) return;
      e.preventDefault();
      // Writing the rendered rows back also materializes synthetic legacy rows
      // into structured schema rows — the intended one-way migration moment.
      updateComponent(component.id, { [nav.sectionKey]: newRows });
    };

    // Capture phase: runs before CellEditor's own handlers and before the
    // canvas-level shortcut listeners.
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('copy', handleCopy);
    window.addEventListener('cut', handleCut);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('cut', handleCut);
      window.removeEventListener('paste', handlePaste);
    };
  }, [options.enabled]);
}
