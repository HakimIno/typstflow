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
import { DesignerInput } from '../shared/DesignerInput';

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
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-1',
          'text-[10px] font-medium text-[var(--text-secondary)]',
          'bg-[var(--bg-widget)] border border-[var(--border-default)] rounded-sm',
          'hover:bg-[var(--bg-hover)] hover:border-[var(--border-subtle)]',
          'focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]',
          'transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        disabled={isEmpty}
        title={
          isEmpty ? 'No sample data available. Add data in the Data panel first.' : placeholder
        }
      >
        <Braces className="w-3 h-3" />
        <span className="hidden sm:inline">Variables</span>
        <ChevronDown className={clsx('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent w-full h-full border-none p-0"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
            aria-label="Close variable picker"
          />

          {/* Popover */}
          <div className="absolute z-50 right-0 mt-1 w-80 bg-[var(--bg-surface)] rounded-md shadow-2xl border border-[var(--border-default)] max-h-[450px] flex flex-col animate-in fade-in zoom-in-95 duration-100">
            {/* Tabs */}
            {showAggregates && (
              <div className="flex p-1 gap-1 border-b border-[var(--border-default)] bg-[var(--bg-widget)]/50">
                <button
                  type="button"
                  onClick={() => setActiveTab('fields')}
                  className={clsx(
                    'flex-1 py-1 text-[9px] font-bold uppercase tracking-wider rounded-sm transition-colors',
                    activeTab === 'fields'
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                  )}
                >
                  Fields
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('aggregates')}
                  className={clsx(
                    'flex-1 py-1 text-[9px] font-bold uppercase tracking-wider rounded-sm transition-colors',
                    activeTab === 'aggregates'
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                  )}
                >
                  Aggregates
                </button>
              </div>
            )}

            {/* Header */}
            <div className="p-2 border-b border-[var(--border-default)]">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <DesignerInput
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(v) => setSearchQuery(v)}
                  placeholder={activeTab === 'fields' ? 'Search fields...' : 'Search numeric fields...'}
                  className="w-full pl-7 pr-7 py-1.5"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
              {isEmpty ? (
                <div className="text-center py-8 text-slate-400 text-[10px]">
                  <Braces className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No sample data available</p>
                  <p className="mt-1">Add data in the Data panel first</p>
                </div>
              ) : groupedPaths.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-[10px]">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No fields found</p>
                  <p className="mt-1">Try a different search term</p>
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
                <div className="space-y-1">
                  {allPaths
                    .filter(p => getValueType(sampleData, p) === 'number' || p.includes('[*]'))
                    .map(path => (
                      <AggregateItem
                        key={path}
                        path={path}
                        onSelect={(f) => handleSelect(path, f)}
                      />
                    ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {allPaths.length > 0 && (
              <div className="p-2 border-t border-[var(--border-default)] bg-[var(--bg-widget)]">
                <p className="text-[9px] text-slate-500">
                  {activeTab === 'fields' 
                    ? `${allPaths.length} field${allPaths.length !== 1 ? 's' : ''} available`
                    : 'Select a field to create an aggregate function'}
                </p>
              </div>
            )}
          </div>
        </>
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
        <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] truncate">{path}</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {funcs.map(f => (
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
