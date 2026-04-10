'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { clsx } from 'clsx';
import { Columns, Image, Layout, Minus, QrCode, ScanLine, Space, Table, Type } from 'lucide-react';
import { useEffect, useRef } from 'react';

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
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">
            Main Palette
          </span>
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

    const getTemplate = () => {
      const base = { id: '', x: 0, y: 0 };
      switch (type) {
        case 'text':
          return {
            ...base,
            type: 'text',
            content: 'Double click to edit text',
            style: { fontSize: 10 },
            width: 100,
            height: 10,
          };
        case 'table':
          return {
            ...base,
            type: 'table',
            dataSource: '{{items}}',
            columns: [],
            style: {},
            showHeader: true,
            width: 180,
            height: 40,
          };
        case 'image':
          return { ...base, type: 'image', src: '/logo.png', width: 40, height: 40 };
        case 'line':
          return { ...base, type: 'line', thickness: '1pt', color: 'black', width: 180, height: 2 };
        case 'barcode':
          return {
            ...base,
            type: 'barcode',
            value: '{{code}}',
            format: 'code128',
            width: 40,
            height: 15,
          };
        case 'qr':
          return { ...base, type: 'qr', value: '{{url}}', format: 'qr', width: 25, height: 25 };
        case 'spacer':
          return { ...base, type: 'spacer', height: 10, width: 180 };
        default:
          return { ...base, type, width: 50, height: 20 };
      }
    };

    return draggable({
      element: el,
      getInitialData: ({ input }) => {
        const rect = el.getBoundingClientRect();
        const comp = getTemplate();

        // Calculate where the user clicked relative to the icon (0 to 1)
        const percentX = (input.clientX - rect.left) / rect.width;
        const percentY = (input.clientY - rect.top) / rect.height;

        // Apply that same percentage to the final component size
        // This makes it feel like you "grabbed" the exact spot
        return {
          type: 'new-component',
          component: comp,
          dragOffsetX: LayoutEngine.mmToPx(comp.width || 100) * percentX,
          dragOffsetY: LayoutEngine.mmToPx(comp.height || 20) * percentY,
        };
      },
      onGenerateDragPreview: ({ nativeSetDragImage, source }) => {
        const comp = getTemplate();
        const data = source.data as any;
        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: () => ({ x: data.dragOffsetX, y: data.dragOffsetY }),
          render: ({ container }) => {
            const preview = document.createElement('div');
            preview.className = 'natural-preview';
            preview.style.width = `${LayoutEngine.mmToPx(comp.width || 100)}px`;
            preview.style.height = `${LayoutEngine.mmToPx(comp.height || 20)}px`;
            preview.style.display = 'flex';
            preview.style.alignItems = 'center';
            preview.style.justifyContent = 'center';
            preview.style.fontSize = '8px';
            preview.style.color = '#94a3b8';
            preview.innerHTML = `NEW ${label.toUpperCase()}`;
            container.appendChild(preview);
          },
        });
      },
    });
  }, [type, label]);

  return (
    <div
      ref={ref}
      className={clsx(
        'flex flex-col items-center justify-center p-2 border border-slate-100 bg-white transition-colors cursor-grab active:cursor-grabbing',
        'hover:border-blue-400 hover:bg-blue-50/50'
      )}
    >
      <Icon className="w-4 h-4 text-slate-500" />
      <span className="text-[10px] text-slate-600 font-medium mt-1 truncate w-full text-center">
        {label}
      </span>
    </div>
  );
}
