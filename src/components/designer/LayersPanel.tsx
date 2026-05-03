'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { useShallow } from 'zustand/react/shallow';
import type { ComponentNode, ZoneKey } from '@/types/schema';
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
  Globe,
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
import { DesignerInput } from '../shared/DesignerInput';

// --- Types ---

type RenderItem =
  | { type: 'header-label'; label: string; zoneKey: string }
  | { type: 'page-separator'; pageId: string; index: number }
  | { type: 'global-separator'; label: string }
  | {
      type: 'zone-header';
      zoneKey: string;
      label: string;
      pageId?: string;
      count: number;
      groupId?: string;
      groupType?: 'header' | 'footer';
    }
  | {
      type: 'component';
      component: ComponentNode;
      zoneKey: string;
      index: number;
      pageId?: string;
      groupId?: string;
      groupType?: 'header' | 'footer';
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

const LayerItem = memo(({
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
          {
            id: component.id,
            zoneKey,
            index,
            type: 'layer-item',
            pageId,
            groupId: (component as any).groupId,
            groupType: (component as any).groupType,
          },
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
        isSelected ? 'bg-[var(--accent-glow)] border-[var(--accent)]' : 'border-transparent hover:bg-[var(--bg-widget)]',
        isDragging && 'opacity-40 grayscale',
        isHidden && 'opacity-50'
      )}
      onClick={() => selectComponent(component.id)}
      role="button"
      tabIndex={0}
    >
      {closestEdge === 'top' && <div className="absolute top-0 left-1 right-1 h-0.5 bg-[var(--accent)] z-10 rounded-full" />}
      {closestEdge === 'bottom' && <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-[var(--accent)] z-10 rounded-full" />}

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
                isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
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
            isHidden ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
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
            isLocked ? 'text-orange-500' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
        >
          {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
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
});

// --- Hook: useFlattenedLayers ---

function useFlattenedLayers(collapsedGroups: Set<string>) {
  const schema = useDesignerStore(useShallow((state) => state.schema));

  return useMemo(() => {
    const items: RenderItem[] = [];

    // 1. Header
    const headerComps = schema.zones.header.components;
    const isHeaderGlobal = schema.zones.header.repeatOnEveryPage;
    items.push({
      type: 'zone-header',
      zoneKey: 'header',
      label: isHeaderGlobal ? 'Global Header' : 'Report Header',
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

    // 2. Groups (Headers)
    for (const group of schema.groups || []) {
      const gHeaderKey = `group-${group.id}-header`;
      items.push({
        type: 'zone-header',
        zoneKey: 'header',
        label: `Group Header: ${group.field}`,
        groupId: group.id,
        groupType: 'header',
        count: group.header.components.length,
      });
      if (!collapsedGroups.has(gHeaderKey) && group.header.components.length > 0) {
        const reversed = [...group.header.components].reverse();
        for (let i = 0; i < reversed.length; i++) {
          items.push({
            type: 'component',
            component: reversed[i],
            zoneKey: 'header',
            index: group.header.components.length - 1 - i,
            groupId: group.id,
            groupType: 'header',
          });
        }
      }
    }

    // 3. Pages (Detail Band)
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

    // 4. Groups (Footers) - Rendered in same order as headers but at bottom
    const groups = schema.groups || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const group = groups[i];
      const gFooterKey = `group-${group.id}-footer`;
      items.push({
        type: 'zone-header',
        zoneKey: 'footer',
        label: `Group Footer: ${group.field}`,
        groupId: group.id,
        groupType: 'footer',
        count: group.footer.components.length,
      });
      if (!collapsedGroups.has(gFooterKey) && group.footer.components.length > 0) {
        const reversed = [...group.footer.components].reverse();
        for (let j = 0; j < reversed.length; j++) {
          items.push({
            type: 'component',
            component: reversed[j],
            zoneKey: 'footer',
            index: group.footer.components.length - 1 - j,
            groupId: group.id,
            groupType: 'footer',
          });
        }
      }
    }

    // 5. Footer (with separator so it doesn't visually attach to the last page)
    const footerComps = schema.zones.footer.components;
    const isFooterGlobal = schema.zones.footer.repeatOnEveryPage;
    items.push({
      type: 'global-separator',
      label: isFooterGlobal ? 'Global' : 'Document End',
    });
    items.push({
      type: 'zone-header',
      zoneKey: 'footer',
      label: isFooterGlobal ? 'Global Footer' : 'Page Footer',
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
  const selectedGroupId = useDesignerStore((state) => state.selectedGroupId);
  const selectedZone = useDesignerStore((state) => state.selectedZone);
  const setSelectedZone = useDesignerStore((state) => state.setSelectedZone);
  const updateZone = useDesignerStore((state) => state.updateZone);
  const schema = useDesignerStore((state) => state.schema);

  const isEmpty = useDesignerStore(
    (state) =>
      Object.values(state.schema.zones).every((z) => z.components.length === 0) && state.schema.pages.every((p) => p.body.components.length === 0)
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
      if (item.type === 'global-separator') return 28;
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

        if (sourceData.type !== 'layer-item') return;

        let newIndex = 0;
        if (destData.type === 'layer-item') {
          const edge = extractClosestEdge(destData);
          newIndex = edge === 'bottom' ? destData.index : destData.index + 1;
        } else if (destData.type === 'zone-header') {
          // Dropped onto header: add to end (top of list)
          newIndex = -1; 
        } else {
          return;
        }

        moveComponent(
          sourceData.id,
          sourceData.zoneKey,
          destData.zoneKey,
          newIndex,
          undefined,
          undefined,
          sourceData.pageId,
          destData.pageId,
          false,
          sourceData.groupId,
          destData.groupId,
          sourceData.groupType,
          destData.groupType
        );
      },
    });
  }, [moveComponent]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)]">
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-widget)] shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Layers</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            const expression = prompt('Enter group expression (e.g. data.customer.name):', 'item.id');
            if (expression) {
              useDesignerStore.getState().addGroup(expression);
            }
          }}
          className="p-1 hover:bg-[var(--bg-hover)] rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
          title="Add Group"
        >
          <span className="text-[9px] font-bold uppercase tracking-wider">+ Group</span>
        </button>
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
                      <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Page {item.index + 1}</span>
                      <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                    </div>
                  )}

                  {item.type === 'global-separator' && (
                    <div className="px-2 py-1.5 flex items-center gap-2 bg-gradient-to-r from-[var(--accent-glow)]/40 to-transparent border-y border-[var(--accent)]/30 h-full">
                      <Globe className="w-3 h-3 text-[var(--accent)]" />
                      <span className="text-[8px] font-black text-[var(--accent)] uppercase tracking-[0.2em]">{item.label}</span>
                      <div className="flex-1 h-px bg-[var(--accent)]/20" />
                    </div>
                  )}

                  {item.type === 'zone-header' && (
                    <ZoneHeader
                      item={item}
                      selectedGroupId={selectedGroupId}
                      selectedZone={selectedZone}
                      collapsedGroups={collapsedGroups}
                      toggleGroup={toggleGroup}
                      setSelectedZone={setSelectedZone}
                      updateZone={updateZone}
                      schema={schema}
                    />
                  )}

                  {item.type === 'component' && (
                    <LayerItem component={item.component} zoneKey={item.zoneKey} index={item.index} pageId={item.pageId} />
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

// --- Helper Component: ZoneHeader ---

const ZoneHeader = memo(({
  item,
  selectedGroupId,
  selectedZone,
  collapsedGroups,
  toggleGroup,
  setSelectedZone,
  updateZone,
  schema
}: {
  item: any;
  selectedGroupId: string | null;
  selectedZone: ZoneKey | null;
  collapsedGroups: Set<string>;
  toggleGroup: (key: string) => void;
  setSelectedZone: (zone: ZoneKey | null) => void;
  updateZone: any;
  schema: any;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      getData: () => ({ ...item, type: 'zone-header' }),
      onDragEnter: () => setIsDraggedOver(true),
      onDragLeave: () => setIsDraggedOver(false),
      onDrop: () => setIsDraggedOver(false),
    });
  }, [item]);

  const zoneId = item.zoneKey === 'body' ? `body-${item.pageId}` : item.zoneKey;
  const isSelected = item.groupId ? selectedGroupId === item.groupId : selectedZone === zoneId;

  const repeatOnEveryPage = item.groupId 
    ? false 
    : (item.zoneKey === 'header' || item.zoneKey === 'footer') 
      ? schema.zones[item.zoneKey].repeatOnEveryPage 
      : false;

  return (
    <div
      ref={ref}
      className={clsx(
        'w-full h-full flex items-center gap-1.5 transition-all cursor-pointer group border-l-2 relative',
        isSelected
          ? 'bg-[var(--accent-glow)] text-[var(--accent)] border-[var(--accent)] shadow-sm'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border-transparent hover:bg-white/[0.02]',
        isDraggedOver && 'bg-[var(--accent-glow)]/50 ring-1 ring-inset ring-[var(--accent)]'
      )}
      onClick={() => {
        if (item.groupId) {
          useDesignerStore.getState().selectGroup(item.groupId);
        } else {
          setSelectedZone(item.zoneKey as any);
          useDesignerStore.getState().selectGroup(null);
        }
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const key = item.groupId ? `group-${item.groupId}-${item.groupType}` : zoneId;
          toggleGroup(key);
        }}
        className="pl-2 pr-1 h-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
      >
        <div className="p-0.5 rounded-sm bg-black/10 group-hover:bg-black/20 transition-colors">
          {collapsedGroups.has(item.groupId ? `group-${item.groupId}-${item.groupType}` : zoneId) ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </div>
      </button>

      <span className="text-[9px] font-bold uppercase tracking-widest flex-1">{item.label}</span>

      {(item.zoneKey === 'header' || item.zoneKey === 'footer') && !item.groupId && (
        <button
          type="button"
          title={repeatOnEveryPage ? "Global (Repeats on every page)" : "Not Global (Static)"}
          onClick={(e) => {
            e.stopPropagation();
            updateZone(item.zoneKey, { repeatOnEveryPage: !repeatOnEveryPage });
          }}
          className={clsx(
            "p-1 rounded-md transition-colors mr-1",
            repeatOnEveryPage ? "text-[var(--accent)] bg-[var(--accent-glow)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
          )}
        >
          <Globe className="w-3 h-3" />
        </button>
      )}

      <div className="mr-2 flex items-center justify-center min-w-[18px] h-[18px] text-[9px] bg-black/5 text-[var(--text-muted)] px-1 rounded-full font-bold">
        {item.count}
      </div>
    </div>
  );
});
