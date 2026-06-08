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
  Columns3,
  Eye,
  EyeOff,
  FolderOpen,
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
      type: 'column-header';
      id: string;
      label: string;
      count: number;
      depth: number;
      columnLayoutId: string;
      columnIndex: number;
    }
  | {
      type: 'component';
      component: ComponentNode;
      zoneKey: string;
      index: number;
      pageId?: string;
      groupId?: string;
      groupType?: 'header' | 'footer';
      depth: number;
      parentColumnLayoutId?: string;
      parentColumnIndex?: number;
    };

// --- Components ---

const getLayerIndent = (depth: number) => {
  if (depth <= 0) return 34;
  if (depth === 1) return 46;
  return 58;
};

const getColumnHeaderIndent = (depth: number) => {
  if (depth <= 1) return 46;
  return 54;
};

const ComponentIcon = memo(({ type, isSelected }: { type: string; isSelected?: boolean }) => {
  const iconClass = clsx(
    'w-4 h-4 transition-colors duration-200',
    isSelected
      ? 'text-[var(--accent)]'
      : 'text-[var(--text-muted)] group-hover:text-[var(--accent)]'
  );

  const getIcon = () => {
    switch (type) {
      case 'columns':
        return <Columns3 className={iconClass} />;
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

  return <div className="w-5 flex items-center justify-center shrink-0">{getIcon()}</div>;
});

const LayerItem = memo(
  ({
    component,
    zoneKey,
    index,
    pageId,
    depth,
    parentColumnLayoutId,
    parentColumnIndex,
    collapsedGroups,
    toggleGroup,
  }: {
    component: ComponentNode;
    zoneKey: string;
    index: number;
    pageId?: string;
    depth: number;
    parentColumnLayoutId?: string;
    parentColumnIndex?: number;
    collapsedGroups: Set<string>;
    toggleGroup: (key: string) => void;
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
    const ungroupContainer = useDesignerStore((state) => state.ungroupContainer);

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(component.name || component.type);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;

      return draggable({
        element: el,
        getInitialData: () => ({
          id: component.id,
          zoneKey,
          index,
          type: 'layer-item',
          pageId,
          parentColumnLayoutId,
          parentColumnIndex,
        }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      });
    }, [component, component.id, zoneKey, index, pageId, parentColumnLayoutId, parentColumnIndex]);

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
              parentColumnLayoutId,
              parentColumnIndex,
            },
            { input, element, allowedEdges: ['top', 'bottom'] }
          ),
        onDragEnter: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      });
    }, [component, component.id, zoneKey, index, pageId, parentColumnLayoutId, parentColumnIndex]);

    const handleRename = () => {
      setIsEditing(false);
      renameComponent(component.id, name);
    };

    const handleSelect = useCallback(
      (multi = false) => {
        selectComponent(component.id, multi);
        if (pageId) {
          setActivePage(pageId);
          setScrollToPageId(pageId);
        }
      },
      [component.id, pageId, selectComponent, setActivePage, setScrollToPageId]
    );

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
          'w-full group relative flex items-center gap-2 pr-3 cursor-pointer select-none',
          isSelected && 'bg-white/5',
          isDragging && 'opacity-40 grayscale',
          isHidden && 'opacity-50'
        )}
        style={{ paddingLeft: `${getLayerIndent(depth)}px` }}
        onClick={(e) => handleSelect(e.metaKey || e.ctrlKey || e.shiftKey)}
        onKeyDown={handleKeyDown}
      >
        {closestEdge === 'top' && (
          <div className="absolute -top-1 left-8 right-2 h-0.5 bg-[var(--accent)] z-10 rounded-full" />
        )}
        {closestEdge === 'bottom' && (
          <div className="absolute -bottom-1 left-8 right-2 h-0.5 bg-[var(--accent)] z-10 rounded-full" />
        )}

        <div className="relative flex items-center gap-2.5 flex-1 min-w-0">
          {component.type === 'columns' || component.type === 'repeater' ? (
            <button
              type="button"
              className="w-3 h-3 flex items-center justify-center text-[var(--text-muted)] shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleGroup(`component-${component.id}`);
              }}
            >
              <ChevronRight
                className={clsx(
                  'w-3 h-3 transition-transform duration-200',
                  !collapsedGroups.has(`component-${component.id}`) && 'rotate-90'
                )}
              />
            </button>
          ) : (
            <div className="w-3 shrink-0" />
          )}
          <ComponentIcon type={component.type} isSelected={isSelected} />
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <DesignerInput
                autoFocus
                variant="ghost"
                className="text-xs p-0 text-[var(--accent)]"
                value={name}
                onChange={(v: string) => setName(v)}
                onBlur={handleRename}
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleRename()}
              />
            ) : (
              <span
                className={clsx(
                  'block text-xs  truncate leading-tight transition-colors',
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

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
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
          {component.type === 'columns' && (
            <button
              type="button"
              title="Ungroup"
              onClick={(e) => {
                e.stopPropagation();
                ungroupContainer(component.id);
              }}
              className="p-1 hover:text-[var(--accent)] transition-colors text-[var(--accent)]/60"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          )}
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
    const isDirectMatch = (comp: ComponentNode) => {
      if (!query) return true;
      const name = (comp.name || '').toLowerCase();
      const type = (comp.type || '').toLowerCase();
      const content = comp.type === 'text' ? (comp.content || '').toLowerCase() : '';
      return name.includes(query) || type.includes(query) || content.includes(query);
    };

    const hasMatchingDescendant = (comp: ComponentNode): boolean => {
      if (isDirectMatch(comp)) return true;
      if (comp.type === 'columns') {
        return comp.columns.some((column) =>
          (column.components || []).some((child) => hasMatchingDescendant(child))
        );
      }
      if (comp.type === 'repeater') {
        return comp.children.some((child) => hasMatchingDescendant(child));
      }
      return false;
    };

    // Pre-compute id→index maps per zone to avoid O(n²) findIndex calls inside loops
    const indexMap = (comps: ComponentNode[]) => new Map(comps.map((c, i) => [c.id, i]));

    const items: RenderItem[] = [];
    const pushComponent = (
      comp: ComponentNode,
      zoneKey: ZoneKey,
      index: number,
      depth: number,
      pageId?: string,
      groupId?: string,
      groupType?: 'header' | 'footer',
      parentColumnLayoutId?: string,
      parentColumnIndex?: number
    ) => {
      if (!hasMatchingDescendant(comp)) return;

      items.push({
        type: 'component',
        component: comp,
        zoneKey,
        index,
        pageId,
        groupId,
        groupType,
        depth,
        parentColumnLayoutId,
        parentColumnIndex,
      });

      if (comp.type === 'columns') {
        const isOpen = !collapsedGroups.has(`component-${comp.id}`) || Boolean(query);
        if (!isOpen) return;

        comp.columns.forEach((column, columnIndex) => {
          const children = (column.components || []).filter(hasMatchingDescendant);
          const columnKey = `column-${comp.id}-${columnIndex}`;
          items.push({
            type: 'column-header',
            id: columnKey,
            label: `Column ${columnIndex + 1}`,
            count: children.length,
            depth: depth + 1,
            columnLayoutId: comp.id,
            columnIndex,
          });

          if (collapsedGroups.has(columnKey) && !query) return;
          const childIndexMap = indexMap(column.components || []);
          for (const child of [...children].reverse()) {
            pushComponent(
              child,
              zoneKey,
              childIndexMap.get(child.id) ?? 0,
              depth + 2,
              pageId,
              groupId,
              groupType,
              comp.id,
              columnIndex
            );
          }
        });
      }

      if (comp.type === 'repeater') {
        const isOpen = !collapsedGroups.has(`component-${comp.id}`) || Boolean(query);
        if (!isOpen) return;

        const children = comp.children.filter(hasMatchingDescendant);
        const childIndexMap = indexMap(comp.children);
        for (const child of [...children].reverse()) {
          pushComponent(
            child,
            zoneKey,
            childIndexMap.get(child.id) ?? 0,
            depth + 1,
            pageId,
            groupId,
            groupType
          );
        }
      }
    };

    // 1. Header
    const headerComps = schema.zones.header.components.filter(hasMatchingDescendant);
    const isHeaderGlobal = schema.zones.header.repeatOnEveryPage;
    if (!query || headerComps.length > 0) {
      items.push({
        type: 'zone-header',
        zoneKey: 'header',
        label: isHeaderGlobal ? 'Global Header' : 'Report Header',
        count: headerComps.length,
      });
      if ((!collapsedGroups.has('header') || query) && headerComps.length > 0) {
        const idxMap = indexMap(schema.zones.header.components);
        const reversed = [...headerComps].reverse();
        for (const comp of reversed) {
          pushComponent(comp, 'header', idxMap.get(comp.id) ?? 0, 0);
        }
      }
    }

    // 2. Groups (Headers)
    for (const group of schema.groups || []) {
      const gHeaderKey = `group-${group.id}-header`;
      const gHeaderComps = group.header.components.filter(hasMatchingDescendant);
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
          const idxMap = indexMap(group.header.components);
          const reversed = [...gHeaderComps].reverse();
          for (const comp of reversed) {
            pushComponent(
              comp,
              'header',
              idxMap.get(comp.id) ?? 0,
              0,
              undefined,
              group.id,
              'header'
            );
          }
        }
      }
    }

    // 3. Pages (Detail Band)
    for (let pIdx = 0; pIdx < schema.pages.length; pIdx++) {
      const page = schema.pages[pIdx];
      const bodyComps = page.body.components.filter(hasMatchingDescendant);

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
          const idxMap = indexMap(page.body.components);
          const reversed = [...bodyComps].reverse();
          for (const comp of reversed) {
            pushComponent(comp, 'body', idxMap.get(comp.id) ?? 0, 0, page.id);
          }
        }
      }
    }

    // 4. Groups (Footers)
    const groups = schema.groups || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const group = groups[i];
      const gFooterKey = `group-${group.id}-footer`;
      const gFooterComps = group.footer.components.filter(hasMatchingDescendant);
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
          const idxMap = indexMap(group.footer.components);
          const reversed = [...gFooterComps].reverse();
          for (const comp of reversed) {
            pushComponent(
              comp,
              'footer',
              idxMap.get(comp.id) ?? 0,
              0,
              undefined,
              group.id,
              'footer'
            );
          }
        }
      }
    }

    // 5. Footer
    const footerComps = schema.zones.footer.components.filter(hasMatchingDescendant);
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
        const idxMap = indexMap(schema.zones.footer.components);
        const reversed = [...footerComps].reverse();
        for (const comp of reversed) {
          pushComponent(comp, 'footer', idxMap.get(comp.id) ?? 0, 0);
        }
      }
    }

    return items;
  }, [schema, collapsedGroups, query]);
}

