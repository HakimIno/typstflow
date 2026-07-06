'use client';

import { useAutoFitHeight } from '@/hooks/use-auto-fit-height';
import { useFormBoxDropTarget } from '@/hooks/use-form-box-drop-target';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { cn } from '@/lib/utils/cn';
import { findComponentZone } from '@/lib/utils/schema-mutators';
import { parseTypstUnit } from '@/lib/utils/units';
import { useDesignerStore } from '@/store/designer-store';
import type { FormBoxComponent } from '@/types/schema';
import { useRef } from 'react';
import { ComponentWrapper } from '../../component-wrapper/ComponentWrapper';

interface Props {
  component: FormBoxComponent;
  pageIndex?: number;
  totalPages?: number;
}

export function FormBoxPreview({ component, pageIndex }: Props) {
  const schema = useDesignerStore((s) => s.schema);
  const { isDraggedOver, ref: dropRef } = useFormBoxDropTarget(component.id);
  const boxRef = useRef<HTMLDivElement>(null);
  useAutoFitHeight(boxRef, component.id);
  const setRefs = (el: HTMLDivElement | null) => {
    boxRef.current = el;
    dropRef(el);
  };

  const zoneInfo = findComponentZone(schema, component.id);
  const zoneKey = zoneInfo?.zoneKey || 'body';
  const pageId = zoneInfo?.pageId;

  const strokeColor = component.strokeColor ?? '#64748b';
  const strokeWidth = component.strokeWidth ?? '0.1mm';
  const inset = component.inset ?? '2mm';
  const fill = component.fill ?? '#ffffff';
  const innerGap = component.innerGap ?? '2mm';
  const radius = component.radius
    ? LayoutEngine.mmToPx(parseTypstUnit(component.radius))
    : undefined;

  const children = component.components ?? [];

  return (
    <div
      ref={setRefs}
      className={cn(
        'w-full min-h-[60px] box-border transition-all',
        isDraggedOver && 'ring-2 ring-[var(--accent)] ring-inset'
      )}
      style={{
        backgroundColor: fill,
        border: `${strokeWidth === '0' || strokeWidth === '0pt' ? 0 : 1}px solid ${strokeColor}`,
        borderRadius: radius,
        padding: LayoutEngine.mmToPx(parseTypstUnit(inset)),
        display: 'flex',
        flexDirection: 'column',
        gap: LayoutEngine.mmToPx(parseTypstUnit(innerGap)),
      }}
    >
      {children.map((child) => (
        <ComponentWrapper
          key={child.id}
          componentId={child.id}
          zoneKey={zoneKey}
          pageId={pageId}
          pageIndex={pageIndex}
          flowMode={true}
          isNested={true}
        />
      ))}

      {children.length === 0 && !isDraggedOver && (
        <div className="flex-1 flex items-center justify-center border border-dashed border-slate-700/40 min-h-[40px] select-none pointer-events-none">
          <span className="text-[8px] uppercase font-bold tracking-wider text-slate-400">
            Drop components here
          </span>
        </div>
      )}
    </div>
  );
}
