'use client';

import { findComponentZone } from '@/lib/utils/schema-mutators';
import { cn } from '@/lib/utils/cn';
import { useDesignerStore } from '@/store/designer-store';
import type { FormBoxComponent } from '@/types/schema';
import { ComponentWrapper } from '../../component-wrapper/ComponentWrapper';
import { useFormBoxDropTarget } from '@/hooks/use-form-box-drop-target';

interface Props {
  component: FormBoxComponent;
  pageIndex?: number;
  totalPages?: number;
}

export function FormBoxPreview({ component, pageIndex }: Props) {
  const schema = useDesignerStore((s) => s.schema);
  const { isDraggedOver, ref } = useFormBoxDropTarget(component.id);

  const zoneInfo = findComponentZone(schema, component.id);
  const zoneKey = zoneInfo?.zoneKey || 'body';
  const pageId = zoneInfo?.pageId;

  const strokeColor = component.strokeColor ?? '#64748b';
  const strokeWidth = component.strokeWidth ?? '0.1mm';
  const inset = component.inset ?? '2mm';
  const fill = component.fill ?? '#ffffff';
  const innerGap = component.innerGap ?? '2mm';
  const radius = component.radius ? `calc(${component.radius} * 3.78)` : undefined;

  const children = component.components ?? [];

  return (
    <div
      ref={ref}
      className={cn(
        'w-full h-full min-h-[60px] box-border transition-all',
        isDraggedOver && 'ring-2 ring-[var(--accent)] ring-inset'
      )}
      style={{
        backgroundColor: fill,
        border: `${strokeWidth === '0' || strokeWidth === '0pt' ? 0 : 1}px solid ${strokeColor}`,
        borderRadius: radius,
        padding: `calc(${inset} * 3.78)`,
        display: 'flex',
        flexDirection: 'column',
        gap: `calc(${innerGap} * 3.78)`,
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
