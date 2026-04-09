'use client';

import React from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { AlignLeft, AlignCenter, AlignRight, Bold, Trash2, Sliders, Layers } from 'lucide-react';
import { clsx } from 'clsx';

export function PropertiesPanel() {
  const { schema, selectedComponentId, updateComponent, removeComponent } = useDesignerStore();

  const selectedComponent = selectedComponentId
    ? Object.values(schema.zones)
        .flatMap((z) => z.components)
        .find((c) => c.id === selectedComponentId)
    : null;

  if (!selectedComponent) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center bg-slate-50">
        <Layers className="w-6 h-6 text-slate-300 mb-2" />
        <p className="text-[11px] text-slate-400 font-bold uppercase">No Selection</p>
      </div>
    );
  }

  const PropertyRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50 group">
      <div className="w-1/3 px-3 py-2 text-[10px] font-bold text-slate-500 bg-slate-50/50 border-r border-slate-100 flex items-center shrink-0">
        {label}
      </div>
      <div className="flex-1 px-2 py-1.5 flex items-center overflow-hidden">
        {children}
      </div>
    </div>
  );

  const SectionHeader = ({ label }: { label: string }) => (
    <div className="px-3 py-1.5 bg-slate-200 border-b border-slate-300 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
      {label}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="h-8 min-h-[32px] bg-slate-700 text-white flex items-center px-3 gap-2">
        <Sliders className="w-3 h-3 text-slate-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Properties Inspector</span>
      </div>

      <div className="flex-1 overflow-auto border-l border-slate-200">
        <section>
          <SectionHeader label="Identification" />
          <PropertyRow label="Object ID">
            <span className="text-[11px] font-mono text-slate-400 truncate">{selectedComponent.id}</span>
          </PropertyRow>
          <PropertyRow label="Type">
            <span className="text-[11px] font-bold text-blue-600 uppercase">{selectedComponent.type}</span>
          </PropertyRow>
        </section>

        <section>
          <SectionHeader label="Content & Binding" />
          {(selectedComponent.type === 'text') && (
            <div className="flex flex-col border-b border-slate-100">
               <div className="px-3 py-1 text-[10px] font-bold text-slate-500 bg-slate-50/50 uppercase tracking-tighter">Text Content</div>
               <textarea
                  value={(selectedComponent as any).content || ''}
                  onChange={(e) => updateComponent(selectedComponent.id, { content: e.target.value } as any)}
                  className="w-full h-16 px-3 py-2 text-[11px] font-mono border-none focus:ring-0 focus:outline-none resize-none bg-white"
                  placeholder="Type static text or {{binding}}..."
                />
            </div>
          )}
          {(selectedComponent.type === 'table') && (
            <PropertyRow label="Data Source">
               <input
                type="text"
                value={(selectedComponent as any).dataSource || ''}
                onChange={(e) => updateComponent(selectedComponent.id, { dataSource: e.target.value } as any)}
                className="pro-input h-6 px-1 font-mono"
                placeholder="{{path.to.array}}"
              />
            </PropertyRow>
          )}
          {(selectedComponent.type === 'barcode' || selectedComponent.type === 'qr') && (
            <PropertyRow label="Value">
               <input
                type="text"
                value={(selectedComponent as any).value || ''}
                onChange={(e) => updateComponent(selectedComponent.id, { value: e.target.value } as any)}
                className="pro-input h-6 px-1 font-mono"
                placeholder="{{item.id}}"
              />
            </PropertyRow>
          )}
        </section>

        {(selectedComponent.type === 'text' || selectedComponent.type === 'table') && (
          <section>
            <SectionHeader label="Typography" />
            <PropertyRow label="Font Size (pt)">
              <input
                type="number"
                value={(selectedComponent as any).style?.fontSize || 10}
                onChange={(e) => updateComponent(selectedComponent.id, { 
                  style: { ...(selectedComponent as any).style, fontSize: parseInt(e.target.value) } 
                } as any)}
                className="pro-input h-6 px-1"
              />
            </PropertyRow>
            <PropertyRow label="Weight">
              <button
                onClick={() => updateComponent(selectedComponent.id, {
                  style: { 
                    ...(selectedComponent as any).style, 
                    fontWeight: (selectedComponent as any).style?.fontWeight === 'bold' ? 'regular' : 'bold' 
                  }
                } as any)}
                className={clsx(
                  "px-2 py-0.5 border text-[10px] font-bold transition-all",
                  (selectedComponent as any).style?.fontWeight === 'bold' 
                    ? "bg-slate-800 text-white border-slate-800" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                <Bold className="w-3 h-3" />
              </button>
            </PropertyRow>
          </section>
        )}

        <section>
          <SectionHeader label="Alignment" />
          <PropertyRow label="Horizontal">
            <div className="flex border border-slate-200 rounded-sm overflow-hidden w-full">
              {[
                { id: 'left', icon: AlignLeft },
                { id: 'center', icon: AlignCenter },
                { id: 'right', icon: AlignRight }
              ].map((align) => (
                <button
                  key={align.id}
                  onClick={() => updateComponent(selectedComponent.id, { align: align.id } as any)}
                  className={clsx(
                    "flex-1 py-1 flex items-center justify-center transition-all",
                    (selectedComponent as any).align === align.id 
                      ? "bg-blue-600 text-white" 
                      : "bg-white text-slate-400 hover:text-slate-600"
                  )}
                >
                  <align.icon className="w-3 h-3" />
                </button>
              ))}
            </div>
          </PropertyRow>
        </section>

        {selectedComponent.type === 'spacer' && (
           <section>
              <SectionHeader label="Geometry" />
              <PropertyRow label="Height">
                <input
                  type="text"
                  value={(selectedComponent as any).height || '1cm'}
                  onChange={(e) => updateComponent(selectedComponent.id, { height: e.target.value } as any)}
                  className="pro-input h-6 px-1"
                />
              </PropertyRow>
           </section>
        )}
      </div>

      <div className="p-2 border-t border-slate-300 bg-slate-100">
        <button
          onClick={() => removeComponent(selectedComponent.id)}
          className="w-full flex items-center justify-center gap-2 p-1.5 bg-red-600 text-white font-bold text-[10px] uppercase hover:bg-red-700 active:bg-red-800 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Delete Object
        </button>
      </div>
    </div>
  );
}
