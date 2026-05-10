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
  const value = resolveBindings((component as any).value || '', sampleData);

  return (
    <div className="w-full h-full bg-white border border-slate-200 flex flex-col items-center justify-center overflow-hidden p-2 shadow-sm rounded-sm">
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 min-h-0">
        {/* Fake Barcode Lines - Scalable */}
        <div className="flex flex-1 w-full items-stretch justify-center gap-[1px] min-h-0">
          {[1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 4, 1, 2, 1].map((w, i) => (
            <div
              key={i}
              className="bg-black"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest shrink-0">
          {component.type}
        </div>
        <div className="text-[8px] text-slate-400 font-mono truncate max-w-full shrink-0">
          {value || '0000000000000'}
        </div>
      </div>
    </div>
  );
});
