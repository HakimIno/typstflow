import type { ComponentNode } from '@/types/schema';
import { memo } from 'react';

interface ImagePreviewProps {
  component: ComponentNode;
}

export const ImagePreview = memo(function ImagePreview({ component }: ImagePreviewProps) {
  const imgSrc = (component as any).srcData || (component as any).src;

  return imgSrc ? (
    <div className="w-full h-full overflow-hidden flex items-center justify-center bg-slate-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc}
        alt="Component preview"
        style={{
          width: '100%',
          height: '100%',
          objectFit: (component as any).fit || 'contain',
        }}
        draggable={false}
      />
    </div>
  ) : (
    <div className="w-full h-full bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center gap-1">
      <svg
        className="w-6 h-6 text-slate-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        role="img"
      >
        <title>No image available</title>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <span className="text-[8px] text-slate-300 font-bold uppercase tracking-widest">
        No Image
      </span>
    </div>
  );
});
