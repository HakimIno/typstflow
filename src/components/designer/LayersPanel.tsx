'use client';

import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode } from '@/types/schema';
import {
  type Edge,
  attachClosestEdge,
  extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useVirtualizer } from '@tanstack/react-virtual';
import { clsx } from 'clsx';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Lock,
  QrCode,
  Square,
  Table,
  Trash2,
  Type,
  Unlock,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DesignerInput } from '../shared/DesignerInput';

// --- Types ---

type RenderItem =
  | { type: 'header-label'; label: string; zoneKey: string }
  | { type: 'page-separator'; pageId: string; index: number }
  | { type: 'zone-header'; zoneKey: string; label: string; pageId?: string; count: number }
  | {
      type: 'component';
      component: ComponentNode;
      zoneKey: string;
      index: number;
      pageId?: string;
    };

// --- Components ---

const ComponentIcon = memo(({ type, isSelected }: { type: string; isSelected?: boolean }) => {
  const iconClass = clsx(
    'w-3.5 h-3.5 transition-transform duration-200',
    isSelected ? 'scale-110' : 'group-hover:scale-110'
  );

  const containerClass = clsx(
    'p-1 rounded-md shrink-0 flex items-center justify-center transition-all duration-200',
    isSelected
      ? 'bg-[var(--accent)] text-white shadow-[0_0_8px_rgba(0,111,238,0.3)]'
      : 'bg-[var(--bg-widget)] text-[var(--text-secondary)] group-hover:bg-[var(--bg-hover)] group-hover:text-[var(--text-primary)]'
  );

  const getIcon = () => {
    switch (type) {
      case 'text':
        return <Type className={iconClass} />;
      case 'image':
        return <ImageIcon className={iconClass} />;
      case 'table':
        return <Table className={iconClass} />;
      case 'line':
        return <Square className={iconClass} />;
      case 'qrcode':
      case 'barcode':
        return <QrCode className={iconClass} />;
      default:
        return <Layers className={iconClass} />;
    }
  };

  return <div className={containerClass}>{getIcon()}</div>;
});

const LayerItem = memo(
  ({
    component,
    zoneKey,
    index,
    pageId,
  }: {
    component: ComponentNode;
    zoneKey: string;
    index: number;
    pageId?: string;
  }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

    // Optimized selector: Single subscription for all status flags
    const { isSelected, isHidden, isLocked } = useDesignerStore(
      useShallow((state) => ({
        isSelected: state.selectedComponentIds.includes(component.id),
        isHidden: state.hiddenComponentIds.includes(component.id),
        isLocked: state.lockedComponentIds.includes(component.id),
      }))
    );

    const selectComponent = useDesignerStore((state) => state.selectComponent);
    const toggleVisibility = useDesignerStore((state) => state.toggleComponentVisibility);
    const toggleLock = useDesignerStore((state) => state.toggleComponentLock);
    const renameComponent = useDesignerStore((state) => state.renameComponent);

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(component.name || component.type);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;

      return draggable({
        element: el,
        getInitialData: () => ({ id: component.id, zoneKey, index, type: 'layer-item', pageId }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      });
    }, [component.id, zoneKey, index, pageId]);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;

      return dropTargetForElements({
        element: el,
        getData: ({ input, element }) =>
          attachClosestEdge(
            { id: component.id, zoneKey, index, type: 'layer-item', pageId },
            { input, element, allowedEdges: ['top', 'bottom'] }
          ),
        onDragEnter: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      });
    }, [component.id, zoneKey, index, pageId]);

    const handleRename = () => {
      setIsEditing(false);
      renameComponent(component.id, name);
    };

    return (
      <div
        ref={ref}
        className={clsx(
          'w-full group relative flex items-center gap-2 px-2 py-1 cursor-pointer transition-all duration-200 select-none border-l-2 h-[32px]',
          isSelected
            ? 'bg-[var(--accent-glow)] border-[var(--accent)]'
            : 'border-transparent hover:bg-[var(--bg-widget)]',
          isDragging && 'opacity-40 grayscale',
          isHidden && 'opacity-50'
        )}
        onClick={() => selectComponent(component.id)}
        role="button"
        tabIndex={0}
      >
        {closestEdge === 'top' && (
          <div className="absolute top-0 left-1 right-1 h-0.5 bg-[var(--accent)] z-10 rounded-full" />
        )}
        {closestEdge === 'bottom' && (
          <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-[var(--accent)] z-10 rounded-full" />
        )}

        <div className="relative flex items-center gap-2 flex-1 min-w-0 ml-4">
          <GripVertical className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -ml-1" />
          <ComponentIcon type={component.type} isSelected={isSelected} />
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <DesignerInput
                autoFocus
                variant="ghost"
                className="text-[11.5px] font-semibold p-0 text-[var(--text-primary)]"
                value={name}
                onChange={(v) => setName(v)}
                onBlur={handleRename}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              />
            ) : (
              <span
                className={clsx(
                  'block text-[11.5px] font-semibold truncate transition-colors',
                  isSelected
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                )}
                onDoubleClick={() => setIsEditing(true)}
              >
                {component.name || (component.type === 'text' ? component.content : component.type)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-all duration-200 scale-95 group-hover:scale-100 origin-right">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleVisibility(component.id);
            }}
            className={clsx(
              'p-1.5 hover:bg-[var(--bg-hover)] rounded-md transition-colors',
              isHidden
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleLock(component.id);
            }}
            className={clsx(
              'p-1.5 hover:bg-[var(--bg-hover)] rounded-md transition-colors',
              isLocked
                ? 'text-orange-500'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w.3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this component?')) {
                useDesignerStore.getState().removeComponents([component.id]);
              }
            }}
            className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-md text-[var(--text-muted)] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }
);

