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
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Lock,
  QrCode,
  Square,
  Table,
  Type,
  Unlock,
} from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { DesignerInput } from '../shared/DesignerInput';

const ComponentIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'text':
      return <Type className="w-3.5 h-3.5" />;
    case 'image':
      return <ImageIcon className="w-3.5 h-3.5" />;
    case 'table':
      return <Table className="w-3.5 h-3.5" />;
    case 'rect':
    case 'circle':
      return <Square className="w-3.5 h-3.5" />;
    case 'qrcode':
      return <QrCode className="w-3.5 h-3.5" />;
    default:
      return <Layers className="w-3.5 h-3.5" />;
  }
};

const LayerItem = memo(
  ({
    component,
    zoneKey,
    index,
    pageId,
  }: {
    component: ComponentNode;
    zoneKey: 'header' | 'body' | 'footer';
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
          'w-full group relative flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all duration-200 border-y-0 border-r-0 border-l-2',
          isSelected
            ? 'bg-blue-500/10 border-blue-500 text-blue-500'
            : 'border-transparent text-slate-400 hover:bg-slate-50/50 hover:text-slate-200',
          isDragging && 'opacity-40 grayscale'
        )}
        onClick={() => selectComponent(component.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            selectComponent(component.id);
          }
        }}
        // biome-ignore lint/a11y/useSemanticElements: Nested buttons are illegal in HTML
        role="button"
        tabIndex={0}
      >
        {/* Drop Indicator */}
        {closestEdge === 'top' && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-10" />
        )}
        {closestEdge === 'bottom' && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-10" />
        )}

        <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />

        <div
          className={clsx(
            'p-1 rounded-md shrink-0',
            isSelected ? 'bg-blue-500/20' : 'bg-slate-100/10'
          )}
        >
          <ComponentIcon type={component.type} />
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          {isEditing ? (
            <DesignerInput
              autoFocus
              variant="ghost"
              className="text-[11.5px] font-medium p-0"
              value={name}
              onChange={(v) => setName(v)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
          ) : (
            <span
              className="block text-[11.5px] font-medium truncate"
              onDoubleClick={() => setIsEditing(true)}
            >
              {component.name || (component.type === 'text' ? component.content : component.type)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleVisibility(component.id);
            }}
            className={clsx(
              'p-1 hover:bg-slate-800 rounded',
              isHidden && 'text-blue-500 opacity-100'
            )}
            title={isHidden ? 'Show' : 'Hide'}
          >
            {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleLock(component.id);
            }}
            className={clsx(
              'p-1 hover:bg-slate-800 rounded',
              isLocked && 'text-orange-500 opacity-100'
            )}
            title={isLocked ? 'Unlock' : 'Lock'}
          >
            {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </button>
        </div>
      </div>
    );
  }
);

const ZoneGroup = ({
  zoneKey,
  label,
  components,
  pageId,
}: {
  zoneKey: 'header' | 'body' | 'footer';
  label: string;
  components: ComponentNode[];
  pageId?: string;
}) => {
  const [isOpen, setIsOpen] = useState(true);

  if (components.length === 0) return null;

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {label}
        <span className="ml-auto text-[9px] bg-slate-100 px-1.5 rounded-full lowercase font-medium">
          {components.length}
        </span>
      </button>

      {isOpen && (
        <div className="space-y-px">
          {/* Note: Components are rendered bottom-to-top in canvas, so we reverse for layer list (top-to-bottom) */}
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
};

export const LayersPanel = memo(function LayersPanel() {
  const schema = useDesignerStore((state) => state.schema);
  const moveComponent = useDesignerStore((state) => state.moveComponent);

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

        // Calculate new index
        // Since the list is reversed, dropping on 'top' means we want it to be ABOVE (higher index)
        // actually, pragmatic DnD with closestEdge is simpler.
        let newIndex = destData.index;
        if (edge === 'bottom') {
          // In a reversed list, 'bottom' means lower index
          newIndex = Math.max(0, destData.index - 0); // No, let's think.
        }

        // Let's use a simpler logic for the reversed list:
        // List: [Top (idx 2), Middle (idx 1), Bottom (idx 0)]
        // If I drag Top to Bottom's 'bottom' edge, it should become idx 0.
        // If I drag Bottom to Top's 'top' edge, it should become idx 2.

        if (edge === 'bottom') {
          // Drop below the item in the list
          // If dragging from above to below, newIndex is just destData.index
          // If dragging from below to above, newIndex is destData.index
          newIndex = destData.index;
        } else {
          // Drop above the item in the list
          newIndex = destData.index + 1;
          // If it was originally before this, adjust? No, moveComponent handles the filter.
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
        <ZoneGroup
          zoneKey="header"
          label="Report Header (Global)"
          components={schema.zones.header.components}
        />

        {schema.pages.map((page, idx) => (
          <div key={page.id} className="mt-4 first:mt-0">
            <div className="px-3 py-1 flex items-center gap-2 bg-slate-100/30">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Page {idx + 1}
              </span>
            </div>
            <ZoneGroup
              zoneKey="body"
              label="Detail Band"
              components={page.body.components}
              pageId={page.id}
            />
          </div>
        ))}

        <div className="mt-4">
          <ZoneGroup
            zoneKey="footer"
            label="Page Footer (Global)"
            components={schema.zones.footer.components}
          />
        </div>

        {Object.values(schema.zones).every((z) => z.components.length === 0) &&
          schema.pages.every((p) => p.body.components.length === 0) && (
          <div className="flex flex-col items-center justify-center h-48 px-8 text-center">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-widget)] flex items-center justify-center mb-3">
              <Layers className="w-5 h-5 text-[var(--text-muted)]" />
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">
              No layers yet. Add components from the palette.
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
