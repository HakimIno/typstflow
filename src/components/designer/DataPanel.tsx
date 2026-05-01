import { useDesignerStore } from '@/store/designer-store';
import { Editor } from '@monaco-editor/react';
import { AlertCircle, Braces, CheckCircle2, ChevronRight, Copy, Database, Search, X } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { extractJsonPaths, getValueType, formatBinding } from '@/lib/utils/json-path';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { clsx } from 'clsx';
import { DesignerInput } from '../shared/DesignerInput';

export const DataPanel = memo(function DataPanel() {
  const { sampleData, setSampleData, theme } = useDesignerStore(
    useShallow((state) => ({
      sampleData: state.sampleData,
      setSampleData: state.setSampleData,
      theme: state.theme,
    }))
  );
  const [view, setView] = useState<'explorer' | 'editor'>('explorer');
  const [jsonString, setJsonString] = useState(JSON.stringify(sampleData, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setJsonString(JSON.stringify(sampleData, null, 2));
  }, [sampleData]);

  const allPaths = useMemo(() => {
    return extractJsonPaths(sampleData);
  }, [sampleData]);

  const filteredPaths = useMemo(() => {
    if (!searchQuery) return allPaths;
    return allPaths.filter(p => p.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allPaths, searchQuery]);

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
    <div className="flex flex-col h-full bg-[var(--bg-surface)] overflow-hidden font-sans border-r border-[var(--border-default)]">
      {/* Utility Header */}
      <div className="px-3 py-2 bg-white/5 flex items-center justify-between border-b border-[var(--border-default)] shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setView('explorer')}
            className={clsx(
              'flex items-center gap-1.5 py-1 transition-colors relative',
              view === 'explorer' ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            <Database className="w-3.5 h-3.5" />
            <span className="text-[9px] uppercase tracking-widest">Explorer</span>
            {view === 'explorer' && <div className="absolute -bottom-[9px] left-0 right-0 h-0.5 bg-[var(--accent)]" />}
          </button>
          <button
            type="button"
            onClick={() => setView('editor')}
            className={clsx(
              'flex items-center gap-1.5 py-1 transition-colors relative',
              view === 'editor' ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            <Braces className="w-3.5 h-3.5" />
            <span className="text-[9px] uppercase tracking-widest">JSON</span>
            {view === 'editor' && <div className="absolute -bottom-[9px] left-0 right-0 h-0.5 bg-[var(--accent)]" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadExample}
            className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold uppercase tracking-wider border border-[var(--border-subtle)] px-2 py-0.5 rounded-[4px] hover:bg-white/5 transition-colors"
          >
            Example
          </button>
          <button
            type="button"
            onClick={() => useDesignerStore.getState().setSidebarOpen(false)}
            className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

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
                onChange={(v) => setSearchQuery(v)}
                className="pr-8"
              />
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] group-focus-within:text-[var(--text-secondary)] transition-colors" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
            {filteredPaths.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] p-8 text-center">
                <Database className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-[10px]">No data fields found.</p>
              </div>
            ) : (
              filteredPaths.map((path) => (
                <ExplorerItem
                  key={path}
                  path={path}
                  type={getValueType(sampleData, path)}
                />
              ))
            )}
          </div>

        </div>
      )}
    </div>
  );
});

function ExplorerItem({ path, type }: { path: string; type: string }) {
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
          style: { fontSize: 10 }
        },
        dragOffsetX: 20,
        dragOffsetY: 4,
      }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [path]);

  return (
    <div
      ref={ref}
      className={clsx(
        "group flex items-center gap-2 p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors cursor-pointer border border-transparent hover:border-[var(--border-default)]",
        isDragging && "opacity-40 grayscale"
      )}
      onClick={() => {
        navigator.clipboard.writeText(formatBinding(path));
      }}
    >
      <div className={clsx(
        "w-4 h-4 rounded border border-[var(--border-default)] flex items-center justify-center text-[8px] font-bold uppercase shrink-0 shadow-sm",
      )}>
        {type.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-mono text-[var(--text-primary)] truncate font-bold">{path}</p>
        <p className="text-[8px] text-[var(--text-muted)] truncate font-medium">
          {type}
        </p>
      </div>
      <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--bg-surface)] rounded text-[var(--text-muted)] transition-all">
        <Copy className="w-3 h-3" />
      </button>
    </div>
  );
}
