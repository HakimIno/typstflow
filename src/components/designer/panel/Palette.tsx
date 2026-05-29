'use client';

import { DesignerInput } from '@/components/shared/DesignerInput';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import type { SavedBlock } from '@/types/schema';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { clsx } from 'clsx';
import {
  Blocks,
  Columns,
  FileDown,
  Hash,
  Image,
  LayoutDashboard,
  ListChecks,
  ListTree,
  Minus,
  PenLine,
  Plus,
  QrCode,
  RectangleHorizontal,
  ScanLine,
  Search,
  Space,
  Table,
  Trash2,
  Type,
} from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { BasePanel } from './BasePanel';
import { PanelHeader } from './PanelHeader';

const CATEGORIES = [
  {
    id: 'widgets',
    label: 'Standard Widgets',
    items: [
      { type: 'table', label: 'Data Table', icon: Table },
      { type: 'summary-box', label: 'Summary Box', icon: LayoutDashboard },
      { type: 'checklist', label: 'Checklist', icon: ListChecks },
    ],
  },
  {
    id: 'basics',
    label: 'Common',
    items: [
      { type: 'text', label: 'Text Field', icon: Type },
      { type: 'image', label: 'Picture', icon: Image },
      { type: 'line', label: 'Line Divider', icon: Minus },
      { type: 'rectangle', label: 'Rectangle', icon: RectangleHorizontal },
      { type: 'signature', label: 'Signature Line', icon: PenLine },
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
      { type: 'page-number', label: 'Page Number', icon: Hash },
      { type: 'page-break-indicator', label: 'Page Break', icon: FileDown },
    ],
  },
];

