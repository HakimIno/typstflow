'use client';

import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { useDesignerStore } from '@/store/designer-store';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronUp,
} from 'lucide-react';
import { memo } from 'react';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarSeparator } from './ToolbarSeparator';

export const AlignmentTools = memo(function AlignmentTools() {
  const selectedComponentIds = useDesignerStore((state) => state.selectedComponentIds);
  const schema = useDesignerStore((state) => state.schema);
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const bringToFront = useDesignerStore((state) => state.bringToFront);
  const sendToBack = useDesignerStore((state) => state.sendToBack);
  const moveUp = useDesignerStore((state) => state.moveUp);
  const moveDown = useDesignerStore((state) => state.moveDown);

  const handleAlign = (
    type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'dist-h' | 'dist-v'
  ) => {
    if (selectedComponentIds.length === 0) return;

    const { zones } = schema;
    const selectedComponents = selectedComponentIds
      .map((id) => {
        for (const zone of Object.values(zones)) {
          const found = zone.components.find((c) => c.id === id);
          if (found) return found;
        }
        return null;
      })
      .filter(Boolean) as any[];

    if (selectedComponents.length === 0) return;

    // Calculate Bounds
    const minX = Math.min(...selectedComponents.map((c) => c.x || 0));
    const maxX = Math.max(...selectedComponents.map((c) => (c.x || 0) + (c.width || 0)));
    const minY = Math.min(...selectedComponents.map((c) => c.y || 0));
    const maxY = Math.max(...selectedComponents.map((c) => (c.y || 0) + (c.height || 0)));

    const selectionWidth = maxX - minX;
    const selectionHeight = maxY - minY;

    const { width: pageWidth } = getPaperDimensions(schema.page.size, schema.page.orientation);
    const contentWidth = pageWidth - 30; // Approx margin

    const isMultiSelect = selectedComponents.length > 1;

    for (const comp of selectedComponents) {
      const updates: any = {};

      switch (type) {
        case 'left':
          updates.x = isMultiSelect ? minX : 0;
          break;
        case 'center':
          updates.x = isMultiSelect
            ? minX + selectionWidth / 2 - (comp.width || 0) / 2
            : contentWidth / 2 - (comp.width || 0) / 2;
          break;
        case 'right':
          updates.x = isMultiSelect ? maxX - (comp.width || 0) : contentWidth - (comp.width || 0);
          break;
        case 'top':
          updates.y = isMultiSelect ? minY : 0;
          break;
        case 'middle':
          updates.y = isMultiSelect ? minY + selectionHeight / 2 - (comp.height || 0) / 2 : 0;
          break;
        case 'bottom':
          updates.y = isMultiSelect ? maxY - (comp.height || 0) : 0;
          break;
      }

      if (Object.keys(updates).length > 0) {
        updateComponent(comp.id, updates);
      }
    }

    if (isMultiSelect) {
      if (type === 'dist-h') {
        const sorted = [...selectedComponents].sort((a, b) => (a.x || 0) - (b.x || 0));
        const totalCompsWidth = sorted.reduce((sum, c) => sum + (c.width || 0), 0);
        const gap = (selectionWidth - totalCompsWidth) / (sorted.length - 1);
        let currentX = minX;
        for (const comp of sorted) {
          updateComponent(comp.id, { x: currentX });
          currentX += (comp.width || 0) + gap;
        }
      } else if (type === 'dist-v') {
        const sorted = [...selectedComponents].sort((a, b) => (a.y || 0) - (b.y || 0));
        const totalCompsHeight = sorted.reduce((sum, c) => sum + (c.height || 0), 0);
        const gap = (selectionHeight - totalCompsHeight) / (sorted.length - 1);
        let currentY = minY;
        for (const comp of sorted) {
          updateComponent(comp.id, { y: currentY });
          currentY += (comp.height || 0) + gap;
        }
      }
    }
  };

  const hasSelection = selectedComponentIds.length > 0;
  const isSingleSelect = selectedComponentIds.length === 1;

  return (
    <div className="flex items-center">
      {/* Group: Arrangement */}
      <div className="flex items-center gap-0.5 px-0.5">
        <ToolbarButton
          icon={ChevronLast}
          onClick={() => bringToFront(selectedComponentIds[0])}
          disabled={!isSingleSelect}
          variant="toolbar-item"
          title="Bring to Front"
          size="icon"
        />
        <ToolbarButton
          icon={ChevronUp}
          onClick={() => moveUp(selectedComponentIds[0])}
          disabled={!isSingleSelect}
          variant="toolbar-item"
          title="Bring Forward"
          size="icon"
        />
        <ToolbarButton
          icon={ChevronDown}
          onClick={() => moveDown(selectedComponentIds[0])}
          disabled={!isSingleSelect}
          variant="toolbar-item"
          title="Send Backward"
          size="icon"
        />
        <ToolbarButton
          icon={ChevronFirst}
          onClick={() => sendToBack(selectedComponentIds[0])}
          disabled={!isSingleSelect}
          variant="toolbar-item"
          title="Send to Back"
          size="icon"
        />
      </div>

      <ToolbarSeparator />

      {/* Group: Horizontal */}
      <div className="flex items-center gap-0.5 px-0.5">
        <ToolbarButton
          icon={AlignStartHorizontal}
          onClick={() => handleAlign('left')}
          disabled={!hasSelection}
          variant="toolbar-item"
          title="Align Left"
          size="icon"
        />
        <ToolbarButton
          icon={AlignCenterHorizontal}
          onClick={() => handleAlign('center')}
          disabled={!hasSelection}
          variant="toolbar-item"
          title="Align Center"
          size="icon"
        />
        <ToolbarButton
          icon={AlignEndHorizontal}
          onClick={() => handleAlign('right')}
          disabled={!hasSelection}
          variant="toolbar-item"
          title="Align Right"
          size="icon"
        />
      </div>

      <ToolbarSeparator />

      {/* Group: Vertical */}
      <div className="flex items-center gap-0.5 px-0.5">
        <ToolbarButton
          icon={AlignStartVertical}
          onClick={() => handleAlign('top')}
          disabled={!hasSelection}
          variant="toolbar-item"
          title="Align Top"
          size="icon"
        />
        <ToolbarButton
          icon={AlignCenterVertical}
          onClick={() => handleAlign('middle')}
          disabled={!hasSelection}
          variant="toolbar-item"
          title="Align Middle"
          size="icon"
        />
        <ToolbarButton
          icon={AlignEndVertical}
          onClick={() => handleAlign('bottom')}
          disabled={!hasSelection}
          variant="toolbar-item"
          title="Align Bottom"
          size="icon"
        />
      </div>

      <ToolbarSeparator />

      {/* Group: Distribute */}
      <div className="flex items-center gap-0.5 px-0.5">
        <ToolbarButton
          icon={AlignHorizontalDistributeCenter}
          onClick={() => handleAlign('dist-h')}
          disabled={selectedComponentIds.length < 3}
          variant="toolbar-item"
          title="Distribute Horizontally"
          size="icon"
        />
        <ToolbarButton
          icon={AlignVerticalDistributeCenter}
          onClick={() => handleAlign('dist-v')}
          disabled={selectedComponentIds.length < 3}
          variant="toolbar-item"
          title="Distribute Vertically"
          size="icon"
        />
      </div>
    </div>
  );
});
