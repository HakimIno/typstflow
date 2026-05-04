import { resolveBindings } from '@/lib/utils/json-path';
import type { ComponentNode } from '@/types/schema';
import { memo } from 'react';

interface BarcodePreviewProps {
  component: ComponentNode;
  sampleData: any;
}

export const BarcodePreview = memo(function BarcodePreview({
  component,
  sampleData,
}: BarcodePreviewProps) {
  return (
    <div className="w-full h-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
      <div className="text-center p-2">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
          {component.type}
        </div>
        <div className="text-[8px] text-slate-400 font-mono truncate max-w-[150px]">
          {resolveBindings((component as any).value || '', sampleData)}
        </div>
      </div>
    </div>
  );
});