export const Palette = memo(function Palette() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'elements' | 'blocks'>('elements');
  const savedBlocks = useDesignerStore((s) => s.savedBlocks);
  const deleteBlock = useDesignerStore((s) => s.deleteBlock);
  const insertBlock = useDesignerStore((s) => s.insertBlock);
  const activePageId = useDesignerStore((s) => s.activePageId);
  const activeZone = useDesignerStore((s) => s.selectedZone) ?? 'body';

  const filteredCategories = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.type.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((cat) => cat.items.length > 0),
    [searchQuery]
  );

  return (
    <BasePanel>
      <PanelHeader title="Element Library" icon={LayoutDashboard} />

      {/* Tab switcher */}
      <div className="flex border-b border-[var(--border-default)] shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('elements')}
          className={clsx(
            'flex-1 py-1.5 text-[11px] font-semibold transition-colors',
            activeTab === 'elements'
              ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          )}
        >
          Elements
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('blocks')}
          className={clsx(
            'flex-1 py-1.5 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1',
            activeTab === 'blocks'
              ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          )}
        >
          <Blocks className="w-3 h-3" />
          Blocks
          {savedBlocks.length > 0 && (
            <span className="ml-0.5 bg-[var(--accent)]/20 text-[var(--accent)] text-[9px] font-bold px-1 rounded-full">
              {savedBlocks.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'elements' && (
        <>
          {/* Search Bar */}
          <div className="p-2 border-b border-[var(--border-default)] shrink-0">
            <div className="relative group">
              <DesignerInput
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(v: string) => setSearchQuery(v)}
                className="pr-8"
              />
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] group-focus-within:text-[var(--text-secondary)] transition-colors" />
            </div>
          </div>

          {/* Categories Content */}
          <div className="flex-1 overflow-y-auto scrollbar-none py-1">
            {filteredCategories.map((cat) => (
              <div key={cat.id} className="mb-2 last:mb-0">
                <div className="h-7 px-3 flex items-center gap-2 text-[var(--text-muted)]">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em]">
                    {cat.label}
                  </span>
                  <div className="flex-1 h-px bg-[var(--border-default)] opacity-70" />
                </div>
                <div className="grid grid-cols-1">
                  {cat.items.map((item) => (
                    <PaletteItem key={item.type} {...item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'blocks' && (
        <div className="flex-1 overflow-y-auto scrollbar-hide py-1">
          {savedBlocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-4">
              <Blocks className="w-8 h-8 text-[var(--text-muted)] opacity-40" />
              <p className="text-xs text-[var(--text-muted)]">No saved blocks yet</p>
              <p className="text-[11px] text-[var(--text-muted)] opacity-60 leading-snug">
                Select components and click "Save as Block" in the properties panel
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {savedBlocks.map((block) => (
                <BlockItem
                  key={block.id}
                  block={block}
                  onInsert={() => insertBlock(block.id, activeZone, activePageId ?? undefined)}
                  onDelete={() => deleteBlock(block.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </BasePanel>
  );
});

const BlockItem = memo(function BlockItem({
  block,
  onInsert,
  onDelete,
}: {
  block: SavedBlock;
  onInsert: () => void;
  onDelete: () => void;
}) {
  const renameBlock = useDesignerStore((state) => state.renameBlock);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(block.name);

  const handleRename = () => {
    setIsEditing(false);
    if (name.trim()) {
      renameBlock(block.id, name.trim());
    } else {
      setName(block.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onInsert();
    }
  };

  return (
    <div
      className={clsx(
        'w-full group relative flex items-center gap-2 pr-3 py-1.5 cursor-pointer select-none transition-colors hover:bg-white/5'
      )}
      style={{ paddingLeft: '34px' }}
      onClick={onInsert}
      onKeyDown={handleKeyDown}
    >
      <div className="relative flex items-center gap-2.5 flex-1 min-w-0">
        <div className="w-5 flex items-center justify-center shrink-0">
          <Blocks className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors duration-200" />
        </div>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <DesignerInput
              autoFocus
              variant="ghost"
              className="text-[12px] font-medium p-0 text-[var(--accent)]"
              value={name}
              onChange={(v: string) => setName(v)}
              onBlur={handleRename}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleRename()}
            />
          ) : (
            <>
              <span
                className="block text-[13px] font-medium truncate leading-tight transition-colors text-[var(--text-muted)] group-hover:text-[var(--accent)]"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
              >
                {block.name}
              </span>
              <span className="block text-[10px] text-[var(--text-muted)] mt-0.5 leading-none">
                {block.components.length} component{block.components.length !== 1 ? 's' : ''} ·{' '}
                {block.sourceZone}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInsert();
          }}
          className="p-1 hover:text-[var(--accent)] transition-colors text-[var(--accent)]/60"
          title="Insert block"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            useDesignerStore.getState().showDialog({
              title: 'Delete Block',
              message: `Are you sure you want to delete the block "${block.name}"?`,
              variant: 'danger',
              confirmLabel: 'Delete',
              onConfirm: onDelete,
            });
          }}
          className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-md text-[var(--text-muted)] transition-colors"
          title="Delete block"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

interface PaletteItemProps {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PaletteItem = memo(function PaletteItem({ type, label, icon: Icon }: PaletteItemProps) {
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
          return { ...base, type: 'image', src: '/logo13.png', width: 40, height: 40 };
        case 'line':
          return {
            ...base,
            type: 'line',
            orientation: 'horizontal',
            thickness: '1pt',
            color: 'black',
            width: 180,
            height: 2,
          };
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
            gap: '10mm',
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
        case 'checklist':
          return {
            ...base,
            type: 'checklist',
            listStyle: 'bullet',
            items: [
              { id: 'item-1', label: 'รายการที่ 1', checked: false },
              { id: 'item-2', label: 'รายการที่ 2', checked: false },
              { id: 'item-3', label: 'รายการที่ 3', checked: false },
            ],
            spacing: 4,
            indent: 5,
            style: { fontSize: 10, fontFamily: 'Sarabun', color: '#000000' },
            width: 120,
            height: 35,
          };
        case 'page-break-indicator':
          return {
            ...base,
            type: 'page-break-indicator',
            width: 210,
            height: 2,
          };
        case 'page-number':
          return {
            ...base,
            type: 'page-number',
            format: 'Page X of Y',
            style: { fontSize: 9, fontWeight: 'medium' },
            width: 35,
            height: 6,
          };
        case 'rectangle':
          return {
            ...base,
            type: 'rectangle',
            fill: '#f3f4f6',
            strokeColor: '#d1d5db',
            strokeWidth: '1pt',
            strokeStyle: 'solid',
            radius: '2mm',
            width: 60,
            height: 20,
          };
        case 'signature':
          return {
            ...base,
            type: 'signature',
            slots: [
              {
                id: 'sig-1',
                label: 'ผู้อนุมัติ',
                nameLabel: '(......................)',
                dateLabel: 'วันที่: ___/___/______',
              },
              {
                id: 'sig-2',
                label: 'ผู้ตรวจสอบ',
                nameLabel: '(......................)',
                dateLabel: 'วันที่: ___/___/______',
              },
            ],
            showNameLine: true,
            showDateLine: true,
            lineStyle: 'solid',
            lineColor: '#000000',
            labelStyle: { fontSize: 8 },
            width: 180,
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
        'group mx-1.5 flex items-center gap-2.5 rounded-md p-1 transition-all cursor-grab active:cursor-grabbing border border-transparent hover:bg-[var(--bg-widget)] hover:border-[var(--border-subtle)]'
      )}
    >
      <div
        className="w-7 h-7 rounded-full  flex items-center justify-center shrink-0 border border-[var(--border-subtle)] group-hover:bg-[var(
         --bg-surface)] group-hover:border-[var(--accent)]/45 transition-all"
      >
        <Icon className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" />
      </div>

      <span className="text-[13px] text-[var(--text-secondary)] font-medium truncate group-hover:text-[var(--text-primary)] transition-colors">
        {label}
      </span>
    </div>
  );
});
