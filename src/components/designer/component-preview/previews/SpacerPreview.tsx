import { memo } from 'react';
import type { ComponentNode } from '@/types/schema';

interface SpacerPreviewProps {
  component: ComponentNode;
}

export const SpacerPreview = memo(function SpacerPreview({ component }: SpacerPreviewProps) {
  return (
    <div className="bg-slate-50/50 border border-dashed border-slate-200 flex items-center justify-center text-[8px] font-bold uppercase tracking-tight text-slate-400 w-full h-full">
      Spacer ({(component as any).height}mm)
    </div>
  );
});
