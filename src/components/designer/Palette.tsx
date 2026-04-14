'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { clsx } from 'clsx';
import {
  Columns,
  Image,
  Minus,
  QrCode,
  ScanLine,
  Space,
  Table,
  Type,
  Search,
  X,
  LayoutDashboard,
  Box,
  ListTree
} from 'lucide-react';
import { useEffect, useRef, useState, memo } from 'react';

const CATEGORIES = [
  {
    id: 'widgets',
    label: 'Standard Widgets',
    items: [
      { type: 'table', label: 'Data Table', icon: Table },
      { type: 'summary-box', label: 'Summary Box', icon: LayoutDashboard },
    ]
  },
  {
    id: 'basics',
    label: 'Common',
    items: [
      { type: 'text', label: 'Text Field', icon: Type },
      { type: 'image', label: 'Picture', icon: Image },
      { type: 'line', label: 'Line Divider', icon: Minus },
    ]
  },
  {
    id: 'advanced',
    label: 'Data Rendering',
    items: [
      { type: 'barcode', label: 'Barcode', icon: ScanLine },
      { type: 'qr', label: 'QR Code', icon: QrCode },
    ]
  },
  {
    id: 'layout',
    label: 'Layout',
    items: [
      { type: 'columns', label: 'Columns', icon: Columns },
      { type: 'spacer', label: 'Space', icon: Space },
      { type: 'repeater', label: 'Repeater', icon: ListTree },
    ]
  }
];

export const Palette = memo(function Palette() {
  const { setSidebarOpen } = useDesignerStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = CATEGORIES.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.type.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.items.length > 0);

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden font-sans border-r border-slate-200">
      {/* Utility Header */}
      <div className="px-3 py-2 bg-slate-50 flex items-center justify-between border-b border-slate-200 shrink-0">
        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">Element Library</span>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-400 hover:text-slate-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Bar - Compact */}
      <div className="p-2 border-b border-slate-100 shrink-0">
        <div className="relative group">
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-sm py-1.5 px-3 pr-8 text-[12px] focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-all outline-none text-slate-700 placeholder:text-slate-400"
          />
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-slate-500 transition-colors" />
        </div>
      </div>

      {/* Categories Content - Dense Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-4">
        {filteredCategories.map((cat) => (
          <div key={cat.id} className="space-y-1.5">
            <div className="px-1 py-0.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {cat.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {cat.items.map((item) => (
                <PaletteItem key={item.type} {...item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

const PaletteItem = memo(function PaletteItem({ type, label, icon: Icon }: any) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const getTemplate = () => {
      const base = { id: '', x: 0, y: 0 };
      switch (type) {
        case 'text':
          return { ...base, type: 'text', content: 'Double click to edit', style: { fontSize: 10 }, width: 100, height: 10 };
        case 'table':
          return { ...base, type: 'table', dataSource: '{{items}}', columns: [{ id: '1', header: 'Header', field: 'field', width: '1fr' }], width: 180, height: 40 };
        case 'image':
          return { ...base, type: 'image', src: '/logo.png', width: 40, height: 40 };
        case 'line':
          return { ...base, type: 'line', thickness: '1pt', color: 'black', width: 180, height: 2 };
        default:
          return { ...base, type: 'text', width: 50, height: 20 };
      }
    };

    return draggable({
      element: el,
      getInitialData: ({ input }) => {
        const rect = el.getBoundingClientRect();
        const comp = getTemplate();
        return {
          type: 'new-component',
          component: comp,
          dragOffsetX: LayoutEngine.mmToPx(comp.width || 100) * 0.5,
          dragOffsetY: LayoutEngine.mmToPx(comp.height || 20) * 0.5,
        };
      },
    });
  }, [type, label]);

  return (
    <div
      ref={ref}
      className={clsx(
        'group flex items-center gap-2 px-2 py-2 rounded-sm bg-slate-50 border border-slate-200 transition-colors cursor-grab active:cursor-grabbing hover:bg-white hover:border-slate-400 hover:shadow-sm'
      )}
    >
      <div className="w-6 h-6 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-slate-500 group-hover:text-slate-800 transition-colors" />
      </div>

      <span className="text-[11px] text-slate-600 font-medium truncate group-hover:text-slate-900">
        {label}
      </span>
    </div>
  );
});
