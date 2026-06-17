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
import { Icon } from '@iconify/react';
import { Editor } from '@monaco-editor/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { clsx } from 'clsx';
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
  const [view, setView] = useState<'explorer' | 'editor'>(() =>
    Object.keys(sampleData).length === 0 ? 'editor' : 'explorer'
  );
  const [jsonString, setJsonString] = useState(JSON.stringify(sampleData, null, 2));
  const [editorKey, setEditorKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [hoveredItem, setHoveredItem] = useState<{
    path: string;
    type: string;
    rect: DOMRect;
  } | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track whether the last sampleData change came from the user typing in this editor
  // vs an external source (AI set_sample_data, loadExample, handleFromSchema).
  // External changes should remount Monaco with fresh content; user edits should not.
  const updateSource = useRef<'user' | 'external'>('external');

  const remountEditor = useCallback((newJson: string) => {
    updateSource.current = 'external';
    setJsonString(newJson);
    setEditorKey((k) => k + 1);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setSampleData(parsed);
      remountEditor(JSON.stringify(parsed, null, 2));
      setError(null);
      // Reset input so the same file can be uploaded again
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(`Failed to parse JSON file: ${err.message}`);
    }
  };

  const _handleFromSchema = useCallback(() => {
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
    remountEditor(JSON.stringify(result, null, 2));
    setSampleData(result);
  }, [schema.dataSchema, setSampleData, remountEditor]);

  // Sync Monaco only when sampleData changed from an external source (not user typing)
  useEffect(() => {
    if (updateSource.current === 'external') {
      remountEditor(JSON.stringify(sampleData, null, 2));
    }
    updateSource.current = 'external';
  }, [sampleData, remountEditor]);

  const allPaths = useMemo(() => {
    return extractJsonPaths(sampleData);
  }, [sampleData]);

  const filteredPaths = useMemo(() => {
    if (!searchQuery) return allPaths;
    return allPaths.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allPaths, searchQuery]);

  type VirtualItem =
    | { type: 'header'; label: string; id: string; count: number }
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
        result.push({
          type: 'header',
          label: group.label,
          id: `header-${key}`,
          count: group.paths.length,
        });
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
    estimateSize: (index) => (virtualDataItems[index]?.type === 'header' ? 31 : 31),
    overscan: 10,
  });

  const handleJsonChange = (val: string | undefined) => {
    const value = val || '';
    setJsonString(value);
    try {
      if (!value.trim()) {
        updateSource.current = 'user';
        setSampleData({});
        setError(null);
        return;
      }
      const parsed = JSON.parse(value);
      updateSource.current = 'user';
      setSampleData(parsed);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCopyAll = useCallback(() => {
    navigator.clipboard.writeText(jsonString);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [jsonString]);

  const loadExample = () => {
    const example = {
      invoice: {
        number: 'INV-2567-00142',
        date: '4 พฤษภาคม 2567',
        dueDate: '4 มิถุนายน 2567',
        subtotal: '85,500.00',
        vat: '5,985.00',
        total: '91,485.00',
        remark: 'กรุณาชำระเงินภายในวันที่กำหนด หากมีข้อสงสัยติดต่อ accounting@techsolutions.co.th',
        paymentTerms: 'Net 30 วัน | โอนเงินผ่านบัญชี ธ.กสิกรไทย 123-4-56789-0',
      },
      company: {
        name: 'บริษัท เทคโซลูชันส์ จำกัด',
        address: '88/8 อาคารสาทรซิตี้ ชั้น 12 ถนนสาทรเหนือ แขวงสีลม เขตบางรัก กรุงเทพฯ 10500',
        taxId: '0105567089234',
        phone: '02-234-5678',
        email: 'info@techsolutions.co.th',
      },
      customer: {
        name: 'บริษัท ไพศาล โลจิสติกส์ จำกัด (มหาชน)',
        address: '200 ถนนนวมินทร์ แขวงนวมินทร์ เขตบึงกุ่ม กรุงเทพฯ 10240',
        taxId: '0107548002156',
        contact: 'คุณสมชาย วงศ์ประเสริฐ',
        phone: '081-234-5678',
      },
      items: [
        {
          no: '1',
          description: 'บริการพัฒนาระบบ ERP Module การเงินและบัญชี',
          unit: 'งาน',
          qty: '1',
          unitPrice: '35,000.00',
          amount: '35,000.00',
        },
        {
          no: '2',
          description: 'ค่าบำรุงรักษาระบบรายปี (Annual Maintenance)',
          unit: 'ปี',
          qty: '1',
          unitPrice: '18,000.00',
          amount: '18,000.00',
        },
        {
          no: '3',
          description: 'ใบอนุญาตซอฟต์แวร์ Enterprise License (50 users)',
          unit: 'ชุด',
          qty: '1',
          unitPrice: '24,500.00',
          amount: '24,500.00',
        },
        {
          no: '4',
          description: 'อบรมการใช้งานระบบ (Training 2 วัน)',
          unit: 'ครั้ง',
          qty: '2',
          unitPrice: '4,000.00',
          amount: '8,000.00',
        },
      ],
      page: {
        current: '1',
        total: '1',
      },
    };
    remountEditor(JSON.stringify(example, null, 2));
    setSampleData(example);
  };

  return (
    <BasePanel>
      <PanelHeader
        actions={
          <div className="flex items-center gap-1.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
            {view === 'editor' && (
              <button
                type="button"
                onClick={handleCopyAll}
                className={clsx(
                  'flex items-center gap-1.5 p-1 font-bold uppercase tracking-wider border px-2 py-0.5 rounded-[4px] transition-all',
                  copiedAll
                    ? 'text-green-500 border-green-500/40 bg-green-500/10'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-white/5'
                )}
              >
                <Icon
                  icon={copiedAll ? 'lucide:check-circle-2' : 'lucide:copy'}
                  className="w-2.5 h-2.5"
                />
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Import JSON File"
              className="text-[9px] p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold uppercase tracking-wider border border-[var(--border-subtle)] px-2 py-0.5 rounded-[4px] hover:bg-white/5 transition-colors"
            >
              <Icon icon="lucide:upload" className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              onClick={loadExample}
              title="Load Example"
              className="text-[9px] p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold uppercase tracking-wider border border-[var(--border-subtle)] px-2 py-0.5 rounded-[4px] hover:bg-white/5 transition-colors"
            >
              <Icon icon="catppuccin:folder-examples" className="w-2.5 h-2.5" />
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
            <Icon icon="lucide:database" className="w-3.5 h-3.5" />
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
            <Icon icon="lucide:braces" className="w-3.5 h-3.5" />
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
              key={editorKey}
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
                placeholder: 'วาง JSON data ที่นี่…',
                formatOnPaste: true,
                formatOnType: true,
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                folding: true,
                wordWrap: 'on',
              }}
            />
            {/* Error Indicator */}
            <div className="absolute bottom-3 right-3 z-10">
              {error ? (
                <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-red-500 text-white rounded text-[9px] font-bold uppercase tracking-wider">
                  <Icon icon="lucide:alert-circle" className="w-3 h-3" />
                  Invalid JSON
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-green-500 text-white rounded text-[9px] font-bold uppercase tracking-wider">
                  <Icon icon="lucide:check-circle-2" className="w-3 h-3" />
                  Valid
                </div>
              )}
            </div>
          </div>
          {error && (
            <div className="p-2 bg-red-600 text-white text-[9px] whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
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
                placeholder="Search data..."
                value={searchQuery}
                onChange={(v: string) => setSearchQuery(v)}
                className="pr-8"
              />
              <Icon
                icon="lucide:search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] group-focus-within:text-[var(--text-secondary)] transition-colors"
              />
            </div>
          </div>
          <hr className="border-white/5" />
          <div ref={parentRef} className="flex-1 overflow-y-auto scrollbar-hide py-1">
            {filteredPaths.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] p-8 text-center gap-3">
                <Icon icon="lucide:database" className="w-8 h-8 opacity-20" />
                <p className="text-[10px]">No data</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-white/5 text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-white/10 transition-colors flex items-center gap-1.5"
                  >
                    <Icon icon="lucide:upload" className="w-3 h-3" />
                    Select JSON File
                  </button>
                </div>
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
                      }}
                    >
                      {item.type === 'header' ? (
                        <ExplorerHeader
                          label={item.label}
                          count={item.count}
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
  count,
  isCollapsed,
  onToggle,
}: {
  label: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const iconName =
    label === 'Strings'
      ? 'lucide:type'
      : label === 'Numbers'
        ? 'lucide:hash'
        : label === 'Objects'
          ? 'lucide:braces'
          : label === 'Arrays'
            ? 'lucide:list'
            : 'lucide:database';

  return (
    <button
      type="button"
      className={clsx(
        'w-full h-full flex items-center gap-2 px-3 cursor-pointer text-left transition-all group/header border-y border-transparent',
        'bg-white/[0.018] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.035]'
      )}
      onClick={onToggle}
    >
      <div className="h-5 w-5 flex items-center justify-center text-[var(--text-muted)] group-hover/header:text-[var(--text-primary)] transition-all shrink-0">
        <Icon
          icon="lucide:chevron-right"
          className={clsx('w-3 h-3 transition-transform duration-200', !isCollapsed && 'rotate-90')}
        />
      </div>
      <div className="w-5 flex items-center justify-center shrink-0">
        <Icon
          icon={iconName}
          className="w-4 h-4 text-[var(--text-muted)] group-hover/header:text-[var(--accent)] transition-colors"
        />
      </div>
      <span className="text-[12px] font-semibold flex-1 truncate opacity-90 group-hover/header:opacity-100 transition-opacity">
        {label}
      </span>
      <div className="h-px w-8 bg-[var(--border-default)] opacity-70" />
      <span className="flex items-center justify-center min-w-[18px] h-[18px] text-[9px] bg-black/5 text-[var(--text-muted)] px-1 rounded-full font-bold">
        {count}
      </span>
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
  const [copied, setCopied] = useState(false);

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

  const iconName =
    type === 'string'
      ? 'lucide:type'
      : type === 'number'
        ? 'lucide:hash'
        : type === 'object'
          ? 'lucide:braces'
          : type === 'array'
            ? 'lucide:list'
            : 'lucide:database';

  const handleCopy = () => {
    navigator.clipboard.writeText(formatBinding(path));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      ref={ref}
      className={clsx(
        'group flex items-center gap-2.5 h-full pr-3 transition-all border border-transparent cursor-grab active:cursor-grabbing hover:bg-white/[0.035] w-full text-left outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]',
        isDragging && 'opacity-40 grayscale'
      )}
      style={{ paddingLeft: '34px' }}
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
      <div className="w-3 shrink-0" />
      <div className="w-5 flex items-center justify-center shrink-0">
        <Icon
          icon={iconName}
          className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[var(--text-muted)] truncate leading-tight transition-colors group-hover:text-[var(--accent)]">
          {path}
        </p>
        <div className="px-1 py-0.5 rounded-sm bg-[var(--bg-widget)] w-fit">
          <p className="text-[9px] text-[var(--text-muted)] truncate uppercase tracking-[0.08em] leading-tight opacity-70">
            {type}
          </p>
        </div>
      </div>

      <button
        type="button"
        className={clsx(
          'p-1 rounded-md transition-all shrink-0',
          copied
            ? 'opacity-100 text-green-500 bg-green-500/10'
            : 'opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent)]'
        )}
        onClick={(e) => {
          e.stopPropagation();
          handleCopy();
        }}
      >
        <Icon icon={copied ? 'lucide:check-circle-2' : 'lucide:copy'} className="w-4 h-4" />
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
            <code className="block text-[10px] text-[var(--text-primary)]  px-2 py-1 rounded border border-[var(--border-subtle)] break-all">
              {`{{${path}}}`}
            </code>
          </div>

          {/* Current value */}
          <div>
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Value
            </p>
            <div className="text-[10px]  px-2 py-1.5 rounded border border-[var(--border-subtle)] max-h-28 overflow-y-auto whitespace-pre-wrap break-all">
              {displayValue}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
