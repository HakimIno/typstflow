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
import { clsx } from 'clsx';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
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
import { memo, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DesignerInput } from '../shared/DesignerInput';

const ComponentIcon = ({ type, isSelected }: { type: string; isSelected?: boolean }) => {
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
};

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

    const isSelected = useDesignerStore((state) =>
      state.selectedComponentIds.includes(component.id)
    );
    const isHidden = useDesignerStore((state) => state.hiddenComponentIds.includes(component.id));
    const isLocked = useDesignerStore((state) => state.lockedComponentIds.includes(component.id));

    const selectComponent = useDesignerStore((state) => state.selectComponent);
    const toggleVisibility = useDesignerStore((state) => state.toggleComponentVisibility);
    const toggleLock = useDesignerStore((state) => state.toggleComponentLock);
    const renameComponent = useDesignerStore((state) => state.renameComponent);
    const moveUp = useDesignerStore((state) => state.moveUp);
    const moveDown = useDesignerStore((state) => state.moveDown);

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
          'w-full group relative flex items-center gap-2 px-2 py-1 cursor-pointer transition-all duration-200 select-none border-l-2',
          isSelected
            ? 'bg-[var(--accent-glow)] border-[var(--accent)]'
            : 'border-transparent hover:bg-[var(--bg-widget)]',
          isDragging && 'opacity-40 grayscale',
          isHidden && 'opacity-50'
        )}
        onClick={() => selectComponent(component.id)}
        // biome-ignore lint/a11y/useSemanticElements: Nested buttons are illegal in HTML
        role="button"
        tabIndex={0}
      >
        {/* Drop Indicator */}
        {closestEdge === 'top' && (
          <div className="absolute top-0 left-1 right-1 h-0.5 bg-[var(--accent)] z-10 rounded-full" />
        )}
        {closestEdge === 'bottom' && (
          <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-[var(--accent)] z-10 rounded-full" />
        )}

        <div className="relative flex items-center gap-2 flex-1 min-w-0">
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
                  "block text-[11.5px] font-semibold truncate transition-colors",
                  isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
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
            title={isHidden ? 'Show' : 'Hide'}
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
            title={isLocked ? 'Unlock' : 'Lock'}
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
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }
);

const ZoneGroup = memo(
  ({
    zoneKey,
    label,
    pageId,
  }: {
    zoneKey: string;
    label: string;
    pageId?: string;
  }) => {
    const [isOpen, setIsOpen] = useState(true);
    const components = useDesignerStore(
      useShallow((state) => {
        if (zoneKey === 'body') {
          const page = pageId
            ? state.schema.pages.find((p) => p.id === pageId)
            : state.schema.pages[0];
          return page?.body.components ?? [];
        }
        return state.schema.zones[zoneKey as 'header' | 'footer'].components;
      })
    );

    if (components.length === 0) return null;

    return (
      <div className="mb-0.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all group"
        >
          <div className="p-0.5 rounded-sm bg-[var(--bg-widget)] group-hover:bg-[var(--bg-hover)] transition-colors">
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </div>
          {label}
          <div className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] text-[9px] bg-[var(--bg-widget)] text-[var(--text-muted)] px-1 rounded-full font-bold">
            {components.length}
          </div>
        </button>

        {isOpen && (
          <div className="space-y-px">
            {[...components].reverse().map((c, idx) => {
              const actualIndex = components.length - 1 - idx;
              return (
                <LayerItem
                  key={c.id}
                  component={c}
                  zoneKey={zoneKey}
                  index={actualIndex}
                  pageId={pageId}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

export const LayersPanel = memo(function LayersPanel() {
  const pageIds = useDesignerStore(useShallow((state) => state.schema.pages.map((p) => p.id)));
  const moveComponent = useDesignerStore((state) => state.moveComponent);
  const isEmpty = useDesignerStore(
    (state) =>
      Object.values(state.schema.zones).every((z) => z.components.length === 0) &&
      state.schema.pages.every((p) => p.body.components.length === 0)
  );

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
      <div className="p-3 flex items-center gap-2 border-b border-[var(--border-default)] bg-[var(--bg-widget)]">
        <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Layers
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <ZoneGroup zoneKey="header" label="Report Header (Global)" />

        {pageIds.map((pageId, idx) => (
          <div key={pageId} className="mt-0 first:mt-0">
            <div className="px-2 py-1 flex items-center gap-2 bg-[var(--bg-widget)] sticky top-0 z-10 backdrop-blur-md border-y border-[var(--border-subtle)]">
              <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">
                Page {idx + 1}
              </span>
              <div className="flex-1 h-px bg-[var(--border-subtle)]" />
            </div>
            <div className="py-0.5">
              <ZoneGroup zoneKey="body" label="Detail Band" pageId={pageId} />
            </div>
          </div>
        ))}

        <div className="mt-4">
          <ZoneGroup zoneKey="footer" label="Page Footer (Global)" />
        </div>

        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-64 px-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-widget)] flex items-center justify-center mb-4 shadow-sm border border-[var(--border-subtle)]">
              <Layers className="w-6 h-6 text-[var(--text-muted)] opacity-50" />
            </div>
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] mb-1">No Layers Found</h3>
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
              Start building your report by dragging components from the palette onto the canvas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
