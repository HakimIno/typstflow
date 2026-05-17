'use client';

import { DesignerInput } from '@/components/shared/DesignerInput';
import { useDesignerStore } from '@/store/designer-store';
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
import { Icon } from '@iconify/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { clsx } from 'clsx';
import {
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
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
import { BasePanel } from './BasePanel';
import { PanelHeader } from './PanelHeader';

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
    'w-4 h-4 transition-transform duration-200 group-hover:scale-110',
    isSelected
      ? 'text-[var(--accent)]'
      : 'text-[var(--text-muted)] group-hover:text-[var(--accent)]'
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
      case 'qr':
      case 'barcode':
        return <QrCode className={iconClass} />;
      default:
        return <Layers className={iconClass} />;
    }
  };

  return <div className="flex items-center justify-center shrink-0">{getIcon()}</div>;
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
    const setActivePage = useDesignerStore((state) => state.setActivePage);
    const setScrollToPageId = useDesignerStore((state) => state.setScrollToPageId);
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
    }, [component, component.id, zoneKey, index, pageId]);

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
    }, [component, component.id, zoneKey, index, pageId]);

    const handleRename = () => {
      setIsEditing(false);
      renameComponent(component.id, name);
    };

    const handleSelect = useCallback(() => {
      selectComponent(component.id);
      if (pageId) {
        setActivePage(pageId);
        setScrollToPageId(pageId);
      }
    }, [component.id, pageId, selectComponent, setActivePage, setScrollToPageId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect();
      }
    };

    return (
      <div
        ref={ref}
        className={clsx(
          'w-full group relative flex items-center gap-3 px-3 py-0 cursor-pointer select-none',
          isSelected && 'bg-white/5',
          isDragging && 'opacity-40 grayscale',
          isHidden && 'opacity-50'
        )}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
      >
        {closestEdge === 'top' && (
          <div className="absolute -top-1 left-2 right-2 h-0.5 bg-[var(--accent)] z-10 rounded-full" />
        )}
        {closestEdge === 'bottom' && (
          <div className="absolute -bottom-1 left-2 right-2 h-0.5 bg-[var(--accent)] z-10 rounded-full" />
        )}

        <div className="relative flex items-center gap-3 flex-1 min-w-0">
          <ComponentIcon type={component.type} isSelected={isSelected} />
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
              <span
                className={clsx(
                  'block text-[13px] font-medium truncate leading-tight transition-colors',
                  isSelected
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-muted)] group-hover:text-[var(--accent)]'
                )}
                onDoubleClick={() => setIsEditing(true)}
              >
                {component.name || (component.type === 'text' ? component.content : component.type)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleVisibility(component.id);
            }}
            className="p-1 hover:text-[var(--accent)] transition-colors text-[var(--accent)]/60"
          >
            {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleLock(component.id);
            }}
            className="p-1 hover:text-[var(--accent)] transition-colors text-[var(--accent)]/60"
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              useDesignerStore.getState().showDialog({
                title: 'Delete Component',
                message: `Are you sure you want to delete this ${component.type} component?`,
                variant: 'danger',
                confirmLabel: 'Delete',
                onConfirm: () => {
                  useDesignerStore.getState().removeComponents([component.id]);
                },
              });
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

