'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { renderReportToSvgStream } from '@/lib/typst-wasm';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { useDesignerStore } from '@/store/designer-store';
import { AlertTriangle } from 'lucide-react';
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CanvasRevealEffect } from '@/components/ui/canvas-reveal-effect';
import { Loading } from '../shared/Loading';

const ROW_GAP = 32;
const COL_GAP = 32;
const OVERSCAN = 2;

/**
 * Single page slide.
 * Outer div is sized at `naturalW * zoom × naturalH * zoom` for correct scroll/layout.
 * Inner div is natural size with CSS transform:scale(zoom) so the SVG content
 * scales visually without distortion — same technique as the original global transform,
 * but scoped per-page so the virtualizer can measure real layout dimensions.
 */
const PageSlide = memo(function PageSlide({
  svg,
  naturalWidth,
  naturalHeight,
  zoom,
}: {
  svg: string;
  naturalWidth: number;
  naturalHeight: number;
  zoom: number;
}) {
  return (
    <div
      className="relative bg-white shadow-xl overflow-hidden flex-shrink-0"
      style={{ width: naturalWidth * zoom, height: naturalHeight * zoom }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: naturalWidth,
          height: naturalHeight,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Needed for SVG preview
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
});

export const PreviewPane = memo(function PreviewPane() {
  const schema = useDesignerStore((state) => state.schema);
  const sampleData = useDesignerStore((state) => state.sampleData);
  const zoom = useDesignerStore((state) => state.zoom);
  const isDragging = useDesignerStore((state) => state.dragState.isDragging);
  const fontLoadedAt = useDesignerStore((state) => state.fontLoadedAt);
  const primaryColor = useDesignerStore((state) => state.primaryColor);
  const canvasLayout = useDesignerStore((state) => state.canvasLayout);

  const [svgContent, setSvgContent] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shouldShowLoading, setShouldShowLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgContent && !error) {
      const timer = setTimeout(() => setShouldShowLoading(true), 1000);
      return () => clearTimeout(timer);
    }
    setShouldShowLoading(false);
  }, [svgContent, error]);

  useEffect(() => {
    if (isDragging) return;
    let active = true;

    const performRender = async () => {
      try {
        setError(null);
        // Accumulate pages here so each chunk can extend the array correctly
        // even if React batches the setState calls.
        const accumulated: string[] = [];

        await renderReportToSvgStream(schema, sampleData, (chunkPages, startIdx) => {
          if (!active) return;
          for (let i = 0; i < chunkPages.length; i++) {
            accumulated[startIdx + i] = chunkPages[i];
          }
          // Snapshot so React sees a new array reference and schedules a render.
          setSvgContent([...accumulated]);
        });

        if (!active) return;
        // Final authoritative set — trims any sparse holes from old renders.
        setSvgContent(accumulated.filter(Boolean));
      } catch (err: any) {
        if (!active) return;
        console.error('Render error:', err);
        setError(err.message || 'Failed to render Typst');
      }
    };

    const timeoutId = setTimeout(performRender, 200);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [schema, sampleData, isDragging, fontLoadedAt]);

  const { width: pageWidthMm, height: pageHeightMm } = getPaperDimensions(
    schema.page.size,
    schema.page.orientation
  );

  // Natural (unzoomed) page size in px — used as the base for scaling.
  const naturalWidthPx = LayoutEngine.mmToPx(pageWidthMm);
  const naturalHeightPx = LayoutEngine.mmToPx(pageHeightMm);

  // Actual rendered size after zoom — used for outer container and virtualizer.
  const scaledWidthPx = naturalWidthPx * zoom;
  const scaledHeightPx = naturalHeightPx * zoom;

  const cols = canvasLayout === 'grid' ? 2 : 1;
  const pages = svgContent ?? [];
  const rowCount = Math.ceil(pages.length / cols);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => scaledHeightPx + ROW_GAP,
    overscan: OVERSCAN,
  });

  // When zoom or layout changes, reset TanStack Virtual's size cache so
  // row heights are re-estimated from the new scaledHeightPx value.
  useLayoutEffect(() => {
    virtualizer.measure();
    // virtualizer reference is stable; zoom/canvasLayout are the real triggers.
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  }, [zoom, canvasLayout]);

  const accentRgb = hexToRgb(primaryColor);
  const contentWidth = cols === 2 ? scaledWidthPx * 2 + COL_GAP : scaledWidthPx;

  return (
    <div className="flex-1 flex flex-col bg-slate-400/20 shadow-inner overflow-hidden relative">
      <div ref={scrollRef} className="flex-1 overflow-auto scrollbar-thin">
        <div className="p-8 pb-32">
          {pages.length > 0 ? (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: `${contentWidth}px`,
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((vRow) => {
                const startIdx = vRow.index * cols;
                const rowPages = pages.slice(startIdx, startIdx + cols);

                return (
                  <div
                    key={vRow.key}
                    style={{
                      position: 'absolute',
                      top: vRow.start,
                      left: 0,
                      width: '100%',
                      display: 'flex',
                      gap: `${COL_GAP}px`,
                    }}
                  >
                    {rowPages.map((svg, i) => (
                      <PageSlide
                        key={startIdx + i}
                        svg={svg}
                        naturalWidth={naturalWidthPx}
                        naturalHeight={naturalHeightPx}
                        zoom={zoom}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="relative overflow-hidden rounded-sm shadow-2xl"
              style={{ width: `${scaledWidthPx}px`, height: `${scaledHeightPx}px` }}
            >
              <div className="absolute inset-0 w-full h-full">
                <CanvasRevealEffect
                  animationSpeed={2.5}
                  containerClassName="bg-[#0a0a0f]"
                  colors={[
                    accentRgb,
                    [accentRgb[0] * 0.6, accentRgb[1] * 0.8, accentRgb[2] * 1.2],
                  ]}
                  dotSize={2}
                  showGradient={false}
                  isStatic={true}
                />
              </div>

              <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <div
                  className="absolute w-40 h-40 rounded-full opacity-20 blur-3xl"
                  style={{ backgroundColor: primaryColor }}
                />
                <div
                  className="relative flex flex-col items-center gap-4 p-4 rounded-2xl"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Loading message={'Compiling Report...'} />
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent z-[5]" />
            </div>
          )}
        </div>

        {error && (
          <div className="absolute inset-0 bg-red-50/90 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-300 z-50">
            <AlertTriangle className="w-12 h-12 text-red-600 mb-4" />
            <p className="text-sm font-bold text-red-800 mb-2">Build Error</p>
            <p className="text-[11px] text-red-600 font-mono bg-white p-4 border border-red-200 rounded-md shadow-sm max-w-md break-all">
              {error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

/** Convert hex color string to [R, G, B] array (0–255) */
function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return [139, 92, 246];
  const r = Number.parseInt(cleaned.substring(0, 2), 16);
  const g = Number.parseInt(cleaned.substring(2, 4), 16);
  const b = Number.parseInt(cleaned.substring(4, 6), 16);
  return [r, g, b];
}
