'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { clsx } from 'clsx';
import {
  Columns,
  FileDown,
  Image,
  LayoutDashboard,
  ListTree,
  Minus,
  QrCode,
  ScanLine,
  Search,
  Space,
  Table,
  Type,
  X,
} from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { DesignerInput } from '../shared/DesignerInput';

const CATEGORIES = [
  {
    id: 'widgets',
    label: 'Standard Widgets',
    items: [
      { type: 'table', label: 'Data Table', icon: Table },
      { type: 'summary-box', label: 'Summary Box', icon: LayoutDashboard },
    ],
  },
  {
    id: 'basics',
    label: 'Common',
    items: [
      { type: 'text', label: 'Text Field', icon: Type },
      { type: 'image', label: 'Picture', icon: Image },
      { type: 'line', label: 'Line Divider', icon: Minus },
    ],
  },
  {
    id: 'advanced',
    label: 'Data Rendering',
    items: [
      { type: 'barcode', label: 'Barcode', icon: ScanLine },
      { type: 'qr', label: 'QR Code', icon: QrCode },
    ],
  },
  {
    id: 'layout',
    label: 'Layout',
    items: [
      { type: 'columns', label: 'Columns', icon: Columns },
      { type: 'spacer', label: 'Space', icon: Space },
      { type: 'repeater', label: 'Repeater', icon: ListTree },
      { type: 'page-break-indicator', label: 'Page Break', icon: FileDown },
    ],
  },
];

export const Palette = memo(function Palette() {
  const { setSidebarOpen } = useDesignerStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.type.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)] overflow-hidden font-sans border-r border-[var(--border-default)]">
      {/* Utility Header */}
      <div className="px-3 py-2.5 bg-[var(--bg-widget)] flex items-center justify-between border-b border-[var(--border-default)] shrink-0">
        <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-[0.1em]">
          Element Library
        </span>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Bar - Compact */}
      <div className="p-2 border-b border-[var(--border-default)] shrink-0">
        <div className="relative group">
          <DesignerInput
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(v) => setSearchQuery(v)}
            className="pr-8"
          />
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] group-focus-within:text-[var(--text-secondary)] transition-colors" />
        </div>
      </div>

      {/* Categories Content - Dense Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-4">
        {filteredCategories.map((cat) => (
          <div key={cat.id} className="space-y-1.5">
            <div className="px-1 py-1 border-b border-[var(--border-default)] flex items-center justify-between">
              <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-[0.1em]">
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
      const base = { id: '', x: 10, y: 10, width: 100, height: 20 };
      switch (type) {
        case 'text':
          return {
            ...base,
            type: 'text',
            content: 'Double click to edit',
            style: { fontSize: 10 },
            width: 60,
            height: 6,
          };
        case 'table':
          return {
            ...base,
            type: 'table',
            dataSource: '{{items}}',
            columns: [{ id: '1', header: 'Header', field: 'field', width: '1fr' }],
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
            value: '12345678',
            format: 'code128',
            width: 40,
            height: 15,
          };
        case 'qr':
          return { ...base, type: 'qr', value: 'https://example.com', width: 30, height: 30 };
        case 'spacer':
          return { ...base, type: 'spacer', height: 10, width: 10 };
        case 'columns':
          return {
            ...base,
            type: 'columns',
            columns: [
              { width: '1fr', components: [] },
              { width: '1fr', components: [] },
            ],
            width: 180,
            height: 40,
          };
        case 'repeater':
          return {
            ...base,
            type: 'repeater',
            dataSource: '{{items}}',
            children: [],
            width: 180,
            height: 40,
          };
        case 'summary-box':
          return {
            ...base,
            type: 'summary-box',
            rows: [{ label: 'Subtotal', value: '$0.00' }],
            width: 80,
            height: 30,
          };
        default:
          return { ...base, type: 'text', content: '', height: 10 };
      }
    };

    return draggable({
      element: el,
      getInitialData: () => {
        const _rect = el.getBoundingClientRect();
        const comp = getTemplate();
        // Offset must be in viewport pixels (compensated for zoom)
        // so that calculateDropPosition divides correctly
        const zoom = useDesignerStore.getState().zoom;
        return {
          type: 'new-component',
          component: comp,
          dragOffsetX: LayoutEngine.mmToPx(comp.width || 100) * 0.5 * zoom,
          dragOffsetY: LayoutEngine.mmToPx(comp.height || 20) * 0.5 * zoom,
        };
      },
    });
  }, [type]);

  return (
    <div
      ref={ref}
      className={clsx(
        'group flex flex-col items-center gap-2 px-2 py-2 rounded-[6px] bg-[var(--bg-widget)] border border-[var(--border-default)] transition-all cursor-grab active:cursor-grabbing hover:bg-[var(--bg-hover)] hover:border-[var(--border-accent)]'
      )}
    >
      <div className="w-6 h-6 flex  items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
      </div>

      <span className="text-[9px] text-[var(--text-muted)] font-medium truncate group-hover:text-[var(--text-secondary)] text-center w-full uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
});
