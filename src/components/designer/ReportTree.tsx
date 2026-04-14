'use client';

import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { AlertCircle, Braces, CheckCircle2, ChevronDown, Image, Layers, ListTree, Minus, Table, Type, X } from 'lucide-react';
import { memo } from 'react';

export const ReportTree = memo(function ReportTree() {
  const { schema, selectedComponentId, selectComponent, setSidebarOpen } = useDesignerStore();

  const zones: (keyof typeof schema.zones)[] = ['header', 'body', 'footer'];

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden font-sans border-r border-slate-200">
      {/* Utility Header */}
      <div className="px-3 py-2 bg-slate-50 shrink-0 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-1.5 text-slate-600">
          <ListTree className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold uppercase tracking-tight">Report Tree</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(false)}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-400 hover:text-slate-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-1">
        {zones.map((zoneKey) => (
          <div key={zoneKey} className="mb-1">
            <div className="flex items-center gap-1 px-1 py-1 text-slate-600 font-bold text-[10px] uppercase bg-slate-100/50 rounded-sm">
              <ChevronDown className="w-3 h-3" />
              {zoneKey}
            </div>

            <div className="ml-2 mt-1 border-l border-slate-200 pl-1 space-y-0.5">
              {schema.zones[zoneKey].components.length === 0 ? (
                <div className="text-[10px] text-slate-400 italic px-4 py-1">No components</div>
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
        'flex items-center gap-2 px-2 py-1 cursor-pointer transition-colors text-[11px] w-full text-left outline-none focus:bg-slate-100',
        isSelected ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
      )}
    >
      <Icon className={clsx('w-3 h-3', isSelected ? 'text-white' : 'text-slate-400')} />
      <span className="truncate">
        {component.id} ({component.type})
      </span>
    </button>
  );
}
