'use client';

import React from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { Layers, Type, Table, Image, Minus, ChevronRight, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

export function ReportTree() {
  const schema = useDesignerStore(state => state.schema);
  const selectedComponentId = useDesignerStore(state => state.selectedComponentId);
  const selectComponent = useDesignerStore(state => state.selectComponent);

  const zones: (keyof typeof schema.zones)[] = ['header', 'body', 'footer'];

  return (
    <div className="flex flex-col h-full bg-white border-t border-slate-200">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">Report Outline</span>
        </div>
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
}

function TreeItem({ component, isSelected, onClick }: any) {
  const icons: any = {
    text: Type,
    table: Table,
    image: Image,
    line: Minus,
  };
  const Icon = icons[component.type] || Layers;

  return (
    <div
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 px-2 py-1 cursor-pointer transition-colors text-[11px]",
        isSelected 
          ? "bg-blue-600 text-white" 
          : "text-slate-600 hover:bg-slate-100"
      )}
    >
      <Icon className={clsx("w-3 h-3", isSelected ? "text-white" : "text-slate-400")} />
      <span className="truncate">{component.id} ({component.type})</span>
    </div>
  );
}
