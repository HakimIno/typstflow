'use client';

import React, { useEffect, useRef } from 'react';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Type, Table, Image, Minus, Space, Columns, Layout, Cpu, ScanLine, QrCode } from 'lucide-react';
import { clsx } from 'clsx';

const componentTypes = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'table', label: 'Table', icon: Table },
  { type: 'image', label: 'Image', icon: Image },
  { type: 'line', label: 'Line', icon: Minus },
  { type: 'barcode', label: 'Barcode', icon: ScanLine },
  { type: 'qr', label: 'QR Code', icon: QrCode },
  { type: 'spacer', label: 'Spacer', icon: Space },
  { type: 'columns', label: 'Columns', icon: Columns },
];

export function Palette() {
  return (
    <div className="h-[300px] flex flex-col bg-white border-b border-slate-200">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layout className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">Main Palette</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-2">
        <div className="grid grid-cols-2 gap-1 px-1 py-1">
          {componentTypes.map((item) => (
            <PaletteItem key={item.type} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PaletteItem({ type, label, icon: Icon }: any) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return draggable({
      element: el,
      getInitialData: () => ({ type: 'palette-item', componentType: type }),
    });
  }, [type]);

  return (
    <div
      ref={ref}
      className={clsx(
        "flex flex-col items-center justify-center p-2 border border-slate-100 bg-white transition-colors cursor-grab active:cursor-grabbing",
        "hover:border-blue-400 hover:bg-blue-50/50"
      )}
    >
      <Icon className="w-4 h-4 text-slate-500" />
      <span className="text-[10px] text-slate-600 font-medium mt-1 truncate w-full text-center">{label}</span>
    </div>
  );
}
