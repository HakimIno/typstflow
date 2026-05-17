'use client';

import {
  type PathGroup as PathGroupType,
  extractJsonPaths,
  formatBinding,
  getValueType,
  groupPathsByParent,
} from '@/lib/utils/json-path';
import { clsx } from 'clsx';
import { Box, Braces, ChevronDown, FileText, Hash, List, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface VariablePickerProps {
  sampleData: Record<string, any>;
  onSelect: (path: string, binding: string) => void;
  placeholder?: string;
  showAggregates?: boolean;
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
    case 'object':
      return <Braces className={clsx('text-slate-500')} style={{ width: size, height: size }} />;
    default:
      return <FileText className={clsx('text-slate-400')} style={{ width: size, height: size }} />;
  }
};

export function VariablePicker({
  sampleData,
  onSelect,
  placeholder = 'Select variable...',
  showAggregates = true,
}: VariablePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'fields' | 'aggregates'>('fields');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const toggleOpen = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
    setIsOpen(!isOpen);
  };

  // Extract all paths from sample data
  const allPaths = useMemo(() => {
    if (!sampleData || Object.keys(sampleData).length === 0) {
      return [];
    }
    return extractJsonPaths(sampleData);
  }, [sampleData]);

  // Group paths by parent
  const groupedPaths = useMemo(() => {
    const filtered = searchQuery
      ? allPaths.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
      : allPaths;
    return groupPathsByParent(filtered);
  }, [allPaths, searchQuery]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle path selection
  const handleSelect = (path: string, func?: string) => {
    const binding = func ? `{{${func}(${path})}}` : formatBinding(path);
    onSelect(path, binding);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Check if sample data is empty
  const isEmpty = !sampleData || Object.keys(sampleData).length === 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className={clsx(
          'inline-flex items-center gap-1.5 px-2 py-1',
          'text-[9px] font-black uppercase tracking-[0.05em]',
          'bg-[var(--accent-glow)] text-[var(--accent)] border border-[var(--border-accent)] rounded-[2px]',
          'hover:brightness-110 active:scale-[0.97]',
          'focus:outline-none transition-all',
          'disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed'
        )}
        disabled={isEmpty}
      >
        <Braces className="w-3 h-3" />
        <span>Variables</span>
        <ChevronDown
          className={clsx('w-2.5 h-2.5 transition-transform duration-200', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] pointer-events-none">
            {/* Backdrop (Invisible but clickable to close) */}
            <div
              className="absolute inset-0 pointer-events-auto"
              onClick={() => setIsOpen(false)}
            />

            {/* Popover */}
            <div
              style={{
                position: 'absolute',
                top: `${coords.top + 4}px`,
                left: `${coords.left - 240}px`, // Adjust to float left of the button
                width: '320px',
              }}
              className="pointer-events-auto bg-[var(--bg-surface)] rounded-[4px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-[var(--border-default)] max-h-[450px] flex flex-col animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
            >
              {/* Tabs */}
              {showAggregates && (
                <div className="flex p-1 gap-1 border-b border-[var(--border-default)] bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => setActiveTab('fields')}
                    className={clsx(
                      'flex-1 py-1 text-[9px] font-bold uppercase tracking-wider rounded-[2px] transition-all',
                      activeTab === 'fields'
                        ? 'bg-[var(--accent)] text-white shadow-sm'
                        : 'text-[var(--text-muted)] hover:bg-white/5'
                    )}
                  >
                    Fields
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('aggregates')}
                    className={clsx(
                      'flex-1 py-1 text-[9px] font-bold uppercase tracking-wider rounded-[2px] transition-all',
                      activeTab === 'aggregates'
                        ? 'bg-[var(--accent)] text-white shadow-sm'
                        : 'text-[var(--text-muted)] hover:bg-white/5'
                    )}
                  >
                    Aggregates
                  </button>
                </div>
              )}

              {/* Search Header */}
              <div className="p-2 bg-white/[0.01]">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)]" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      activeTab === 'fields' ? 'Search data fields...' : 'Search for functions...'
                    }
                    className="w-full pl-8 pr-8 py-1.5 bg-[var(--bg-widget)] border border-[var(--border-default)] text-[11px] text-[var(--text-primary)] rounded-[4px] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Content List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide min-h-[100px]">
                {isEmpty ? (
                  <div className="text-center py-10 opacity-50">
                    <Braces className="w-8 h-8 mx-auto mb-2 text-[var(--accent)] opacity-20" />
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">
                      No Data Bindings
                    </p>
                  </div>
                ) : groupedPaths.length === 0 ? (
                  <div className="text-center py-10 opacity-50">
                    <Search className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[10px] font-medium">No results found</p>
                  </div>
                ) : activeTab === 'fields' ? (
                  <div className="space-y-1">
                    {groupedPaths.map((group) => (
                      <PathGroup
                        key={group.name}
                        group={group}
                        sampleData={sampleData}
                        onSelect={(p) => handleSelect(p)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 p-1">
                    {allPaths
                      .filter((p) => getValueType(sampleData, p) === 'number' || p.includes('[*]'))
                      .map((path) => (
                        <AggregateItem
                          key={path}
                          path={path}
                          onSelect={(f) => handleSelect(path, f)}
                        />
                      ))}
                  </div>
                )}
              </div>

              {/* Footer Summary */}
              {!isEmpty && (
                <div className="px-3 py-2 border-t border-[var(--border-default)] bg-white/[0.01] flex items-center justify-between">
                  <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">
                    {activeTab === 'fields' ? 'Data Path Explorer' : 'Function Aggregator'}
                  </span>
                  <span className="text-[8px] font-mono text-[var(--accent)] font-bold">
                    {allPaths.length} AVAILABLE
                  </span>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

interface AggregateItemProps {
  path: string;
  onSelect: (func: string) => void;
}

function AggregateItem({ path, onSelect }: AggregateItemProps) {
  const funcs = ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX'];
  return (
    <div className="p-2 border border-[var(--border-default)] rounded-md bg-[var(--bg-widget)]/30 hover:border-[var(--accent)] transition-colors group">
      <div className="flex items-center gap-2 mb-2">
        <Hash className="w-3 h-3 text-green-500" />
        <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] truncate">
          {path}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {funcs.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onSelect(f)}
            className="py-1 px-1.5 text-[8px] font-black bg-[var(--bg-surface)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border-default)] rounded-sm transition-all"
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

interface PathGroupProps {
  group: PathGroupType;
  sampleData: Record<string, any>;
  onSelect: (path: string) => void;
}

function PathGroup({ group, sampleData, onSelect }: PathGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (group.name === 'root') {
    // Root level items - display directly
    return (
      <div className="space-y-0.5">
        {group.paths.map((path) => (
          <PathItem key={path} path={path} sampleData={sampleData} onClick={() => onSelect(path)} />
        ))}
      </div>
    );
  }

  // Nested group
  return (
    <div className="border border-[var(--border-default)] rounded-sm overflow-hidden mb-1 shadow-sm">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={clsx(
          'w-full flex items-center gap-1.5 px-2 py-1.5',
          'text-[10px] font-bold text-[var(--text-secondary)]',
          'bg-[var(--bg-widget)] hover:bg-[var(--bg-hover)]',
          'transition-colors'
        )}
      >
        <ChevronDown
          className={clsx('w-3 h-3 transition-transform', !isExpanded && '-rotate-90')}
        />
        <TypeIcon type={getValueType(sampleData, group.name)} />
        <span className="truncate">{group.name}</span>
        <span className="ml-auto text-[9px] text-slate-400 font-mono">[{group.paths.length}]</span>
      </button>
      {isExpanded && (
        <div className="p-1 space-y-0.5 bg-[var(--bg-surface)]">
          {group.paths.map((path) => (
            <PathItem
              key={path}
              path={path}
              sampleData={sampleData}
              onClick={() => onSelect(path)}
              indent
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PathItemProps {
  path: string;
  sampleData: Record<string, any>;
  onClick: () => void;
  indent?: boolean;
}

function PathItem({ path, sampleData, onClick, indent }: PathItemProps) {
  const type = getValueType(sampleData, path);

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-1.5 px-2 py-1.5',
        'text-[10px] text-[var(--text-secondary)]',
        'hover:bg-[var(--accent-glow)] hover:text-[var(--accent)]',
        'transition-colors rounded-sm',
        'text-left border border-transparent hover:border-[var(--accent)]/20'
      )}
    >
      {indent && <div className="w-3 shrink-0 border-l border-slate-200 h-3 ml-1" />}
      <TypeIcon type={type} />
      <span className="flex-1 font-mono truncate">{path}</span>
      <span className="text-[8px] text-slate-400 uppercase font-bold shrink-0">{type}</span>
    </button>
  );
}
