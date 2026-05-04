import { memo } from 'react';
import type { ComponentNode } from '@/types/schema';

interface PageBreakPreviewProps {
  component: ComponentNode;
  pageIndex: number;
  totalPages: number;
}

export const PageBreakPreview = memo(function PageBreakPreview({
  component,
  pageIndex,
  totalPages,
}: PageBreakPreviewProps) {
  return (
    <div className="w-full py-4 flex items-center justify-center gap-4 relative">
      <div className="flex-1 h-[1px] bg-dashed border-t border-dashed border-blue-400 opacity-50" />
      <div className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-full flex items-center gap-2">
        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">
          Page Break
        </span>
        {(component as any).showPageNumber && (
          <span className="text-[9px] text-blue-400">
            Page {pageIndex + 1} / {totalPages}
          </span>
        )}
      </div>
      <div className="flex-1 h-[1px] bg-dashed border-t border-dashed border-blue-400 opacity-50" />
    </div>
  );
});
