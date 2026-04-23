'use client';

import { extractJsonPaths, formatBinding, getValueType, groupPathsByParent } from '@/lib/utils/json-path';
import { FileText, Hash, Box, List, Braces } from 'lucide-react';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import ReactDOM from 'react-dom';

interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
  sampleData: Record<string, any>;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  textareaClassName?: string;
  inline?: boolean; // For inline editor mode
  onExit?: () => void; // Called when user wants to finish editing
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
  textareaClassName = '',
  inline = false,
  onExit
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

  const filteredPaths = useMemo(() => {
    if (!searchQuery) return allPaths.slice(0, 50);
    return allPaths.filter((p) =>
      p.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 50);
  }, [allPaths, searchQuery]);

  const groupedPaths = useMemo(() => {
    return groupPathsByParent(filteredPaths);
  }, [filteredPaths]);

  const getCurrentBinding = useCallback(() => {
    if (!editorRef.current) return null;
    const textarea = editorRef.current;
    const cursorPos = textarea.selectionStart;
    const beforeCursor = value.substring(0, cursorPos);
    const match = beforeCursor.match(/\{\{([^}]*)$/);
    return match ? match[1] : null;
  }, [value]);

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
          left: rect.left + Math.min(rect.width - 200, 20)
        });
      }
    } else {
      setIsOpen(false);
      setSearchQuery('');
    }
  }, [getCurrentBinding]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    requestAnimationFrame(updateDropdownState);
  }, [onChange, updateDropdownState]);

  const insertPath = useCallback((path: string) => {
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
  }, [value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || filteredPaths.length === 0) {
      if (e.key === 'Tab') {
        const currentBinding = getCurrentBinding();
        if (currentBinding !== null && filteredPaths.length > 0) {
          e.preventDefault();
          insertPath(filteredPaths[0]);
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
        setSelectedIndex((prev) => (prev + 1) % filteredPaths.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredPaths.length) % filteredPaths.length);
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (filteredPaths[selectedIndex]) {
          insertPath(filteredPaths[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  }, [isOpen, filteredPaths, selectedIndex, getCurrentBinding, onExit, insertPath]);

  // Highlight variables in the text with colorful parts
  const highlightedContent = useMemo(() => {
    // Process text for display: escape HTML-like characters and wrap bindings
    const parts = value.split(/(\{\{[^}]*\}\})/g);
    return parts.map((part, i) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        const content = part.slice(2, -2);
        const segments = content.split(/(\.)/g);
        
        return (
          <span key={i} className="bg-blue-50/80 rounded-[2px]">
            <span className="text-blue-500 opacity-70">{'{{'}</span>
            {segments.map((seg, si) => {
              if (seg === '.') return <span key={si} className="text-slate-400">.</span>;
              // High contrast colors for visibility
              const colorClass = si === 0 ? 'text-orange-600' : si === 2 ? 'text-pink-600' : 'text-blue-600';
              return <span key={si} className={colorClass}>{seg}</span>;
            })}
            <span className="text-blue-500 opacity-70">{'}}'}</span>
          </span>
        );
      }
      // For literal text, we use slate-700 for good contrast since we removed font-bold
      return <span key={i} className="text-slate-700">{part || ''}</span>;
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
    return () => { if (document.body.contains(container)) document.body.removeChild(container); };
  }, []);

  const sharedStyles: React.CSSProperties = {
    fontFamily: style.fontFamily || 'Sarabun, sans-serif',
    fontSize: style.fontSize || '11px',
    lineHeight: style.lineHeight || 1.2,
    letterSpacing: style.letterSpacing || 'normal',
    textAlign: (style as any).textAlign || 'left',
    padding: inline ? 0 : '8px', 
    margin: 0,
    boxSizing: 'border-box',
    width: '100%',
    height: '100%',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  return (
    <div className={clsx('relative bg-transparent group select-text h-full overflow-hidden', className)} style={style}>
      {/* 
        CLEAN STRATEGY: 
        1. Mirror Div (Bottom Layer) -> Shows COLORS and TEXT.
        2. Textarea (Top Layer) -> Transparent Text, but handles Cursor/Input.
        This removes ghosting because only ONE layer of text is visible (the Mirror).
      */}

      {/* Highlighting Overlay (Display Layer - Visible) */}
      <div
        ref={highlightRef}
        className="absolute inset-0 select-none border-none z-[1]"
        style={sharedStyles}
      >
        {highlightedContent}
        {/* Fix for textarea trailing newline cursor positioning */}
        {value.endsWith('\n') && <br />}
        {/* Placeholder replication */}
        {!value && (
          <span className="text-slate-300 pointer-events-none italic">
            {placeholder}
          </span>
        )}
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
      {portalContainer && isOpen && filteredPaths.length > 0 && ReactDOM.createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsOpen(false)}
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
            className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in duration-100"
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
                    const globalIndex = filteredPaths.indexOf(path);
                    const isSelected = globalIndex === selectedIndex;
                    const type = getValueType(sampleData, path);
                    return (
                      <button
                        key={path}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); insertPath(path); }}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={clsx(
                          'w-full flex items-center gap-2 px-2 py-1.5',
                          'text-[10.5px] text-left rounded-md transition-all',
                          isSelected ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-50 text-slate-600'
                        )}
                      >
                        <TypeIcon type={type} />
                        <span className="flex-1 font-mono truncate">{path}</span>
                        <span className={clsx("text-[8px] px-1 rounded border", isSelected ? "border-blue-400 text-blue-100" : "border-slate-200 text-slate-400")}>
                          {type}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="px-2 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">
                {filteredPaths.length} Results
              </span>
              <div className="flex gap-2">
                <kbd className="px-1 text-[8px] bg-white border border-slate-200 rounded text-slate-400">↑↓</kbd>
                <kbd className="px-1 text-[8px] bg-white border border-slate-200 rounded text-slate-400">Enter</kbd>
              </div>
            </div>
          </div>
        </>,
        portalContainer
      )}
    </div>
  );
}
