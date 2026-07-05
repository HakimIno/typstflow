'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { clsx } from 'clsx';
import { memo, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { PaletteDragPreview } from './PaletteDragPreview';
import type { PaletteItemProps } from './categories';
import { createDefaultComponent } from './component-templates';

export const PaletteItem = memo(function PaletteItem({
  type,
  label,
  icon: Icon,
}: PaletteItemProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return draggable({
      element: el,
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          // Anchor the pointer just inside the card's top-left corner so the
          // preview stays visually attached to the cursor (instead of floating away).
          getOffset: () => ({ x: 16, y: 14 }),
          render: ({ container }) => {
            const root = createRoot(container);
            flushSync(() => {
              root.render(<PaletteDragPreview icon={Icon} label={label} type={type} />);
            });
            return () => root.unmount();
          },
        });
      },
      getInitialData: () => {
        const _rect = el.getBoundingClientRect();
        const comp = createDefaultComponent(type);
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
  }, [Icon, label, type]);

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
