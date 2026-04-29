'use client';

import { extractJsonPaths, formatBinding, getValueType, groupPathsByParent, type PathGroup } from '@/lib/utils/json-path';
import { ChevronDown, FileText, Hash, Box, List, Braces, Search, X } from 'lucide-react';
import { useMemo, useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { DesignerInput } from '../shared/DesignerInput';

interface VariablePickerProps {
  sampleData: Record<string, any>;
  onSelect: (path: string, binding: string) => void;
  placeholder?: string;
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

export function VariablePicker({ sampleData, onSelect, placeholder = 'Select variable...' }: VariablePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
  const handleSelect = (path: string) => {
    const binding = formatBinding(path);
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
        title={isEmpty ? 'No sample data available. Add data in the Data panel first.' : placeholder}
      >
        <Braces className="w-3 h-3" />
        <span className="hidden sm:inline">Variables</span>
        <ChevronDown className={clsx('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Popover */}
          <div className="absolute z-50 right-0 mt-1 w-72 bg-[var(--bg-surface)] rounded-md shadow-lg border border-[var(--border-default)] max-h-96 flex flex-col">
            {/* Header */}
            <div className="p-2 border-b border-[var(--border-default)]">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <DesignerInput
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(v) => setSearchQuery(v)}
                  placeholder="Search fields..."
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
            <div className="flex-1 overflow-y-auto p-2">
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
              ) : (
                <div className="space-y-1">
                  {groupedPaths.map((group) => (
                    <PathGroup
                      key={group.name}
                      group={group}
                      sampleData={sampleData}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {allPaths.length > 0 && (
              <div className="p-2 border-t border-[var(--border-default)] bg-[var(--bg-widget)]">
                <p className="text-[9px] text-slate-500">
                  {allPaths.length} field{allPaths.length !== 1 ? 's' : ''} available
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface PathGroupProps {
  group: PathGroup;
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
          <PathItem
            key={path}
            path={path}
            sampleData={sampleData}
            onClick={() => onSelect(path)}
          />
        ))}
      </div>
    );
  }

  // Nested group
  return (
    <div className="border border-[var(--border-default)] rounded-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={clsx(
          'w-full flex items-center gap-1.5 px-2 py-1',
          'text-[10px] font-semibold text-[var(--text-secondary)]',
          'bg-[var(--bg-widget)] hover:bg-[var(--bg-hover)]',
          'transition-colors'
        )}
      >
        <ChevronDown
          className={clsx('w-3 h-3 transition-transform', !isExpanded && '-rotate-90')}
        />
        <TypeIcon type={getValueType(sampleData, group.name)} />
        <span>{group.name}</span>
        <span className="ml-auto text-[9px] text-slate-400">
          {group.paths.length}
        </span>
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
        'w-full flex items-center gap-1.5 px-2 py-1',
        'text-[10px] text-slate-600',
        'hover:bg-blue-50 hover:text-blue-700',
        'transition-colors rounded-sm',
        'text-left'
      )}
    >
      {indent && <div className="w-3" />}
      <TypeIcon type={type} />
      <span className="flex-1 font-mono truncate">{path}</span>
      <span className="text-[9px] text-slate-400 capitalize">{type}</span>
    </button>
  );
}