function useFlattenedLayers(collapsedGroups: Set<string>, searchQuery: string) {
  const schema = useDesignerStore(useShallow((state) => state.schema));
  const query = searchQuery.toLowerCase().trim();

  return useMemo(() => {
    const isMatch = (comp: ComponentNode) => {
      if (!query) return true;
      const name = (comp.name || '').toLowerCase();
      const type = (comp.type || '').toLowerCase();
      const content = comp.type === 'text' ? (comp.content || '').toLowerCase() : '';
      return name.includes(query) || type.includes(query) || content.includes(query);
    };

    const items: RenderItem[] = [];

    // 1. Header
    const headerComps = schema.zones.header.components.filter(isMatch);
    const isHeaderGlobal = schema.zones.header.repeatOnEveryPage;
    if (!query || headerComps.length > 0) {
      items.push({
        type: 'zone-header',
        zoneKey: 'header',
        label: isHeaderGlobal ? 'Global Header' : 'Report Header',
        count: headerComps.length,
      });
      if ((!collapsedGroups.has('header') || query) && headerComps.length > 0) {
        const reversed = [...headerComps].reverse();
        for (let i = 0; i < reversed.length; i++) {
          items.push({
            type: 'component',
            component: reversed[i],
            zoneKey: 'header',
            index: schema.zones.header.components.findIndex((c) => c.id === reversed[i].id),
          });
        }
      }
    }

    // 2. Groups (Headers)
    for (const group of schema.groups || []) {
      const gHeaderKey = `group-${group.id}-header`;
      const gHeaderComps = group.header.components.filter(isMatch);
      if (!query || gHeaderComps.length > 0) {
        items.push({
          type: 'zone-header',
          zoneKey: 'header',
          label: `Group Header: ${group.field}`,
          groupId: group.id,
          groupType: 'header',
          count: gHeaderComps.length,
        });
        if ((!collapsedGroups.has(gHeaderKey) || query) && gHeaderComps.length > 0) {
          const reversed = [...gHeaderComps].reverse();
          for (let i = 0; i < reversed.length; i++) {
            items.push({
              type: 'component',
              component: reversed[i],
              zoneKey: 'header',
              index: group.header.components.findIndex((c) => c.id === reversed[i].id),
              groupId: group.id,
              groupType: 'header',
            });
          }
        }
      }
    }

    // 3. Pages (Detail Band)
    for (let pIdx = 0; pIdx < schema.pages.length; pIdx++) {
      const page = schema.pages[pIdx];
      const bodyComps = page.body.components.filter(isMatch);

      if (!query || bodyComps.length > 0) {
        if (!query) {
          items.push({ type: 'page-separator', pageId: page.id, index: pIdx });
        }

        const groupKey = `body-${page.id}`;
        items.push({
          type: 'zone-header',
          zoneKey: 'body',
          label: query ? `Page ${pIdx + 1} - Detail Band` : 'Detail Band',
          pageId: page.id,
          count: bodyComps.length,
        });

        if ((!collapsedGroups.has(groupKey) || query) && bodyComps.length > 0) {
          const reversed = [...bodyComps].reverse();
          for (let i = 0; i < reversed.length; i++) {
            items.push({
              type: 'component',
              component: reversed[i],
              zoneKey: 'body',
              index: page.body.components.findIndex((c) => c.id === reversed[i].id),
              pageId: page.id,
            });
          }
        }
      }
    }

    // 4. Groups (Footers)
    const groups = schema.groups || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const group = groups[i];
      const gFooterKey = `group-${group.id}-footer`;
      const gFooterComps = group.footer.components.filter(isMatch);
      if (!query || gFooterComps.length > 0) {
        items.push({
          type: 'zone-header',
          zoneKey: 'footer',
          label: `Group Footer: ${group.field}`,
          groupId: group.id,
          groupType: 'footer',
          count: gFooterComps.length,
        });
        if ((!collapsedGroups.has(gFooterKey) || query) && gFooterComps.length > 0) {
          const reversed = [...gFooterComps].reverse();
          for (let j = 0; j < reversed.length; j++) {
            items.push({
              type: 'component',
              component: reversed[j],
              zoneKey: 'footer',
              index: group.footer.components.findIndex((c) => c.id === reversed[j].id),
              groupId: group.id,
              groupType: 'footer',
            });
          }
        }
      }
    }

    // 5. Footer
    const footerComps = schema.zones.footer.components.filter(isMatch);
    const isFooterGlobal = schema.zones.footer.repeatOnEveryPage;
    if (!query || footerComps.length > 0) {
      if (!query) {
        items.push({
          type: 'global-separator',
          label: isFooterGlobal ? 'Global' : 'Document End',
        });
      }
      items.push({
        type: 'zone-header',
        zoneKey: 'footer',
        label: isFooterGlobal ? 'Global Footer' : 'Page Footer',
        count: footerComps.length,
      });
      if ((!collapsedGroups.has('footer') || query) && footerComps.length > 0) {
        const reversed = [...footerComps].reverse();
        for (let i = 0; i < reversed.length; i++) {
          items.push({
            type: 'component',
            component: reversed[i],
            zoneKey: 'footer',
            index: schema.zones.footer.components.findIndex((c) => c.id === reversed[i].id),
          });
        }
      }
    }

    return items;
  }, [schema, collapsedGroups, query]);
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
      Object.values(state.schema.zones).every((z) => z.components.length === 0) &&
      state.schema.pages.every((p) => p.body.components.length === 0)
  );

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const flattenedLayers = useFlattenedLayers(collapsedGroups, searchQuery);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: flattenedLayers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flattenedLayers[index];
      if (item.type === 'page-separator') return 36;
      if (item.type === 'global-separator') return 36;
      if (item.type === 'zone-header') return 32;
      return 32; // Component (32px)
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
    <BasePanel>
      <PanelHeader
        title="Layers"
        icon={Layers}
        actions={
          <button
            type="button"
            onClick={() => {
              useDesignerStore.getState().showDialog({
                title: 'Add Group',
                message: 'Enter the data field path to group by (e.g. item.category)',
                showInput: true,
                inputPlaceholder: 'e.g. item.id',
                initialValue: 'item.id',
                confirmLabel: 'Add Group',
                onConfirm: (val) => {
                  if (val) {
                    useDesignerStore.getState().addGroup(val);
                  }
                },
              });
            }}
            className="p-1 hover:bg-[var(--bg-hover)] rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
            title="Add Group"
          >
            <span className="text-[11px] font-medium">+ Group</span>
          </button>
        }
      />

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
          <Icon
            icon="lucide:search"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] group-focus-within:text-[var(--text-secondary)] transition-colors"
          />
        </div>
      </div>

      <hr className="border-white/5" />

      {/* Virtualized List Container */}
      <div ref={parentRef} className="flex-1 overflow-y-auto scrollbar-hide py-1">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-64 px-10 text-center">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-widget)] flex items-center justify-center mb-4 border border-[var(--border-subtle)]">
              <Layers className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] mb-1">
              No Layers Found
            </h3>
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
                    <div
                      className="px-2 h-8 flex items-center justify-between border-b border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-colors group/page"
                      onClick={() => {
                        useDesignerStore.getState().setActivePage(item.pageId);
                        useDesignerStore.getState().setScrollToPageId(item.pageId);
                      }}
                    >
                      <span className="text-[11px] font-bold text-[var(--text-muted)] group-hover/page:text-[var(--text-primary)] uppercase tracking-widest transition-colors">
                        Page {item.index + 1}
                      </span>
                    </div>
                  )}

                  {item.type === 'global-separator' && (
                    <div className="px-2 py-1 flex items-center gap-2 mt-4">
                      <div className="flex items-center gap-2 shrink-0">
                        <Globe className="w-3 h-3 text-[var(--accent)]" />
                        <span className="text-[11px] font-bold text-[var(--accent)]">
                          {item.label}
                        </span>
                      </div>
                      <div className="flex-1 h-px bg-[var(--accent)] opacity-20" />
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
    </BasePanel>
  );
});

