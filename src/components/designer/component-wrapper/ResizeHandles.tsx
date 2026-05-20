import { clsx } from 'clsx';
import { memo } from 'react';

interface ResizeHandlesProps {
  onResizeStart: (e: React.MouseEvent, handle: string) => void;
}

const RESIZE_HANDLES = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export const ResizeHandles = memo(function ResizeHandles({ onResizeStart }: ResizeHandlesProps) {
  return (
    <>
      {RESIZE_HANDLES.map((handle) => (
        <div
          key={handle}
          data-resize-handle="true"
          onMouseDown={(e) => onResizeStart(e, handle)}
          className={clsx(
            'absolute size-2 rounded-full bg-white border border-[var(--accent)] z-50 shadow-sm',
            handle === 'top-left' &&
              'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
            handle === 'top-center' &&
              'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
            handle === 'top-right' &&
              'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
            handle === 'middle-left' &&
              'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
            handle === 'middle-right' &&
              'top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
            handle === 'bottom-left' &&
              'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
            handle === 'bottom-center' &&
              'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
            handle === 'bottom-right' &&
              'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'
          )}
        />
      ))}
    </>
  );
});
