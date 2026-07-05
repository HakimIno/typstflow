'use client';

import {
  extractJsonPaths,
  formatBinding,
  getValueType,
  groupPathsByParent,
} from '@/lib/utils/json-path';
import type { TextStyle } from '@/types/schema';
import { clsx } from 'clsx';
import { Box, FileText, Hash, List } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
  sampleData: Record<string, any>;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  textStyle?: TextStyle;
  textareaClassName?: string;
  inline?: boolean; // For inline editor mode
  onExit?: () => void; // Called when user wants to finish editing
  autoHeight?: boolean; // For flow mode where editor should grow with content
}

// Type icons mapping
const TypeIcon = ({ type, size = 12 }: { type: string; size?: number }) => {
  switch (type) {
    case 'string':
      return <FileText className={clsx('text-blue-500')} style={{ width: size, height: size }} />;
    case 'number':
      return <Hash className={clsx('text-green-500')} style={{ width: size, height: size }} />;
    case 'boolean':
      return <Box className={clsx('text-purple-500')} style={{ width: size, height: size }} />;
    case 'array':
      return <List className={clsx('text-orange-500')} style={{ width: size, height: size }} />;
    default:
      return <FileText className={clsx('text-slate-400')} style={{ width: size, height: size }} />;
  }
};

export function TextEditor({
  value,
  onChange,
  sampleData,
  placeholder = 'Type static text or {{binding}}...',
  className = '',
  style = {},
  textStyle = {},
  textareaClassName = '',
  inline = false,
  onExit,
  autoHeight = false,
}: TextEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Synchronization: Keep scroll position of overlay in sync with textarea
  const handleScroll = useCallback(() => {
    if (editorRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = editorRef.current.scrollTop;
      highlightRef.current.scrollLeft = editorRef.current.scrollLeft;
    }
  }, []);

  // Extract all paths from sample data
  const allPaths = useMemo(() => {
    if (!sampleData || Object.keys(sampleData).length === 0) return [];
    return extractJsonPaths(sampleData);
  }, [sampleData]);

  const suggestions = useMemo(() => {
    const aggregateFuncs = ['SUM(', 'COUNT(', 'AVG(', 'MIN(', 'MAX('];

    // Check if user is typing a function
    const funcMatch = searchQuery.match(/^(SUM|COUNT|AVG|MIN|MAX)\((.*)$/i);
    if (funcMatch) {
      const funcName = funcMatch[1].toUpperCase();
      const subQuery = funcMatch[2];

      const numericPaths = allPaths.filter(
        (p) => getValueType(sampleData, p) === 'number' || p.includes('[*]')
      );
      const filtered = subQuery
        ? numericPaths.filter((p) => p.toLowerCase().includes(subQuery.toLowerCase()))
        : numericPaths;

      return filtered.map((p) => `${funcName}(${p})`).slice(0, 50);
    }

    const filtered = searchQuery
      ? allPaths.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
      : allPaths;

    // Merge aggregate starters with normal paths
    return [
      ...aggregateFuncs.filter((f) => f.toLowerCase().includes(searchQuery.toLowerCase())),
      ...filtered,
    ].slice(0, 50);
  }, [allPaths, searchQuery, sampleData]);

  const groupedPaths = useMemo(() => {
    // If it's a function suggestion, don't group or group under 'Functions'
    const isFunc = suggestions.some((s) => s.includes('('));
    if (isFunc) {
      return [{ name: 'Functions & Data', paths: suggestions }];
    }
    return groupPathsByParent(suggestions);
  }, [suggestions]);

  const getCurrentBinding = useCallback(() => {
    if (!editorRef.current) return null;
    const textarea = editorRef.current;
    const cursorPos = textarea.selectionStart;
    const beforeCursor = textarea.value.substring(0, cursorPos);
    const match = beforeCursor.match(/\{\{([^}]*)$/);
    return match ? match[1] : null;
  }, []);

  const updateDropdownState = useCallback(() => {
    const currentBinding = getCurrentBinding();

    if (currentBinding !== null) {
      setIsOpen(true);
      setSearchQuery(currentBinding);
      setSelectedIndex(0);

      if (editorRef.current) {
        const textarea = editorRef.current;
        const rect = textarea.getBoundingClientRect();

        // Estimation of cursor position for floating dropdown
        // This is a simplified version, real cursor positioning requires a hidden mirror span
        setDropdownPosition({
          top: rect.top + 30,
          left: rect.left + Math.min(rect.width - 200, 20),
        });
      }
    } else {
      setIsOpen(false);
      setSearchQuery('');
    }
  }, [getCurrentBinding]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      requestAnimationFrame(updateDropdownState);
    },
    [onChange, updateDropdownState]
  );

  const insertPath = useCallback(
    (path: string) => {
      if (!editorRef.current) return;
      const textarea = editorRef.current;
      const cursorPos = textarea.selectionStart;
      const beforeCursor = value.substring(0, cursorPos);
      const afterCursor = value.substring(cursorPos);

      const bindingStart = beforeCursor.lastIndexOf('{{');
      if (bindingStart === -1) return;

      let finalAfterCursor = afterCursor;
      if (afterCursor.startsWith('}}')) {
        finalAfterCursor = afterCursor.substring(2);
      } else if (afterCursor.startsWith('}')) {
        finalAfterCursor = afterCursor.substring(1);
      }

      const insertedText = formatBinding(path);
      const newValue = beforeCursor.substring(0, bindingStart) + insertedText + finalAfterCursor;

      onChange(newValue);
      setIsOpen(false);
      setSearchQuery('');

      setTimeout(() => {
        if (textarea) {
          const newPos = bindingStart + insertedText.length;
          textarea.setSelectionRange(newPos, newPos);
          textarea.focus();
        }
      }, 0);
    },
    [value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) {
        if (e.key === 'Tab') {
          const currentBinding = getCurrentBinding();
          if (currentBinding !== null && suggestions.length > 0) {
            e.preventDefault();
            insertPath(suggestions[0]);
            return;
          }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          // If no autocomplete, finish editing
          onExit?.();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            insertPath(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [isOpen, suggestions, selectedIndex, getCurrentBinding, onExit, insertPath]
  );

  // Highlight variables in the text with colorful parts
  const highlightedContent = useMemo(() => {
    // Process text for display: escape HTML-like characters and wrap bindings
    const parts = value.split(/(\{\{[^}]*\}\})/g);
    return parts.map((part, i) => {
      const isBinding = /^\{\{[^}]*\}\}$/.test(part);
      if (!isBinding) return <span key={i}>{part || ''}</span>;
      const path = part.slice(2, -2).trim();
      return (
        <span
          key={i}
          className="rounded-[3px] border border-sky-400/20 bg-sky-400/10 px-1 font-mono shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]"
        >
          <span className="text-fuchsia-500">{'{{'}</span>
          <span className="text-sky-600">{path}</span>
          <span className="text-fuchsia-500">{'}}'}</span>
        </span>
      );
    });
  }, [value]);

  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.zIndex = '9999';
    container.style.top = '0';
    container.style.left = '0';
    document.body.appendChild(container);
    setPortalContainer(container);
    return () => {
      if (document.body.contains(container)) document.body.removeChild(container);
    };
  }, []);

  const inlineInitialized = useRef(false);
  useEffect(() => {
    if (inline && editorRef.current && !inlineInitialized.current) {
      inlineInitialized.current = true;
      editorRef.current.focus();
      const len = editorRef.current.value.length;
      editorRef.current.setSelectionRange(len, len);
    }
  }, [inline]);

  const sharedStyles: React.CSSProperties = {
    fontFamily: `${textStyle.fontFamily || 'Sarabun'}, "Geist", "Inter", "Sarabun-Local", "Noto Sans Thai", sans-serif`,
    fontSize: textStyle.fontSize ? `${textStyle.fontSize}pt` : '10pt',
    lineHeight: textStyle.lineHeight || 1.4,
    letterSpacing: textStyle.letterSpacing || 'normal',
    fontWeight: textStyle.fontWeight === 'bold' ? 'bold' : 'normal',
    fontStyle: textStyle.italic ? 'italic' : 'normal',
    textDecoration: textStyle.underline ? 'underline' : 'none',
    color: textStyle.color || '#0f172a',
    textAlign: (textStyle as any).textAlign || 'left',
    padding: inline ? 0 : '8px',
    margin: 0,
    boxSizing: 'border-box',
    width: '100%',
    height: autoHeight ? 'auto' : '100%',
    minHeight: autoHeight ? 'inherit' : undefined,
    overflow: autoHeight ? 'visible' : 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  return (
    <div
      className={clsx(
        'relative bg-transparent group select-text',
        autoHeight ? 'h-auto' : 'h-full overflow-hidden',
        className
      )}
      style={style}
    >
      {/* 
        CLEAN STRATEGY: 
        1. Mirror Div (Bottom Layer) -> Shows COLORS and TEXT.
        2. Textarea (Top Layer) -> Transparent Text, but handles Cursor/Input.
        This removes ghosting because only ONE layer of text is visible (the Mirror).
      */}

      {/* Highlighting Overlay (Display Layer - Visible) */}
      <div
        ref={highlightRef}
        className={clsx(
          'select-none border-none z-[1]',
          autoHeight ? 'relative min-h-[1em]' : 'absolute inset-0'
        )}
        style={sharedStyles}
      >
        {highlightedContent}
        {/* Fix for textarea trailing newline cursor positioning */}
        {value.endsWith('\n') && <br />}
        {/* Placeholder replication */}
        {!value && <span className="text-slate-300 pointer-events-none italic">{placeholder}</span>}
      </div>

      {/* Input Layer (Logic Layer - Transparent Text) */}
      <textarea
        ref={editorRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        onBlur={handleScroll}
        className={clsx(
          'absolute inset-0 bg-transparent caret-blue-600 border-none',
          'focus:ring-0 focus:outline-none resize-none z-[2]',
          textareaClassName
        )}
        style={{
          ...sharedStyles,
          color: 'transparent', // IMPORTANT: Hide native text to show mirror text only
          caretColor: '#2563eb',
        }}
        spellCheck={false}
      />

      {/* Dropdown Portal */}
      {portalContainer &&
        isOpen &&
        suggestions.length > 0 &&
        ReactDOM.createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[9998] cursor-default bg-transparent w-full h-full border-none p-0"
              onClick={() => setIsOpen(false)}
              onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
              aria-label="Close suggestions"
            />
            <div
              ref={dropdownRef}
              style={{
                position: 'fixed',
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                minWidth: '220px',
                zIndex: 9999,
              }}
              className="bg-[var(--bg-surface)] rounded-lg shadow-xl border border-[var(--border-default)] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-100"
              data-variable-dropdown="true"
            >
              <div className="p-1.5 overflow-y-auto max-h-48 space-y-0.5">
                {groupedPaths.map((group) => (
                  <div key={group.name} className="space-y-0.5">
                    {group.name !== 'root' && (
                      <div className="px-2 py-0.5 text-[8px] font-bold text-slate-400 tracking-wider uppercase">
                        {group.name}
                      </div>
                    )}
                    {group.paths.map((path) => {
                      const globalIndex = suggestions.indexOf(path);
                      const isSelected = globalIndex === selectedIndex;
                      const type = getValueType(sampleData, path);
                      return (
                        <button
                          key={path}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            insertPath(path);
                          }}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={clsx(
                            'w-full flex items-center gap-2 px-2 py-1.5',
                            'text-[10.5px] text-left rounded-md transition-all',
                            isSelected
                              ? 'bg-[var(--accent)] text-white shadow-sm'
                              : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                          )}
                        >
                          <TypeIcon type={type} />
                          <span className="flex-1 font-mono truncate">{path}</span>
                          <span
                            className={clsx(
                              'text-[8px] px-1 rounded border',
                              isSelected
                                ? 'border-[var(--accent-glow)] text-white/90'
                                : 'border-[var(--border-default)] text-[var(--text-muted)]'
                            )}
                          >
                            {type}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="px-2 py-1.5 bg-[var(--bg-widget)] border-t border-[var(--border-default)] flex items-center justify-between">
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">
                  {suggestions.length} Results
                </span>
                <div className="flex gap-2">
                  <kbd className="px-1 text-[8px] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-[var(--text-muted)]">
                    ↑↓
                  </kbd>
                  <kbd className="px-1 text-[8px] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-[var(--text-muted)]">
                    Enter
                  </kbd>
                </div>
              </div>
            </div>
          </>,
          portalContainer
        )}
    </div>
  );
}
