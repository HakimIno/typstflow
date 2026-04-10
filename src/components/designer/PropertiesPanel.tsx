'use client';

import { useDesignerStore } from '@/store/designer-store';
import type {
  BarcodeComponent,
  ComponentNode,
  ImageComponent,
  QRComponent,
  TableComponent,
  TextComponent,
} from '@/types/schema';
import { clsx } from 'clsx';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Layers,
  Sliders,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';

// Type guards for safe component access
const isText = (c: ComponentNode): c is TextComponent => c.type === 'text';
const isTable = (c: ComponentNode): c is TableComponent => c.type === 'table';
const isImage = (c: ComponentNode): c is ImageComponent => c.type === 'image';
const isBarcode = (c: ComponentNode): c is BarcodeComponent =>
  c.type === 'barcode' || c.type === 'qr';

export function PropertiesPanel() {
  // Select state with proper memoization - avoid selecting entire schema
  const selectedComponentId = useDesignerStore((state) => state.selectedComponentId);
  const zones = useDesignerStore((state) => state.schema.zones);
  const page = useDesignerStore((state) => state.schema.page);

  // Select actions separately (they don't change)
  const updateSchema = useDesignerStore((state) => state.updateSchema);
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const removeComponent = useDesignerStore((state) => state.removeComponent);

  // Find selected component with memoization
  const selectedComponent = useMemo(() => {
    if (!selectedComponentId) return null;
    for (const zone of Object.values(zones)) {
      const found = zone.components.find((c) => c.id === selectedComponentId);
      if (found) return found;
    }
    return null;
  }, [zones, selectedComponentId]);

  // Create schema object for properties that need it
  const schema = useMemo(() => ({ zones, page }), [zones, page]);

  if (!selectedComponent) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="h-8 min-h-[32px] bg-slate-700 text-white flex items-center px-3 gap-2">
          <Layers className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Report Settings</span>
        </div>
        <div className="flex-1 overflow-auto border-l border-slate-200">
          <section>
            <div className="px-3 py-1.5 bg-slate-200 border-b border-slate-300 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
              Page Configuration
            </div>
            <div className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50 group">
              <div className="w-1/3 px-3 py-2 text-[10px] font-bold text-slate-500 bg-slate-50/50 border-r border-slate-100 flex items-center shrink-0">
                Paper Size
              </div>
              <div className="flex-1 px-2 py-1.5 flex items-center overflow-hidden">
                <select
                  value={schema.page.size}
                  onChange={(e) =>
                    updateSchema({ page: { ...schema.page, size: e.target.value as any } })
                  }
                  className="pro-input h-6 px-1 w-full bg-white text-[11px]"
                >
                  <option value="A4">A4</option>
                  <option value="A5">A5</option>
                  <option value="Letter">Letter</option>
                  <option value="Legal">Legal</option>
                </select>
              </div>
            </div>
            <div className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50 group">
              <div className="w-1/3 px-3 py-2 text-[10px] font-bold text-slate-500 bg-slate-50/50 border-r border-slate-100 flex items-center shrink-0">
                Orientation
              </div>
              <div className="flex-1 px-2 py-1.5 flex items-center overflow-hidden">
                <select
                  value={schema.page.orientation}
                  onChange={(e) =>
                    updateSchema({ page: { ...schema.page, orientation: e.target.value as any } })
                  }
                  className="pro-input h-6 px-1 w-full bg-white text-[11px]"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>
          </section>
          <section>
            <div className="px-3 py-1.5 bg-slate-200 border-b border-slate-300 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
              Margins
            </div>
            {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
              <div
                key={side}
                className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50 group"
              >
                <div className="w-1/3 px-3 py-2 text-[10px] font-bold text-slate-500 bg-slate-50/50 border-r border-slate-100 flex items-center shrink-0 capitalize">
                  {side}
                </div>
                <div className="flex-1 px-2 py-1.5 flex items-center overflow-hidden">
                  <input
                    type="text"
                    value={schema.page.margin[side]}
                    onChange={(e) =>
                      updateSchema({
                        page: {
                          ...schema.page,
                          margin: { ...schema.page.margin, [side]: e.target.value },
                        },
                      })
                    }
                    className="pro-input h-6 px-1 w-full bg-white text-[11px] font-mono"
                    placeholder="15mm"
                  />
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    );
  }

  const PropertyRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50 group">
      <div className="w-1/3 px-3 py-2 text-[10px] font-bold text-slate-500 bg-slate-50/50 border-r border-slate-100 flex items-center shrink-0">
        {label}
      </div>
      <div className="flex-1 px-2 py-1.5 flex items-center overflow-hidden">{children}</div>
    </div>
  );

  const SectionHeader = ({ label }: { label: string }) => (
    <div className="px-3 py-1.5 bg-slate-200 border-b border-slate-300 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
      {label}
    </div>
  );

  // Validation helpers
  const handleNumericUpdate = (key: keyof ComponentNode, value: string) => {
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num)) {
      updateComponent(selectedComponent.id, { [key]: num });
    }
  };

  const handleStyleUpdate = (updates: any) => {
    const currentStyle = (selectedComponent as any).style || {};
    updateComponent(selectedComponent.id, {
      style: { ...currentStyle, ...updates },
    } as any);
  };

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
            <span className="text-[11px] font-mono text-slate-400 truncate">
              {selectedComponent.id}
            </span>
          </PropertyRow>
          <PropertyRow label="Type">
            <span className="text-[11px] font-bold text-blue-600 uppercase">
              {selectedComponent.type}
            </span>
          </PropertyRow>
        </section>

        <section>
          <SectionHeader label="Content & Binding" />
          {isText(selectedComponent) && (
            <div className="flex flex-col border-b border-slate-100">
              <div className="px-3 py-1 text-[10px] font-bold text-slate-500 bg-slate-50/50 uppercase tracking-tighter">
                Text Content
              </div>
              <textarea
                value={selectedComponent.content || ''}
                onChange={(e) => updateComponent(selectedComponent.id, { content: e.target.value })}
                className="w-full h-16 px-3 py-2 text-[11px] font-mono border-none focus:ring-0 focus:outline-none resize-none bg-white"
                placeholder="Type static text or {{binding}}..."
              />
            </div>
          )}
          {isTable(selectedComponent) && (
            <div className="space-y-0 text-[10px]">
              <PropertyRow label="Data Source">
                <input
                  type="text"
                  value={selectedComponent.dataSource || ''}
                  onChange={(e) =>
                    updateComponent(selectedComponent.id, { dataSource: e.target.value })
                  }
                  className="pro-input h-6 px-1 font-mono"
                  placeholder="{{path.to.array}}"
                />
              </PropertyRow>
              <PropertyRow label="Header Rows">
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={selectedComponent.style?.headerRows ?? 1}
                  onChange={(e) =>
                    handleStyleUpdate({ headerRows: parseInt(e.target.value) || 0 })
                  }
                  className="pro-input h-6 px-1"
                />
              </PropertyRow>
            </div>
          )}
          {isBarcode(selectedComponent) && (
            <PropertyRow label="Value">
              <input
                type="text"
                value={(selectedComponent as BarcodeComponent | QRComponent).value || ''}
                onChange={(e) => updateComponent(selectedComponent.id, { value: e.target.value })}
                className="pro-input h-6 px-1 font-mono"
                placeholder="{{item.id}}"
              />
            </PropertyRow>
          )}
          {isImage(selectedComponent) && (
            <PropertyRow label="Image URL">
              <input
                type="text"
                value={selectedComponent.src || ''}
                onChange={(e) => updateComponent(selectedComponent.id, { src: e.target.value })}
                className="pro-input h-6 px-1 font-mono"
                placeholder="https://..."
              />
            </PropertyRow>
          )}
        </section>

        {(isText(selectedComponent) || isTable(selectedComponent)) && (
          <section>
            <SectionHeader label="Typography" />
            <PropertyRow label="Font Size (pt)">
              <input
                type="number"
                min="1"
                max="200"
                value={selectedComponent.style?.fontSize || 10}
                onChange={(e) =>
                  handleStyleUpdate({ fontSize: Number.parseInt(e.target.value) || 10 })
                }
                className="pro-input h-6 px-1"
              />
            </PropertyRow>
            <PropertyRow label="Line Height">
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="3"
                value={selectedComponent.style?.lineHeight || 1.2}
                onChange={(e) =>
                  handleStyleUpdate({ lineHeight: Number.parseFloat(e.target.value) || 1.2 })
                }
                className="pro-input h-6 px-1"
              />
            </PropertyRow>
            <PropertyRow label="Spacing (em)">
              <input
                type="text"
                value={selectedComponent.style?.letterSpacing || '0pt'}
                onChange={(e) => handleStyleUpdate({ letterSpacing: e.target.value })}
                className="pro-input h-6 px-1 font-mono"
                placeholder="0.05em"
              />
            </PropertyRow>
            <PropertyRow label="Weight">
              <button
                type="button"
                onClick={() =>
                  handleStyleUpdate({
                    fontWeight: selectedComponent.style?.fontWeight === 'bold' ? 'regular' : 'bold',
                  })
                }
                className={clsx(
                  'px-2 py-0.5 border text-[10px] font-bold transition-all',
                  selectedComponent.style?.fontWeight === 'bold'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                <Bold className="w-3 h-3" />
              </button>
            </PropertyRow>
          </section>
        )}

        {isImage(selectedComponent) && (
          <section>
            <SectionHeader label="Image Settings" />
            <PropertyRow label="Fit Mode">
              <select
                value={selectedComponent.fit || 'contain'}
                onChange={(e) =>
                  updateComponent(selectedComponent.id, { fit: e.target.value as any })
                }
                className="pro-input h-6 px-1 w-full bg-white text-[11px]"
              >
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
                <option value="stretch">Stretch</option>
              </select>
            </PropertyRow>
          </section>
        )}

        {isTable(selectedComponent) && (
          <section>
            <SectionHeader label="Column Management" />
            <div className="p-2 space-y-1 bg-slate-50/50">
              {selectedComponent.columns.map((col, idx) => (
                <div key={col.id} className="flex gap-1 items-center bg-white border border-slate-200 p-1 rounded-sm group/col">
                  <span className="w-4 text-[9px] font-bold text-slate-400">#{idx+1}</span>
                  <input 
                    className="flex-1 text-[10px] bg-transparent border-none focus:ring-0 p-0 font-bold"
                    value={col.header}
                    onChange={(e) => {
                      const newCols = [...selectedComponent.columns];
                      newCols[idx] = { ...col, header: e.target.value };
                      updateComponent(selectedComponent.id, { columns: newCols } as any);
                    }}
                  />
                  <input 
                    className="w-16 text-[9px] bg-slate-50 border border-slate-100 rounded px-1"
                    value={col.width}
                    onChange={(e) => {
                      const newCols = [...selectedComponent.columns];
                      newCols[idx] = { ...col, width: e.target.value };
                      updateComponent(selectedComponent.id, { columns: newCols } as any);
                    }}
                  />
                  <button 
                    className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded opacity-0 group-hover/col:opacity-100 transition-opacity"
                    onClick={() => {
                        const newCols = selectedComponent.columns.filter((_, i) => i !== idx);
                        updateComponent(selectedComponent.id, { columns: newCols } as any);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button 
                className="w-full py-1.5 border border-dashed border-slate-300 text-[9px] font-bold uppercase text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all mt-2"
                onClick={() => {
                    const newCols = [...selectedComponent.columns, { 
                        id: Math.random().toString(36).substring(7),
                        header: 'New Column',
                        field: 'field',
                        width: '40mm'
                    }];
                    updateComponent(selectedComponent.id, { columns: newCols } as any);
                }}
              >
                + Add Column
              </button>
            </div>

            <SectionHeader label="Table Styling" />
            <PropertyRow label="Header BG">
              <input
                type="color"
                value={selectedComponent.style?.headerBackground || '#f1f5f9'}
                onChange={(e) => handleStyleUpdate({ headerBackground: e.target.value })}
                className="w-full h-6 rounded-sm cursor-pointer"
              />
            </PropertyRow>
            <PropertyRow label="Alt Row BG">
              <input
                type="color"
                value={selectedComponent.style?.alternateRowBackground || '#ffffff'}
                onChange={(e) => handleStyleUpdate({ alternateRowBackground: e.target.value })}
                className="w-full h-6 rounded-sm cursor-pointer"
              />
            </PropertyRow>
            <PropertyRow label="Border Color">
              <input
                type="color"
                value={selectedComponent.style?.borderColor || '#cbd5e1'}
                onChange={(e) => handleStyleUpdate({ borderColor: e.target.value })}
                className="w-full h-6 rounded-sm cursor-pointer"
              />
            </PropertyRow>
            <PropertyRow label="Border Width">
              <input
                type="text"
                value={selectedComponent.style?.borderWidth || '0.5pt'}
                onChange={(e) => handleStyleUpdate({ borderWidth: e.target.value })}
                className="pro-input h-6 px-1 font-mono"
                placeholder="0.5pt"
              />
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
                { id: 'right', icon: AlignRight },
                { id: 'justify', icon: AlignJustify },
              ].map((align) => (
                <button
                  key={align.id}
                  type="button"
                  onClick={() => {
                    updateComponent(selectedComponent.id, { align: align.id as any });
                    if (align.id === 'justify' && isText(selectedComponent)) {
                      handleStyleUpdate({ justify: true });
                    } else if (isText(selectedComponent)) {
                      handleStyleUpdate({ justify: false });
                    }
                  }}
                  className={clsx(
                    'flex-1 py-1 flex items-center justify-center transition-all',
                    selectedComponent.align === align.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-400 hover:text-slate-600'
                  )}
                >
                  <align.icon className="w-3 h-3" />
                </button>
              ))}
            </div>
          </PropertyRow>
        </section>

        <section>
          <SectionHeader label="Geometry (mm)" />
          <div className="grid grid-cols-2">
            <PropertyRow label="X Pos">
              <input
                type="number"
                step="1"
                value={selectedComponent.x || 0}
                onChange={(e) => handleNumericUpdate('x', e.target.value)}
                className="pro-input h-6 px-1 w-full"
              />
            </PropertyRow>
            <PropertyRow label="Y Pos">
              <input
                type="number"
                step="1"
                value={selectedComponent.y || 0}
                onChange={(e) => handleNumericUpdate('y', e.target.value)}
                className="pro-input h-6 px-1 w-full"
              />
            </PropertyRow>
            <PropertyRow label="Width">
              <input
                type="number"
                step="1"
                min="1"
                value={selectedComponent.width || 0}
                onChange={(e) => handleNumericUpdate('width', e.target.value)}
                className="pro-input h-6 px-1 w-full"
              />
            </PropertyRow>
            <PropertyRow label="Height">
              <input
                type="number"
                step="1"
                min="1"
                value={selectedComponent.height || 0}
                onChange={(e) => handleNumericUpdate('height', e.target.value)}
                className="pro-input h-6 px-1 w-full"
              />
            </PropertyRow>
          </div>
        </section>
      </div>

      <div className="p-2 border-t border-slate-300 bg-slate-100">
        <button
          type="button"
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
