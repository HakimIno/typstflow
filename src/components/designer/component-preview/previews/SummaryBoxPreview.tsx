import { resolveBindings } from '@/lib/utils/json-path';
import type { ComponentNode } from '@/types/schema';
import { clsx } from 'clsx';
import { memo } from 'react';

interface SummaryBoxPreviewProps {
  component: ComponentNode;
  sampleData: any;
}

export const SummaryBoxPreview = memo(function SummaryBoxPreview({
  component,
  sampleData,
}: SummaryBoxPreviewProps) {
  return (
    <div className="w-full h-full p-2 bg-slate-50 border border-slate-200 rounded flex flex-col gap-1">
      {(component as any).rows?.map((row: any, i: number) => (
        <div
          key={i}
          className={clsx(
            'flex justify-between items-center text-[9px]',
            row.separator && 'border-t border-slate-200 mt-1 pt-1',
            row.style === 'total' && 'font-bold text-[11px] text-blue-600'
          )}
        >
          <span className="text-slate-500">{row.label}</span>
          <span className="font-medium">{resolveBindings(row.value, sampleData)}</span>
        </div>
      ))}
    </div>
  );
});
