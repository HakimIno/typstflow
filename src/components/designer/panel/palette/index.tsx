'use client';

import { DesignerInput } from '@/components/shared/DesignerInput';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { Blocks, LayoutDashboard, Search } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { BasePanel } from '../BasePanel';
import { PanelHeader } from '../PanelHeader';
import { BlockItem } from './BlockItem';
import { PaletteItem } from './PaletteItem';
import { CATEGORIES } from './categories';

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
