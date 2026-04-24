'use client';

import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { AlertCircle, Braces, CheckCircle2, ChevronDown, Image, Layers, ListTree, Minus, Table, Type, X } from 'lucide-react';
import { memo } from 'react';

export const ReportTree = memo(function ReportTree() {
  const { schema, selectedComponentId, selectComponent, setSidebarOpen } = useDesignerStore();

  const zones: (keyof typeof schema.zones)[] = ['header', 'body', 'footer'];

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)] overflow-hidden font-sans border-r border-[var(--border-default)]">
      {/* Utility Header */}
      <div className="px-3 py-2.5 bg-[var(--bg-widget)] shrink-0 flex items-center justify-between border-b border-[var(--border-default)]">
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          <ListTree className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="text-[9px] font-bold uppercase tracking-[0.1em]">Report Tree</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(false)}
          className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-1">
        {zones.map((zoneKey) => (
          <div key={zoneKey} className="mb-1">
            <div className="flex items-center gap-1 px-1 py-1 text-[var(--text-secondary)] font-bold text-[10px] uppercase bg-[var(--bg-widget)] rounded-sm">
              <ChevronDown className="w-3 h-3" />
              {zoneKey}
            </div>

            <div className="ml-2 mt-1 border-l border-[var(--border-default)] pl-1 space-y-0.5">
              {schema.zones[zoneKey].components.length === 0 ? (
                <div className="text-[10px] text-[var(--text-muted)] italic px-4 py-1">No components</div>
              ) : (
                schema.zones[zoneKey].components.map((comp) => (
                  <TreeItem
                    key={comp.id}
                    component={comp}
                    isSelected={selectedComponentId === comp.id}
                    onClick={() => selectComponent(comp.id)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

function TreeItem({ component, isSelected, onClick }: any) {
  const icons: any = {
    text: Type,
    table: Table,
    image: Image,
    line: Minus,
  };
  const Icon = icons[component.type] || Layers;

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 px-2 py-1 cursor-pointer transition-colors text-[11px] w-full text-left outline-none rounded-[4px]',
        isSelected 
          ? 'bg-[var(--accent-glow)] text-[var(--accent)] border border-[var(--border-accent)]' 
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
      )}
    >
      <Icon className={clsx('w-3 h-3', isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]')} />
      <span className="truncate">
        {component.id} ({component.type})
      </span>
    </button>
  );
}
