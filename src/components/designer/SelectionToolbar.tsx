'use client';

import { useDesignerStore } from '@/store/designer-store';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { memo, useMemo } from 'react';
import { 
  AlignStartHorizontal, 
  AlignCenterHorizontal, 
  AlignEndHorizontal, 
  AlignStartVertical, 
  AlignCenterVertical, 
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  ChevronLast,
  ChevronFirst
} from 'lucide-react';
import { clsx } from 'clsx';

export const SelectionToolbar = memo(function SelectionToolbar() {
  const selectedComponentIds = useDesignerStore((state) => state.selectedComponentIds);
  const schema = useDesignerStore((state) => state.schema);
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const removeComponents = useDesignerStore((state) => state.removeComponents);
  const zoom = useDesignerStore((state) => state.zoom);
  const bringToFront = useDesignerStore((state) => state.bringToFront);
  const sendToBack = useDesignerStore((state) => state.sendToBack);
  const moveUp = useDesignerStore((state) => state.moveUp);
  const moveDown = useDesignerStore((state) => state.moveDown);

  const selectedComponents = useMemo(() => {
    if (selectedComponentIds.length <= 1) return [];
    
    const allComps: any[] = [];
    (Object.entries(schema.zones) as [any, any][]).forEach(([key, zone]) => {
      zone.components.forEach((c: any) => {
        if (selectedComponentIds.includes(c.id)) {
          // Calculate absolute Y
          const zoneOffset = LayoutEngine.calculateZoneOffset(key, schema);
          allComps.push({ ...c, absY: (c.y || 0) + zoneOffset });
        }
      });
    });
    return allComps;
  }, [selectedComponentIds, schema]);

  if (selectedComponents.length <= 1) return null;

  // Calculate Bounds in MM
  const minX = Math.min(...selectedComponents.map(c => c.x || 0));
  const maxX = Math.max(...selectedComponents.map(c => (c.x || 0) + (c.width || 0)));
  const minY = Math.min(...selectedComponents.map(c => c.absY || 0));
  const maxY = Math.max(...selectedComponents.map(c => (c.absY || 0) + (c.height || 0)));
  
  const selectionWidth = maxX - minX;
  const selectionHeight = maxY - minY;

  // Position the toolbar above the selection
  const toolbarTop = LayoutEngine.mmToPx(minY) - 45;
  const toolbarLeft = LayoutEngine.mmToPx(minX + selectionWidth / 2);

  const handleAlign = (type: string) => {
    selectedComponents.forEach(comp => {
      let updates: any = {};
      switch (type) {
        case 'left': updates.x = minX; break;
        case 'center': updates.x = minX + (selectionWidth / 2) - ((comp.width || 0) / 2); break;
        case 'right': updates.x = maxX - (comp.width || 0); break;
        case 'top': updates.y = comp.y - (comp.absY - minY); break;
        case 'middle': updates.y = comp.y + (minY + selectionHeight / 2 - (comp.absY + (comp.height || 0) / 2)); break;
        case 'bottom': updates.y = comp.y + (maxY - (comp.absY + (comp.height || 0))); break;
      }
      if (Object.keys(updates).length > 0) updateComponent(comp.id, updates);
    });

    if (type === 'dist-h') {
      const sorted = [...selectedComponents].sort((a, b) => (a.x || 0) - (b.x || 0));
      const totalCompsWidth = sorted.reduce((sum, c) => sum + (c.width || 0), 0);
      const gap = (selectionWidth - totalCompsWidth) / (sorted.length - 1);
      let currentX = minX;
      sorted.forEach(comp => {
        updateComponent(comp.id, { x: currentX });
        currentX += (comp.width || 0) + gap;
      });
    } else if (type === 'dist-v') {
      const sorted = [...selectedComponents].sort((a, b) => (a.absY || 0) - (b.absY || 0));
      const totalCompsHeight = sorted.reduce((sum, c) => sum + (c.height || 0), 0);
      const gap = (selectionHeight - totalCompsHeight) / (sorted.length - 1);
      let currentAbsY = minY;
      sorted.forEach(comp => {
        const diff = currentAbsY - comp.absY;
        updateComponent(comp.id, { y: (comp.y || 0) + diff });
        currentAbsY += (comp.height || 0) + gap;
      });
    }
  };

  return (
    <div 
      className="absolute z-[1000] flex items-center gap-1 bg-[var(--accent)] border border-[var(--border-accent)] rounded-lg p-1 shadow-2xl transition-all duration-200"
      style={{
        top: `${toolbarTop}px`,
        left: `${toolbarLeft}px`,
        transform: `translateX(-50%) scale(${1/zoom})`,
        transformOrigin: 'bottom center',
      }}
    >
      <div className="flex items-center gap-0.5 px-1 border-r border-white/20">
        <ActionButton icon={AlignStartHorizontal} title="Align Left" onClick={() => handleAlign('left')} />
        <ActionButton icon={AlignCenterHorizontal} title="Center Horizontally" onClick={() => handleAlign('center')} />
        <ActionButton icon={AlignEndHorizontal} title="Align Right" onClick={() => handleAlign('right')} />
      </div>
      
      <div className="flex items-center gap-0.5 px-1 border-r border-white/20">
        <ActionButton icon={AlignStartVertical} title="Align Top" onClick={() => handleAlign('top')} />
        <ActionButton icon={AlignCenterVertical} title="Center Vertically" onClick={() => handleAlign('middle')} />
        <ActionButton icon={AlignEndVertical} title="Align Bottom" onClick={() => handleAlign('bottom')} />
      </div>

      <div className="flex items-center gap-0.5 px-1 border-r border-white/20">
        <ActionButton icon={AlignHorizontalDistributeCenter} title="Distribute Horizontally" onClick={() => handleAlign('dist-h')} />
        <ActionButton icon={AlignVerticalDistributeCenter} title="Distribute Vertically" onClick={() => handleAlign('dist-v')} />
      </div>

      <div className="flex items-center gap-0.5 px-1 border-r border-white/20">
        <ActionButton icon={ChevronLast} title="Bring to Front" onClick={() => selectedComponentIds.forEach(id => bringToFront(id))} />
        <ActionButton icon={ChevronUp} title="Bring Forward" onClick={() => selectedComponentIds.forEach(id => moveUp(id))} />
        <ActionButton icon={ChevronDown} title="Send Backward" onClick={() => selectedComponentIds.forEach(id => moveDown(id))} />
        <ActionButton icon={ChevronFirst} title="Send to Back" onClick={() => selectedComponentIds.forEach(id => sendToBack(id))} />
      </div>

      <div className="flex items-center gap-0.5 px-1">
        <ActionButton icon={Trash2} title="Delete Selection" onClick={() => removeComponents(selectedComponentIds)} className="hover:bg-red-500" />
      </div>
    </div>
  );
});

function ActionButton({ icon: Icon, title, onClick, className }: any) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={clsx(
        "p-1.5 rounded-md hover:bg-white/20 text-white transition-colors duration-150",
        className
      )}
      title={title}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
