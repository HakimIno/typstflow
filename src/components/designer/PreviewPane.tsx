'use client';

import { CanvasRevealEffect } from '@/components/ui/canvas-reveal-effect';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { PreviewSvgCache } from '@/lib/preview/preview-svg-cache';
import { renderReportToSvgStream } from '@/lib/typst-wasm';
import { computeStalePageIndices } from '@/lib/utils/preview-diff';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { useDesignerStore } from '@/store/designer-store';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertTriangle } from 'lucide-react';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Loading } from '../shared/Loading';
import { CanvasToolbar } from './CanvasToolbar';

const ROW_GAP_LIST = 32;
const ROW_GAP_GRID = 48;
const COL_GAP = 32;
const PADDING_TOP = 48;
const PADDING_SIDE = 64;
const OVERSCAN = 2;
const PARTIAL_DEBOUNCE_MS = 50;

const PageSlide = memo(function PageSlide({
  pageIndex,
  cacheVersion,
  cache,
  naturalWidth,
  naturalHeight,
  zoom,
}: {
  pageIndex: number;
  cacheVersion: number;
  cache: PreviewSvgCache;
  naturalWidth: number;
  naturalHeight: number;
  zoom: number;
}) {
  const blobUrl = cache.getBlobUrl(pageIndex);
  // cacheVersion ensures re-read when cache updates without storing SVG in React state.
  void cacheVersion;

  return (
    <div
      className="relative bg-white shadow-xl overflow-hidden flex-shrink-0"
      style={{ width: naturalWidth * zoom, height: naturalHeight * zoom }}
    >
      {blobUrl ? (
        <img
          src={blobUrl}
          alt=""
          draggable={false}
          className="absolute top-0 left-0 pointer-events-none select-none"
          style={{
            width: naturalWidth,
            height: naturalHeight,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        />
      ) : (
        <div
          className="absolute inset-0 bg-white/80 animate-pulse"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        />
      )}
    </div>
  );
});

export const PreviewPane = memo(function PreviewPane() {
  const schema = useDesignerStore((state) => state.schema);
  const sampleData = useDesignerStore((state) => state.sampleData);
  const activePageId = useDesignerStore((state) => state.activePageId);
  const zoom = useDesignerStore((state) => state.zoom);
  const isDragging = useDesignerStore((state) => state.dragState.isDragging);
  const fontLoadedAt = useDesignerStore((state) => state.fontLoadedAt);
  const primaryColor = useDesignerStore((state) => state.primaryColor);
  const canvasLayout = useDesignerStore((state) => state.canvasLayout);
  const scrollToPageId = useDesignerStore((state) => state.scrollToPageId);
  const setScrollToPageId = useDesignerStore((state) => state.setScrollToPageId);

  const pageIds = useMemo(() => schema.pages.map((p) => p.id), [schema.pages]);

  const svgCacheRef = useRef(new PreviewSvgCache());
  const prevSchemaRef = useRef(schema);
  const [cacheVersion, setCacheVersion] = useState(0);
  const [hasPages, setHasPages] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreviewPageIdx, setActivePreviewPageIdx] = useState(1);

  const scrollRef = useRef<HTMLDivElement>(null);

  const debounceMs = useMemo(() => {
    const n = schema.pages.length;
    if (n <= 10) return 200;
    if (n <= 100) return 500;
    if (n <= 500) return 1000;
    return 2000;
  }, [schema.pages.length]);

  const bumpCache = () => {
    setCacheVersion(svgCacheRef.current.version);
    setHasPages(svgCacheRef.current.pageCount > 0);
  };

  const runStream = async (
    pageIndices: number[] | undefined,
    kind: 'partial' | 'full',
    active: { current: boolean }
  ) => {
    await renderReportToSvgStream(
      schema,
      sampleData,
      (chunkPages, startIdx) => {
        if (!active.current) return;
        for (let i = 0; i < chunkPages.length; i++) {
          const svg = chunkPages[i];
          if (svg) svgCacheRef.current.setPage(startIdx + i, svg);
        }
        bumpCache();
      },
      { pageIndices, kind }
    );
  };

  // Fast incremental compile for changed / active pages.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fontLoadedAt is an intentional trigger
  useEffect(() => {
    if (isDragging) return;

    const stale = computeStalePageIndices(prevSchemaRef.current, schema, activePageId);
    prevSchemaRef.current = schema;

    if (stale.allPages || stale.indices.length === 0) return;

    let active = true;

    const timeoutId = setTimeout(async () => {
      try {
        setIsRendering(true);
        await runStream(stale.indices, 'partial', { current: active });
        if (active) setIsRendering(false);
      } catch (err: unknown) {
        if (!active) return;
        if ((err as Error).message === 'CANCELLED') return;
        console.error('Partial render error:', err);
      }
    }, PARTIAL_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [schema, sampleData, isDragging, activePageId, fontLoadedAt]);

  // Full compile after quiet period — authoritative for all pages.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fontLoadedAt is an intentional trigger
  useEffect(() => {
    if (isDragging) return;

    let active = true;

    const performFullRender = async () => {
      try {
        setError(null);
        setIsRendering(true);

        const accumulated: string[] = [];
        let rafHandle: number | null = null;

        const scheduleFlush = () => {
          if (rafHandle !== null) return;
          rafHandle = requestAnimationFrame(() => {
            rafHandle = null;
            if (!active) return;
            for (let i = 0; i < accumulated.length; i++) {
              const svg = accumulated[i];
              if (svg) svgCacheRef.current.setPage(i, svg);
            }
            bumpCache();
          });
        };

        await renderReportToSvgStream(
          schema,
          sampleData,
          (chunkPages, startIdx) => {
            if (!active) return;
            for (let i = 0; i < chunkPages.length; i++) {
              accumulated[startIdx + i] = chunkPages[i];
            }
            scheduleFlush();
          },
          { kind: 'full' }
        );

        if (!active) return;

        if (rafHandle !== null) {
          cancelAnimationFrame(rafHandle);
        }
        svgCacheRef.current.setAll(accumulated.filter(Boolean));
        bumpCache();
        setIsRendering(false);
      } catch (err: unknown) {
        if (!active) return;
        if ((err as Error).message === 'CANCELLED') return;
        console.error('Render error:', err);
        setError((err as Error).message || 'Failed to render Typst');
        setIsRendering(false);
      }
    };

    const timeoutId = setTimeout(performFullRender, debounceMs);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [schema, sampleData, isDragging, fontLoadedAt, debounceMs]);

  useEffect(() => {
    return () => svgCacheRef.current.clear();
  }, []);

  const { width: pageWidthMm, height: pageHeightMm } = useMemo(
    () => getPaperDimensions(schema.page.size, schema.page.orientation),
    [schema.page.size, schema.page.orientation]
  );

  const naturalWidthPx = useMemo(() => LayoutEngine.mmToPx(pageWidthMm), [pageWidthMm]);
  const naturalHeightPx = useMemo(() => LayoutEngine.mmToPx(pageHeightMm), [pageHeightMm]);

  const scaledWidthPx = naturalWidthPx * zoom;
  const scaledHeightPx = naturalHeightPx * zoom;

  const cols = canvasLayout === 'grid' ? 2 : 1;
  const currentGapY = (canvasLayout === 'grid' ? ROW_GAP_GRID : ROW_GAP_LIST) * zoom;
  const currentGapX = COL_GAP * zoom;

  const pageCount = Math.max(schema.pages.length, svgCacheRef.current.pageCount);
  const rowCount = Math.ceil(pageCount / cols);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => scaledHeightPx + currentGapY,
    overscan: OVERSCAN,
  });

  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        const { scrollTop, clientHeight } = scrollRef.current;
        const middle = scrollTop + clientHeight / 2;
        const rowIdx = Math.floor((middle - PADDING_TOP) / (scaledHeightPx + currentGapY));
        const pageIdx = Math.max(0, Math.min(pageCount - 1, rowIdx * cols));
        setActivePreviewPageIdx(pageIdx + 1);
      }
    };

    const container = scrollRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [scaledHeightPx, currentGapY, pageCount, cols]);

  useEffect(() => {
    if (scrollToPageId) {
      const idx = pageIds.indexOf(scrollToPageId);
      if (idx !== -1) {
        const rowIdx = Math.floor(idx / cols);
        virtualizer.scrollToIndex(rowIdx, { align: 'start', behavior: 'auto' });
        setTimeout(() => setScrollToPageId(null), 50);
      }
    }
  }, [scrollToPageId, pageIds, cols, virtualizer, setScrollToPageId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: virtualizer ref is stable
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [zoom, canvasLayout]);

  const accentRgb = useMemo(() => hexToRgb(primaryColor), [primaryColor]);
  const contentWidth = cols === 2 ? scaledWidthPx * 2 + currentGapX : scaledWidthPx;

  return (
    <div className="PreviewPane flex-1 flex flex-col bg-slate-400/20 shadow-inner overflow-hidden relative">
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto scrollbar-thin"
        data-canvas-scroll-container
      >
        <div
          className="pb-32 flex flex-col "
          style={{
            paddingTop: `${PADDING_TOP}px`,
            paddingLeft: `${PADDING_SIDE}px`,
            paddingRight: `${PADDING_SIDE}px`,
          }}
        >
          {hasPages ? (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: `${contentWidth}px`,
                position: 'relative',
              }}
            >
              {isRendering && (
                <div
                  className="sticky top-2 z-50 flex justify-end pointer-events-none"
                  style={{ width: `${contentWidth}px` }}
                >
                  <div className="mr-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm flex items-center gap-1.5 text-[10px] text-white/60">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                    Compiling…
                  </div>
                </div>
              )}
              {virtualizer.getVirtualItems().map((vRow) => {
                const startIdx = vRow.index * cols;

                return (
                  <div
                    key={vRow.key}
                    style={{
                      position: 'absolute',
                      top: vRow.start,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: `${contentWidth}px`,
                      display: 'flex',
                      gap: `${currentGapX}px`,
                    }}
                  >
                    {Array.from({ length: Math.min(cols, pageCount - startIdx) }, (_, i) => {
                      const pageIndex = startIdx + i;
                      return (
                        <PageSlide
                          key={pageIndex}
                          pageIndex={pageIndex}
                          cacheVersion={cacheVersion}
                          cache={svgCacheRef.current}
                          naturalWidth={naturalWidthPx}
                          naturalHeight={naturalHeightPx}
                          zoom={zoom}
                        />
                      );
                    })}
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
                  colors={[accentRgb, [accentRgb[0] * 0.6, accentRgb[1] * 0.8, accentRgb[2] * 1.2]]}
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
      <CanvasToolbar
        mode="preview"
        activePage={activePreviewPageIdx}
        totalPageCount={pageCount}
        onPageChange={(idx) => {
          const rowIdx = Math.floor(idx / cols);
          virtualizer.scrollToIndex(rowIdx, { align: 'start', behavior: 'auto' });
        }}
      />
    </div>
  );
});

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return [139, 92, 246];
  const r = Number.parseInt(cleaned.substring(0, 2), 16);
  const g = Number.parseInt(cleaned.substring(2, 4), 16);
  const b = Number.parseInt(cleaned.substring(4, 6), 16);
  return [r, g, b];
}
