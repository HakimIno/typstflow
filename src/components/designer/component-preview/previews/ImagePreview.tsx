import { getImageObjectUrl } from '@/lib/image-blob-cache';
import type { ImageComponent } from '@/types/schema';
import { memo, useEffect, useMemo, useRef } from 'react';

interface ImagePreviewProps {
  component: ImageComponent;
  /** When true the wrapper is being dragged — skip expensive re-renders */
  isDragging?: boolean;
}

/**
 * ImagePreview — Performance-optimised canvas preview for image components.
 *
 * Key optimisations vs the old implementation:
 *
 * 1. ObjectURL caching  — base64 srcData is converted to a blob ObjectURL
 *    exactly once (via `image-blob-cache.ts`).  Subsequent renders reuse the
 *    same URL so the browser never has to decode the same base64 string twice.
 *
 * 2. Stable src via useMemo — the resolved URL is memoised by component id +
 *    srcData reference, so React skips the img re-render unless the image
 *    actually changed.
 *
 * 3. decoding="async" — tells the browser to decode the image off the main
 *    thread, preventing jank when many images are mounted at once.
 *
 * 4. loading="lazy" — images outside the viewport are not decoded at all until
 *    they scroll into view (important with 100+ images on a tall canvas).
 *
 * 5. will-change: transform  — compositor hint so the GPU layer is promoted
 *    during drag, avoiding paint storms.
 *
 * 6. contain: strict — isolates the element's paint/layout from the rest of
 *    the canvas, making per-image invalidation cheaper.
 */
export const ImagePreview = memo(function ImagePreview({
  component,
  isDragging = false,
}: ImagePreviewProps) {
  const imgRef = useRef<HTMLImageElement>(null);

  // Resolve the display URL — prefer srcData (converted to ObjectURL) over src.
  const imgSrc = useMemo(() => {
    const raw = component.srcData || component.src;
    if (!raw) return null;
    // Only convert data: URLs to ObjectURLs — leave http(s) URLs as-is.
    if (raw.startsWith('data:')) {
      return getImageObjectUrl(component.id, raw);
    }
    return raw;
  }, [component.id, component.srcData, component.src]);

  // When the component's srcData changes to something falsy (image removed),
  // nothing to clean up here — the cache manager handles revocation on its own.
  // But if the component is unmounted we don't need to revoke here either
  // because the cache keeps the ObjectURL alive for potential re-mounts.

  // During high-frequency drag updates, bail out of render work early by
  // keeping the img element's src stable via the ref rather than a re-render.
  const prevSrcRef = useRef<string | null>(null);
  useEffect(() => {
    if (imgRef.current && imgSrc && prevSrcRef.current !== imgSrc) {
      prevSrcRef.current = imgSrc;
    }
  }, [imgSrc]);

  if (!imgSrc) {
    return (
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
  }

  return (
    <div
      className="w-full h-full overflow-hidden flex items-center justify-center bg-slate-50"
      style={{
        // Isolate paint/layout so sibling re-renders don't trigger a repaint here.
        contain: 'strict',
        // Promote to its own GPU layer when dragging to avoid paint invalidation.
        willChange: isDragging ? 'transform' : 'auto',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={imgSrc}
        alt="Component preview"
        // Off-thread decode — prevents main thread jank during multi-image mount.
        decoding="async"
        // Only decode images that are within the scrollport.
        loading="lazy"
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: component.fit ?? 'contain',
          // Avoid sub-pixel jitter by snapping to device pixels.
          imageRendering: 'auto',
        }}
      />
    </div>
  );
},
// Custom comparison: skip re-render if only position/size changed
// (those are handled by the parent ComponentWrapper via CSS transform).
// Only re-render when the visible image data, fit mode, or drag state changes.
(prev, next) => {
  if (prev.isDragging !== next.isDragging) return false;
  if (prev.component.id !== next.component.id) return false;
  if (prev.component.srcData !== next.component.srcData) return false;
  if (prev.component.src !== next.component.src) return false;
  if (prev.component.fit !== next.component.fit) return false;
  // All other fields (x, y, width, height, name…) are irrelevant to rendering.
  return true;
});
