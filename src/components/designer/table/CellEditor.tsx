'use client';

import { extractJsonPaths, formatBinding, getValueType } from '@/lib/utils/json-path';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BindingHighlighter } from '../ui/BindingHighlighter';

interface Props {
  initialValue: string;
  onSave: (val: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  readOnly?: boolean;
}

export function CellEditor({
  initialValue,
  onSave,
  className,
  style,
  placeholder,
  readOnly = false,
}: Props) {
  const [val, setVal] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 224 });
  const ref = useRef<HTMLTextAreaElement>(null);
  const sampleData = useDesignerStore((s) => s.sampleData);

  const allPaths = useMemo(() => extractJsonPaths(sampleData), [sampleData]);
  const suggestions = useMemo(() => {
    const q = query.toLowerCase();
    return (q ? allPaths.filter((path) => path.toLowerCase().includes(q)) : allPaths).slice(0, 40);
  }, [allPaths, query]);

  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  const adjustHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: val triggers height adjustment
  useEffect(() => {
    adjustHeight();
  }, [val, adjustHeight]);

  const getCurrentBinding = useCallback(() => {
    const el = ref.current;
    if (!el) return null;
    const beforeCursor = el.value.slice(0, el.selectionStart);
    const match = beforeCursor.match(/\{\{([^}]*)$/);
    return match ? match[1] : null;
  }, []);

  const updateAutocomplete = useCallback(() => {
    const current = getCurrentBinding();
    if (current === null || readOnly) {
      setIsOpen(false);
      setQuery('');
      return;
    }
    setIsOpen(true);
    setQuery(current);
    setSelectedIndex(0);
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 224),
      });
    }
  }, [getCurrentBinding, readOnly]);

  const insertPath = useCallback(
    (path: string) => {
      const el = ref.current;
      if (!el) return;
      const cursor = el.selectionStart;
      const beforeCursor = val.slice(0, cursor);
      const afterCursor = val.slice(cursor);
      const bindingStart = beforeCursor.lastIndexOf('{{');
      if (bindingStart === -1) return;

      let finalAfterCursor = afterCursor;
      if (finalAfterCursor.startsWith('}}')) finalAfterCursor = finalAfterCursor.slice(2);
      else if (finalAfterCursor.startsWith('}')) finalAfterCursor = finalAfterCursor.slice(1);

      const inserted = formatBinding(path);
      const next = `${beforeCursor.slice(0, bindingStart)}${inserted}${finalAfterCursor}`;
      setVal(next);
      setIsOpen(false);
      setQuery('');
      requestAnimationFrame(() => {
        const pos = bindingStart + inserted.length;
        el.setSelectionRange(pos, pos);
        el.focus();
      });
    },
    [val]
  );

  return (
    <div className="relative w-full">
      <BindingHighlighter
        value={val}
        placeholder={readOnly ? undefined : placeholder}
        className={clsx(
          className,
          'pointer-events-none absolute inset-0 min-h-[1.4em] whitespace-pre-wrap break-words p-0'
        )}
        style={style}
      />
      <textarea
        ref={ref}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : 0}
        className={clsx(
          className,
          'resize-none overflow-hidden min-h-[1.4em] p-0 block bg-transparent w-full',
          'focus:outline-none focus:ring-0',
          readOnly && 'pointer-events-none select-none'
        )}
        style={{
          ...style,
          height: 'auto',
          color: 'transparent',
          caretColor: (style?.color as string | undefined) ?? '#2563eb',
          WebkitTextFillColor: 'transparent',
        }}
        rows={1}
        value={val}
        placeholder=""
        onChange={(e) => {
          if (readOnly) return;
          setVal(e.target.value);
          requestAnimationFrame(updateAutocomplete);
        }}
        onMouseDown={(e) => {
          if (readOnly) e.preventDefault();
        }}
        onBlur={() => {
          if (readOnly) return;
          window.setTimeout(() => setIsOpen(false), 120);
          onSave(val);
        }}
        onKeyDown={(e) => {
          if (readOnly) return;
          if (isOpen && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelectedIndex((idx) => (idx + 1) % suggestions.length);
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelectedIndex((idx) => (idx - 1 + suggestions.length) % suggestions.length);
              return;
            }
            if (e.key === 'Tab' || e.key === 'Enter') {
              e.preventDefault();
              insertPath(suggestions[selectedIndex]);
              return;
            }
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />

      {isOpen &&
        suggestions.length > 0 &&
        createPortal(
          <div
            className="fixed z-[2200] max-h-44 overflow-y-auto rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-xl"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              minWidth: dropdownPosition.width,
            }}
            data-variable-dropdown="true"
          >
            {suggestions.map((path, index) => {
              const selected = index === selectedIndex;
              const type = getValueType(sampleData, path);
              return (
                <button
                  key={path}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertPath(path);
                  }}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[10.5px]',
                    selected
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  )}
                >
                  <span className="flex-1 truncate font-mono">{path}</span>
                  <span className="text-[8px] opacity-70">{type}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