// --- Main Component ---

export const LayersPanel = memo(function LayersPanel() {
  const moveComponent = useDesignerStore((state) => state.moveComponent);
  const moveComponentToColumn = useDesignerStore((state) => state.moveComponentToColumn);
  const groupSelectedElements = useDesignerStore((state) => state.groupSelectedElements);
  const selectedComponentIds = useDesignerStore((state) => state.selectedComponentIds);
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
      if (item.type === 'page-separator') return 28;
      if (item.type === 'global-separator') return 30;
      if (item.type === 'zone-header') return 31;
      if (item.type === 'column-header') return 26;
      return 31; // Component
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
        if (destData.type === 'layer-item' && destData.parentColumnLayoutId) {
          const edge = extractClosestEdge(destData);
          newIndex = edge === 'bottom' ? destData.index : destData.index + 1;
          moveComponentToColumn(
            sourceData.id,
            destData.parentColumnLayoutId,
            destData.parentColumnIndex,
            newIndex
          );
          return;
        }

        if (destData.type === 'column-header') {
          moveComponentToColumn(sourceData.id, destData.columnLayoutId, destData.columnIndex, -1);
          return;
        }

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
  }, [moveComponent, moveComponentToColumn]);

  return (
    <BasePanel>
      <PanelHeader
        title="Layers"
        icon={Layers}
        actions={
          <div className="flex items-center gap-1">
            {selectedComponentIds.length > 1 && (
              <button
                type="button"
                onClick={groupSelectedElements}
                className="p-1 hover:bg-[var(--bg-hover)] rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
                title="Group selected layers"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Group</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                useDesignerStore.getState().showDialog({
                  title: 'Add Data Group',
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
              title="Add data group band"
            >
              <span className="text-[11px] font-medium">+ Data</span>
            </button>
          </div>
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
                    <button
                      type="button"
                      className="w-full h-full px-3 flex items-center gap-2 cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors group/page"
                      onClick={() => {
                        useDesignerStore.getState().setActivePage(item.pageId);
                        useDesignerStore.getState().setScrollToPageId(item.pageId);
                      }}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] transition-colors">
                        Page {item.index + 1}
                      </span>
                      <div className="h-px flex-1 bg-[var(--border-default)]" />
                    </button>
                  )}

                  {item.type === 'global-separator' && (
                    <div className="h-full px-3 flex items-center gap-2 text-[var(--accent)]">
                      <Globe className="w-3 h-3 shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em]">
                        {item.label}
                      </span>
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

                  {item.type === 'column-header' && (
                    <ColumnHeader
                      item={item}
                      collapsedGroups={collapsedGroups}
                      toggleGroup={toggleGroup}
                    />
                  )}

                  {item.type === 'component' && (
                    <LayerItem
                      component={item.component}
                      zoneKey={item.zoneKey}
                      index={item.index}
                      pageId={item.pageId}
                      depth={item.depth}
                      parentColumnLayoutId={item.parentColumnLayoutId}
                      parentColumnIndex={item.parentColumnIndex}
                      collapsedGroups={collapsedGroups}
                      toggleGroup={toggleGroup}
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

// --- Helper Components ---

const ColumnHeader = memo(
  ({
    item,
    collapsedGroups,
    toggleGroup,
  }: {
    item: Extract<RenderItem, { type: 'column-header' }>;
    collapsedGroups: Set<string>;
    toggleGroup: (key: string) => void;
  }) => {
    const ref = useRef<HTMLButtonElement>(null);
    const [isDraggedOver, setIsDraggedOver] = useState(false);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      return dropTargetForElements({
        element: el,
        getData: () => ({
          type: 'column-header',
          columnLayoutId: item.columnLayoutId,
          columnIndex: item.columnIndex,
        }),
        onDragEnter: () => setIsDraggedOver(true),
        onDragLeave: () => setIsDraggedOver(false),
        onDrop: () => setIsDraggedOver(false),
      });
    }, [item.columnIndex, item.columnLayoutId]);

    const isOpen = !collapsedGroups.has(item.id);

    return (
      <button
        type="button"
        ref={ref}
        className={clsx(
          'w-full h-full flex items-center gap-2 pr-3 cursor-pointer transition-colors',
          'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
          isDraggedOver && 'bg-[var(--accent)]/10 text-[var(--accent)]'
        )}
        style={{ paddingLeft: `${getColumnHeaderIndent(item.depth)}px` }}
        onClick={() => toggleGroup(item.id)}
      >
        <ChevronRight
          className={clsx('w-3 h-3 transition-transform duration-200', isOpen && 'rotate-90')}
        />
        <div className="h-px w-8 bg-[var(--border-default)]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] truncate">
          {item.label}
        </span>
        <div className="h-px flex-1 bg-[var(--border-default)]" />
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-black/5 text-[9px] font-bold flex items-center justify-center">
          {item.count}
        </span>
      </button>
    );
  }
);

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

    const sectionIcon = item.groupId
      ? item.groupType === 'header'
        ? 'lucide:braces'
        : 'lucide:corner-down-left'
      : item.zoneKey === 'header'
        ? 'lucide:panel-top'
        : item.zoneKey === 'footer'
          ? 'lucide:panel-bottom'
          : 'lucide:rows-3';
    const sectionKey = item.groupId ? `group-${item.groupId}-${item.groupType}` : zoneId;
    const isOpen = !collapsedGroups.has(sectionKey);

    return (
      <div
        ref={ref}
        className={clsx(
          'w-full h-full flex items-center gap-2 px-3 transition-all cursor-pointer group border-y border-transparent',
          isSelected
            ? 'bg-white/[0.055] text-[var(--accent)] border-white/5'
            : 'bg-white/[0.018] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.035]',
          isDraggedOver && 'bg-[var(--accent)]/10 border-[var(--accent)]/20'
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
            toggleGroup(sectionKey);
          }}
          className="h-5 w-5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all shrink-0"
        >
          <ChevronRight
            className={clsx('w-3 h-3 transition-transform duration-200', isOpen && 'rotate-90')}
          />
        </button>

        <div className="w-5 flex items-center justify-center shrink-0">
          <Icon
            icon={sectionIcon}
            className={clsx(
              'w-4 h-4 shrink-0 transition-colors',
              isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
            )}
          />
        </div>

        <span className="text-[12px] font-semibold flex-1 truncate opacity-90 group-hover:opacity-100 transition-opacity">
          {item.label}
        </span>

        <div className="h-px w-8 bg-[var(--border-default)] opacity-70" />

        {(item.zoneKey === 'header' || item.zoneKey === 'footer') && !item.groupId && (
          <button
            type="button"
            title={repeatOnEveryPage ? 'Global (Repeats on every page)' : 'Not Global (Static)'}
            onClick={(e) => {
              e.stopPropagation();
              updateZone(item.zoneKey, { repeatOnEveryPage: !repeatOnEveryPage });
            }}
            className={clsx(
              'h-6 w-6 flex items-center justify-center rounded-md transition-colors',
              repeatOnEveryPage
                ? 'text-[var(--accent)] bg-[var(--accent-glow)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
            )}
          >
            <Globe className="w-3 h-3" />
          </button>
        )}

        <div className="flex items-center justify-center min-w-[18px] h-[18px] text-[9px] bg-black/5 text-[var(--text-muted)] px-1 rounded-full font-bold">
          {item.count}
        </div>
      </div>
    );
  }
);