// --- Helper Component: ZoneHeader ---

const ZoneHeader = memo(
  ({
    item,
    selectedGroupId,
    selectedZone,
    collapsedGroups,
    toggleGroup,
    setSelectedZone,
    updateZone,
    schema,
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
      : item.zoneKey === 'header' || item.zoneKey === 'footer'
        ? schema.zones[item.zoneKey].repeatOnEveryPage
        : false;

    const handleSelect = () => {
      if (item.groupId) {
        useDesignerStore.getState().selectGroup(item.groupId);
      } else {
        setSelectedZone(item.zoneKey as any);
        useDesignerStore.getState().selectGroup(null);
      }
    };

    const _handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect();
      }
    };

    const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      const key = item.groupId ? `group-${item.groupId}-${item.groupType}` : zoneId;
      toggleGroup(key);
    };

    return (
      <div
        ref={ref}
        className={clsx(
          'w-full h-full flex items-center gap-2 px-3 transition-all cursor-pointer group',
          isSelected
            ? 'bg-white/10 text-[var(--accent)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
          isDraggedOver && 'bg-[var(--accent)]/10'
        )}
        onClick={(e) => {
          handleSelect();
          handleToggle(e);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelect();
            handleToggle(e);
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
          className="p-1 h-6 w-6 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
        >
          <ChevronRight
            className={clsx(
              'w-3.5 h-3.5 transition-transform duration-200',
              !collapsedGroups.has(
                item.groupId ? `group-${item.groupId}-${item.groupType}` : zoneId
              ) && 'rotate-90'
            )}
          />
        </button>

        <span className="text-[11px] font-medium flex-1 opacity-90 group-hover:opacity-100 transition-opacity">
          {item.label}
        </span>

        {(item.zoneKey === 'header' || item.zoneKey === 'footer') && !item.groupId && (
          <button
            type="button"
            title={repeatOnEveryPage ? 'Global (Repeats on every page)' : 'Not Global (Static)'}
            onClick={(e) => {
              e.stopPropagation();
              updateZone(item.zoneKey, { repeatOnEveryPage: !repeatOnEveryPage });
            }}
            className={clsx(
              'p-1 rounded-md transition-colors mr-1',
              repeatOnEveryPage
                ? 'text-[var(--accent)] bg-[var(--accent-glow)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
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
  }
);