// --- Hook: useFlattenedLayers ---

function useFlattenedLayers(collapsedGroups: Set<string>) {
  const schema = useDesignerStore((state) => state.schema);

  return useMemo(() => {
    const items: RenderItem[] = [];

    // 1. Header
    const headerComps = schema.zones.header.components;
    items.push({
      type: 'zone-header',
      zoneKey: 'header',
      label: 'Report Header (Global)',
      count: headerComps.length,
    });
    if (!collapsedGroups.has('header') && headerComps.length > 0) {
      const reversed = [...headerComps].reverse();
      for (let i = 0; i < reversed.length; i++) {
        items.push({
          type: 'component',
          component: reversed[i],
          zoneKey: 'header',
          index: headerComps.length - 1 - i,
        });
      }
    }

    // 2. Pages
    for (let pIdx = 0; pIdx < schema.pages.length; pIdx++) {
      const page = schema.pages[pIdx];
      items.push({ type: 'page-separator', pageId: page.id, index: pIdx });

      const bodyComps = page.body.components;
      const groupKey = `body-${page.id}`;
      items.push({
        type: 'zone-header',
        zoneKey: 'body',
        label: 'Detail Band',
        pageId: page.id,
        count: bodyComps.length,
      });

      if (!collapsedGroups.has(groupKey) && bodyComps.length > 0) {
        const reversed = [...bodyComps].reverse();
        for (let i = 0; i < reversed.length; i++) {
          items.push({
            type: 'component',
            component: reversed[i],
            zoneKey: 'body',
            index: bodyComps.length - 1 - i,
            pageId: page.id,
          });
        }
      }
    }

    // 3. Footer
    const footerComps = schema.zones.footer.components;
    items.push({
      type: 'zone-header',
      zoneKey: 'footer',
      label: 'Page Footer (Global)',
      count: footerComps.length,
    });
    if (!collapsedGroups.has('footer') && footerComps.length > 0) {
      const reversed = [...footerComps].reverse();
      for (let i = 0; i < reversed.length; i++) {
        items.push({
          type: 'component',
          component: reversed[i],
          zoneKey: 'footer',
          index: footerComps.length - 1 - i,
        });
      }
    }

    return items;
  }, [schema, collapsedGroups]);
}

// --- Main Component ---

export const LayersPanel = memo(function LayersPanel() {
  const moveComponent = useDesignerStore((state) => state.moveComponent);
  const isEmpty = useDesignerStore(
    (state) =>
      Object.values(state.schema.zones).every((z) => z.components.length === 0) &&
      state.schema.pages.every((p) => p.body.components.length === 0)
  );

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const flattenedLayers = useFlattenedLayers(collapsedGroups);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: flattenedLayers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flattenedLayers[index];
      if (item.type === 'page-separator') return 24;
      if (item.type === 'zone-header') return 28;
      return 32; // Component
    },
    overscan: 10,
  });

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    return monitorForElements({
      onDrop: ({ source, location }) => {
        const destination = location.current.dropTargets[0];
        if (!destination) return;

        const sourceData = source.data as any;
        const destData = destination.data as any;

        if (sourceData.type !== 'layer-item' || destData.type !== 'layer-item') return;

        const edge = extractClosestEdge(destData);
        if (!edge) return;

        let newIndex = destData.index;
        if (edge === 'bottom') {
          newIndex = destData.index;
        } else {
          newIndex = destData.index + 1;
        }

        moveComponent(
          sourceData.id,
          sourceData.zoneKey,
          destData.zoneKey,
          newIndex,
          undefined,
          undefined,
          sourceData.pageId,
          destData.pageId
        );
      },
    });
  }, [moveComponent]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)]">
      {/* Header */}
      <div className="p-3 flex items-center gap-2 border-b border-[var(--border-default)] bg-[var(--bg-widget)] shrink-0">
        <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Layers
        </h2>
      </div>

      {/* Virtualized List Container */}
      <div ref={parentRef} className="flex-1 overflow-y-auto scrollbar-hide py-1">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-64 px-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-widget)] flex items-center justify-center mb-4 shadow-sm border border-[var(--border-subtle)]">
              <Layers className="w-6 h-6 text-[var(--text-muted)] opacity-50" />
            </div>
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] mb-1">No Layers Found</h3>
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
              Start building your report by dragging components from the palette onto the canvas.
            </p>
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const item = flattenedLayers[virtualItem.index];

              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {item.type === 'page-separator' && (
                    <div className="px-2 py-1 flex items-center gap-2 bg-[var(--bg-widget)] border-y border-[var(--border-subtle)] h-full">
                      <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">
                        Page {item.index + 1}
                      </span>
                      <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                    </div>
                  )}

                  {item.type === 'zone-header' && (
                    <button
                      type="button"
                      onClick={() =>
                        toggleGroup(item.zoneKey === 'body' ? `body-${item.pageId}` : item.zoneKey)
                      }
                      className="w-full h-full flex items-center gap-1.5 px-2 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all group"
                    >
                      <div className="p-0.5 rounded-sm bg-[var(--bg-widget)] group-hover:bg-[var(--bg-hover)] transition-colors">
                        {collapsedGroups.has(
                          item.zoneKey === 'body' ? `body-${item.pageId}` : item.zoneKey
                        ) ? (
                          <ChevronRight className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                      {item.label}
                      <div className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] text-[9px] bg-[var(--bg-widget)] text-[var(--text-muted)] px-1 rounded-full font-bold">
                        {item.count}
                      </div>
                    </button>
                  )}

                  {item.type === 'component' && (
                    <LayerItem
                      component={item.component}
                      zoneKey={item.zoneKey}
                      index={item.index}
                      pageId={item.pageId}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
