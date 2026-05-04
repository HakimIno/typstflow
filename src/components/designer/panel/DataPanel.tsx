'use client';

import { DesignerInput } from '@/components/shared/DesignerInput';
import {
  extractJsonPaths,
  formatBinding,
  getValueType,
  resolvePath,
  setNestedValue,
} from '@/lib/utils/json-path';
import { useDesignerStore } from '@/store/designer-store';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Editor } from '@monaco-editor/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { clsx } from 'clsx';
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  Hash,
  List,
  Search,
  Type,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { BasePanel } from './BasePanel';
import { PanelHeader } from './PanelHeader';

export const DataPanel = memo(function DataPanel() {
  const { sampleData, setSampleData, schema, theme } = useDesignerStore(
    useShallow((state) => ({
      sampleData: state.sampleData,
      setSampleData: state.setSampleData,
      schema: state.schema,
      theme: state.theme,
    }))
  );
  const [view, setView] = useState<'explorer' | 'editor'>('explorer');
  const [jsonString, setJsonString] = useState(JSON.stringify(sampleData, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [hoveredItem, setHoveredItem] = useState<{
    path: string;
    type: string;
    rect: DOMRect;
  } | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const handleFromSchema = useCallback(() => {
    let result: Record<string, unknown> = {};
    for (const field of schema.dataSchema) {
      const defaultVal =
        field.example !== undefined
          ? field.example
          : field.type === 'number'
            ? 0
            : field.type === 'boolean'
              ? false
              : field.type === 'array'
                ? []
                : field.type === 'date'
                  ? '2024-01-01'
                  : '';
      result = setNestedValue(result, field.path, defaultVal);
    }
    setSampleData(result);
  }, [schema.dataSchema, setSampleData]);

  useEffect(() => {
    setJsonString(JSON.stringify(sampleData, null, 2));
  }, [sampleData]);

  const allPaths = useMemo(() => {
    return extractJsonPaths(sampleData);
  }, [sampleData]);

  const filteredPaths = useMemo(() => {
    if (!searchQuery) return allPaths;
    return allPaths.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allPaths, searchQuery]);

  type VirtualItem =
    | { type: 'header'; label: string; id: string }
    | { type: 'field'; path: string; dataType: string; id: string };

  const virtualDataItems = useMemo(() => {
    const groups: Record<string, { paths: string[]; label: string }> = {
      string: { paths: [], label: 'Strings' },
      number: { paths: [], label: 'Numbers' },
      boolean: { paths: [], label: 'Booleans' },
      object: { paths: [], label: 'Objects' },
      array: { paths: [], label: 'Arrays' },
      undefined: { paths: [], label: 'Other' },
    };

    for (const path of filteredPaths) {
      const dataType = getValueType(sampleData, path);
      groups[dataType].paths.push(path);
    }

    const result: VirtualItem[] = [];
    for (const [key, group] of Object.entries(groups)) {
      if (group.paths.length > 0) {
        result.push({ type: 'header', label: group.label, id: `header-${key}` });
        if (!collapsedGroups[group.label]) {
          for (const path of group.paths) {
            result.push({
              type: 'field',
              path,
              dataType: getValueType(sampleData, path),
              id: `field-${path}`,
            });
          }
        }
      }
    }
    return result;
  }, [filteredPaths, sampleData, collapsedGroups]);

  const virtualizer = useVirtualizer({
    count: virtualDataItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (virtualDataItems[index]?.type === 'header' ? 28 : 36),
    overscan: 10,
  });

  const handleJsonChange = (val: string | undefined) => {
    const value = val || '';
    setJsonString(value);
    try {
      if (!value.trim()) {
        setSampleData({});
        setError(null);
        return;
      }
      const parsed = JSON.parse(value);
      setSampleData(parsed);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const loadExample = () => {
    const example = {
      invoice_no: 'INV-2024-888',
      date: '2024-04-09',
      customer: {
        name: 'บริษัท เทคโนโลยี จำกัด',
        address: '123 ถนนสุขุมวิท กรุงเทพฯ',
      },
      items: [
        { description: 'Industrial Controller v2', qty: 2, price: 15000, total: 30000 },
        { description: 'Sensor Array XP', qty: 5, price: 2500, total: 12500 },
      ],
      subtotal: 42500,
      vat: 2975,
      total: 45475,
    };
    handleJsonChange(JSON.stringify(example, null, 2));
  };

  return (
    <BasePanel>
      <PanelHeader
        actions={
          <div className="flex items-center gap-1.5">
            {schema.dataSchema.length > 0 && (
              <button
                type="button"
                onClick={handleFromSchema}
                className="text-[9px] text-[var(--accent)] hover:text-[var(--text-primary)] font-bold uppercase tracking-wider border border-[var(--accent)]/40 px-2 py-0.5 rounded-[4px] hover:bg-[var(--accent)]/10 transition-colors"
              >
                From Schema
              </button>
            )}
            <button
              type="button"
              onClick={loadExample}
              className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold uppercase tracking-wider border border-[var(--border-subtle)] px-2 py-0.5 rounded-[4px] hover:bg-white/5 transition-colors"
            >
              Example
            </button>
          </div>
        }
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setView('explorer')}
            className={clsx(
              'flex items-center gap-1.5 py-1 transition-colors relative',
              view === 'explorer'
                ? 'text-[var(--accent)] font-bold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            <Database className="w-3.5 h-3.5" />
            <span className="text-[9px] uppercase tracking-widest">Explorer</span>
            {view === 'explorer' && (
              <div className="absolute -bottom-[9.5px] left-0 right-0 h-0.5 bg-[var(--accent)]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setView('editor')}
            className={clsx(
              'flex items-center gap-1.5 py-1 transition-colors relative',
              view === 'editor'
                ? 'text-[var(--accent)] font-bold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            <Braces className="w-3.5 h-3.5" />
            <span className="text-[9px] uppercase tracking-widest">JSON</span>
            {view === 'editor' && (
              <div className="absolute -bottom-[9.5px] left-0 right-0 h-0.5 bg-[var(--accent)]" />
            )}
          </button>
        </div>
      </PanelHeader>

      {view === 'editor' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 relative group">
            <Editor
              height="100%"
              defaultLanguage="json"
              theme={theme === 'dark' ? 'typstflow-dark' : 'light'}
              value={jsonString}
              onChange={handleJsonChange}
              beforeMount={(monaco) => {
                monaco.editor.defineTheme('typstflow-dark', {
                  base: 'vs-dark',
                  inherit: true,
                  rules: [
                    { token: 'string.key.json', foreground: '7dd3fc', fontStyle: 'bold' },
                    { token: 'string.value.json', foreground: '4ade80' },
                    { token: 'number', foreground: 'fbbf24' },
                    { token: 'keyword', foreground: 'c084fc' },
                    { token: 'comment', foreground: '71717a' },
                  ],
                  colors: {
                    'editor.background': '#00000000',
                    'editor.foreground': '#ecedee',
                    'editorLineNumber.foreground': '#3f3f46',
                    'editorLineNumber.activeForeground': '#71717a',
                    'editor.lineHighlightBackground': '#ffffff03',
                  },
                });
              }}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 11,
                lineNumbers: 'on',
                tabSize: 2,
                fontFamily: "'JetBrains Mono', monospace",
                padding: { top: 12, bottom: 12 },
              }}
            />
            {/* Error Indicator */}
            <div className="absolute bottom-3 right-3 z-10">
              {error ? (
                <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-red-500 text-white rounded text-[9px] font-bold uppercase tracking-wider">
                  <AlertCircle className="w-3 h-3" />
                  Invalid JSON
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-green-500 text-white rounded text-[9px] font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-3 h-3" />
                  Valid
                </div>
              )}
            </div>
          </div>
          {error && (
            <div className="p-2 bg-red-600 text-white text-[9px] font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 bg-white/[0.01]">
          <div className="p-2 border-b border-[var(--border-default)] shrink-0">
            <div className="relative group">
              <DesignerInput
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(v: string) => setSearchQuery(v)}
                className="pr-8"
              />
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] group-focus-within:text-[var(--text-secondary)] transition-colors" />
            </div>
          </div>
          <div ref={parentRef} className="flex-1 overflow-y-auto scrollbar-hide">
            {filteredPaths.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] p-8 text-center">
                <Database className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-[10px]">No data fields found.</p>
              </div>
            ) : (
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const item = virtualDataItems[virtualRow.index];
                  if (!item) return null;

                  return (
                    <div
                      key={virtualRow.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                        padding: '0 8px',
                      }}
                    >
                      {item.type === 'header' ? (
                        <ExplorerHeader
                          label={item.label}
                          isCollapsed={!!collapsedGroups[item.label]}
                          onToggle={() =>
                            setCollapsedGroups((prev) => ({
                              ...prev,
                              [item.label]: !prev[item.label],
                            }))
                          }
                        />
                      ) : (
                        <ExplorerItem
                          path={item.path}
                          type={item.dataType}
                          onHover={(rect) =>
                            setHoveredItem({ path: item.path, type: item.dataType, rect })
                          }
                          onLeave={() => setHoveredItem(null)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {hoveredItem &&
        createPortal(
          <FieldTooltip
            path={hoveredItem.path}
            type={hoveredItem.type}
            rect={hoveredItem.rect}
            sampleData={sampleData}
          />,
          document.body
        )}
    </BasePanel>
  );
});

function ExplorerHeader({
  label,
  isCollapsed,
  onToggle,
}: {
  label: string;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const Icon =
    label === 'Strings'
      ? Type
      : label === 'Numbers'
        ? Hash
        : label === 'Objects'
          ? Braces
          : label === 'Arrays'
            ? List
            : Database;

  return (
    <button
      type="button"
      className="flex items-center gap-2 py-1 px-1.5 mb-1 mt-2 first:mt-1 cursor-pointer group/header w-full text-left"
      onClick={onToggle}
    >
      <div className="flex items-center gap-1.5">
        <ChevronRight
          className={clsx(
            'w-3 h-3 text-[var(--text-muted)] transition-transform duration-200',
            !isCollapsed && 'rotate-90'
          )}
        />
        <Icon className="w-3 h-3 text-[var(--text-muted)] group-hover/header:text-[var(--text-secondary)] transition-colors" />
        <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.15em] group-hover/header:text-[var(--text-secondary)] transition-colors">
          {label}
        </span>
      </div>
      <div className="flex-1 h-px bg-[var(--border-subtle)] opacity-50" />
    </button>
  );
}

function ExplorerItem({
  path,
  type,
  onHover,
  onLeave,
}: {
  path: string;
  type: string;
  onHover: (rect: DOMRect) => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return draggable({
      element: el,
      getInitialData: () => ({
        type: 'new-component',
        component: {
          type: 'text',
          content: formatBinding(path),
          width: 40,
          height: 8,
          style: { fontSize: 10 },
        },
        dragOffsetX: 20,
        dragOffsetY: 4,
      }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [path]);

  const Icon =
    type === 'string'
      ? Type
      : type === 'number'
        ? Hash
        : type === 'object'
          ? Braces
          : type === 'array'
            ? List
            : Database;

  const handleCopy = () => navigator.clipboard.writeText(formatBinding(path));

  return (
    <div
      ref={ref}
      className={clsx(
        'group flex items-center gap-2.5 px-2 py-1 rounded-xl transition-all border border-transparent cursor-grab active:cursor-grabbing hover:bg-[var(--bg-widget)] hover:border-[var(--border-subtle)] hover:shadow-sm w-full text-left outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]',
        isDragging && 'opacity-40 grayscale'
      )}
      onClick={handleCopy}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCopy();
        }
      }}
      onMouseEnter={(e) => onHover((e.currentTarget as HTMLElement).getBoundingClientRect())}
      onMouseLeave={onLeave}
    >
      <div className="w-5 h-5 p-0.5 rounded-full bg-[var(--bg-widget)] flex items-center justify-center shrink-0 border border-[var(--border-subtle)] group-hover:bg-[var(--bg-surface)] group-hover:border-[var(--accent)] transition-all ">
        <Icon className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate transition-colors group-hover:text-[var(--accent)]">
          {path}
        </p>
        <p className="text-[9px] text-[var(--text-muted)] truncate font-medium uppercase tracking-wider">
          {type}
        </p>
      </div>

      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[var(--bg-surface)] rounded-md text-[var(--text-muted)] hover:text-[var(--accent)] transition-all shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          handleCopy();
        }}
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function FieldTooltip({
  path,
  type,
  rect,
  sampleData,
}: {
  path: string;
  type: string;
  rect: DOMRect;
  sampleData: Record<string, unknown>;
}) {
  const rawValue = resolvePath(sampleData, path);

  const displayValue = (() => {
    if (rawValue === undefined || rawValue === null) return '—';
    if (typeof rawValue === 'object') {
      const json = JSON.stringify(rawValue, null, 2);
      return json.length > 300 ? `${json.slice(0, 300)}…` : json;
    }
    return String(rawValue);
  })();

  // Position to the right of the item, vertically centered on it
  const TOOLTIP_H = 220;
  const left = rect.right + 8;
  const top = Math.min(
    Math.max(8, rect.top + rect.height / 2 - TOOLTIP_H / 2),
    window.innerHeight - TOOLTIP_H - 8
  );
  // Arrow vertical offset: where the item's center falls relative to tooltip top
  const arrowTop = rect.top + rect.height / 2 - top;

  const typeColor =
    type === 'string'
      ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
      : type === 'number'
        ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
        : type === 'boolean'
          ? 'text-purple-400 bg-purple-400/10 border-purple-400/30'
          : type === 'array'
            ? 'text-sky-400 bg-sky-400/10 border-sky-400/30'
            : 'text-[var(--text-muted)] bg-white/5 border-[var(--border-subtle)]';

  return (
    <div className="fixed z-[9999] w-56 pointer-events-none" style={{ top, left }}>
      {/* Arrow pointing left, aligned to the hovered item's center */}
      <div
        className="absolute -left-1.5 w-3 h-3 bg-[var(--bg-surface)] border-l border-t border-[var(--border-default)]"
        style={{ top: arrowTop - 6, transform: 'rotate(-45deg)' }}
      />

      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-3 pt-3 pb-2 border-b border-[var(--border-subtle)] flex items-start justify-between gap-2">
          <p className="text-[11px] font-bold text-[var(--text-primary)] break-all leading-tight">
            {path}
          </p>
          <span
            className={clsx(
              'shrink-0 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border',
              typeColor
            )}
          >
            {type}
          </span>
        </div>

        <div className="p-3 space-y-2.5">
          {/* Binding expression */}
          <div>
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Binding
            </p>
            <code className="block text-[10px] font-mono text-emerald-400 bg-black/20 px-2 py-1 rounded border border-[var(--border-subtle)] break-all">
              {`{{${path}}}`}
            </code>
          </div>

          {/* Current value */}
          <div>
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Value
            </p>
            <div className="text-[10px] font-mono text-amber-300 bg-black/20 px-2 py-1.5 rounded border border-[var(--border-subtle)] max-h-28 overflow-y-auto whitespace-pre-wrap break-all">
              {displayValue}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
