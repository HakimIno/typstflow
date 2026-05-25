'use client';

import { CanvasToolbar } from '@/components/designer/CanvasToolbar';
import { Loading } from '@/components/shared/Loading';
import { CanvasRevealEffect } from '@/components/ui/canvas-reveal-effect';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { fontManager } from '@/lib/font-manager';
import { initTypst, renderReportToSvgStream } from '@/lib/typst-wasm';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { useDesignerStore } from '@/store/designer-store';
import type { LayoutSchema } from '@/types/schema';
import { AlertCircle, Loader2 } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

const PADDING_TOP = 48; // pt-12 = 48px
const PADDING_SIDE = 64; // px-16 = 64px
const ROW_GAP_LIST = 32; // gap-8 = 32px

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

function collectFontsFromSchema(schema: LayoutSchema): string[] {
  const families = new Set<string>();

  const collect = (comps: any[]) => {
    for (const c of comps || []) {
      if (c.type === 'text' && c.fontFamily) {
        families.add(c.fontFamily);
      }
      if (c.type === 'repeater') collect(c.children || []);
      if (c.type === 'columns') {
        for (const col of c.columns || []) collect(col.components || []);
      }
    }
  };

  collect(schema.zones?.header?.components || []);
  collect(schema.zones?.footer?.components || []);
  if (schema.pages) {
    for (const p of schema.pages) {
      if (p.body?.components) collect(p.body.components);
    }
  }

  return Array.from(families);
}

/** Convert hex color string to [R, G, B] array (0–255) */
function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return [139, 92, 246];
  const r = Number.parseInt(cleaned.substring(0, 2), 16);
  const g = Number.parseInt(cleaned.substring(2, 4), 16);
  const b = Number.parseInt(cleaned.substring(4, 6), 16);
  return [r, g, b];
}

export const CompiledReportViewer = memo(function CompiledReportViewer({
  schema,
  sampleData,
}: {
  schema: LayoutSchema;
  sampleData: Record<string, unknown>;
}) {
  const zoom = useDesignerStore((state) => state.zoom);
  const primaryColor = useDesignerStore((state) => state.primaryColor);

  const [svgContent, setSvgContent] = useState<string[] | null>(null);
  const [isCompiling, setIsCompiling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Initializing compiler...');
  const [activePreviewPageIdx, setActivePreviewPageIdx] = useState(1);

  const scrollRef = useRef<HTMLDivElement>(null);

  const { width: pageW, height: pageH } = getPaperDimensions(
    schema.page.size,
    schema.page.orientation
  );
  const pageWpx = useMemo(() => LayoutEngine.mmToPx(pageW), [pageW]);
  const pageHpx = useMemo(() => LayoutEngine.mmToPx(pageH), [pageH]);

  const currentGapY = ROW_GAP_LIST * zoom;
  const accentRgb = useMemo(() => hexToRgb(primaryColor), [primaryColor]);

  // Track active page in preview via scroll
  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current && svgContent) {
        const { scrollTop, clientHeight } = scrollRef.current;
        const middle = scrollTop + clientHeight / 2;
        const rowIdx = Math.floor((middle - PADDING_TOP) / (pageHpx * zoom + currentGapY));
        const pageIdx = Math.max(0, Math.min(svgContent.length - 1, rowIdx));
        setActivePreviewPageIdx(pageIdx + 1);
      }
    };

    const container = scrollRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [pageHpx, zoom, currentGapY, svgContent]);

  useEffect(() => {
    let active = true;

    const setupAndCompile = async () => {
      try {
        setIsCompiling(true);
        setError(null);

        // 1. Initialize Typst WASM worker
        setStatusMessage('Starting Typst compiler...');
        await initTypst();

        // 2. Fetch custom corporate fonts registry and populate store
        setStatusMessage('Loading custom fonts...');
        try {
          const res = await fetch('/api/fonts/custom');
          if (res.ok) {
            const data = await res.json();
            useDesignerStore.getState().setCustomFonts(data);
          }
        } catch (e) {
          console.warn('[CompiledReportViewer] Failed to fetch custom fonts:', e);
        }

        // 3. Scan schema and install required fonts
        const usedFonts = collectFontsFromSchema(schema);
        const fontsToInstall = usedFonts.filter(
          (f) => f !== 'Sarabun' && !fontManager.isWasmLoaded(f)
        );

        if (fontsToInstall.length > 0) {
          setStatusMessage(`Installing fonts: ${fontsToInstall.join(', ')}...`);
          await Promise.allSettled(fontsToInstall.map((f) => fontManager.installFont(f)));
        }

        // 4. Start Typst compilation stream
        if (!active) return;
        setStatusMessage('Rendering document...');

        await renderReportToSvgStream(schema, sampleData, (pages, startIdx) => {
          if (!active) return;
          setSvgContent((prev) => {
            const next = prev ? [...prev] : Array.from({ length: schema.pages.length }, () => '');
            for (let i = 0; i < pages.length; i++) {
              next[startIdx + i] = pages[i];
            }
            return next;
          });
        });

        if (active) {
          setIsCompiling(false);
        }
      } catch (err: any) {
        console.error('[CompiledReportViewer Error]:', err);
        if (active) {
          setError(err.message || String(err));
          setIsCompiling(false);
        }
      }
    };

    setupAndCompile();

    return () => {
      active = false;
    };
  }, [schema, sampleData]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4 animate-bounce" />
        <h3 className="text-lg font-semibold text-white mb-2">Failed to Render Document</h3>
        <p className="text-sm text-white/60 max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div className="PreviewPane flex-1 flex flex-col bg-slate-400/20 shadow-inner overflow-hidden relative w-full h-full">
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto scrollbar-thin w-full"
        data-canvas-scroll-container
      >
        <div
          className="pb-32 flex flex-col items-center"
          style={{
            paddingTop: `${PADDING_TOP}px`,
            paddingLeft: `${PADDING_SIDE}px`,
            paddingRight: `${PADDING_SIDE}px`,
          }}
        >
          {svgContent && svgContent.length > 0 ? (
            <div
              style={{
                width: `${pageWpx * zoom}px`,
                position: 'relative',
              }}
            >
              {/* Subtle spinner overlay while compiling */}
              {isCompiling && (
                <div
                  className="sticky top-2 z-50 flex justify-end pointer-events-none"
                  style={{ width: `${pageWpx * zoom}px` }}
                >
                  <div className="mr-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm flex items-center gap-1.5 text-[10px] text-white/60">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                    Compiling…
                  </div>
                </div>
              )}

              {/* Pages */}
              <div
                className="flex flex-col items-center animate-in fade-in duration-300"
                style={{ gap: `${currentGapY}px` }}
              >
                {svgContent.map((svg, idx) => (
                  <div key={idx} id={`page-slide-${idx}`} className="relative group">
                    {svg ? (
                      <PageSlide
                        svg={svg}
                        naturalWidth={pageWpx}
                        naturalHeight={pageHpx}
                        zoom={zoom}
                      />
                    ) : (
                      <div
                        className="bg-white border border-slate-200 rounded shadow-md flex items-center justify-center animate-pulse"
                        style={{ width: pageWpx * zoom, height: pageHpx * zoom }}
                      >
                        <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                      </div>
                    )}
                    {/* Page label */}
                    <div className="absolute -left-16 top-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none text-right hidden md:block">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">
                        Page
                      </span>
                      <div className="text-xl font-bold text-white/60">{idx + 1}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Canvas Reveal Effect loading card */
            <div
              className="relative overflow-hidden rounded-sm shadow-2xl mx-auto border border-white/5"
              style={{ width: `${pageWpx * zoom}px`, height: `${pageHpx * zoom}px` }}
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
                  className="absolute w-40 h-40 rounded-full opacity-20 blur-3xl animate-pulse"
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
                  <Loading message={statusMessage} />
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent z-[5]" />
            </div>
          )}

          {svgContent && svgContent.length > 0 && (
            <footer className="py-8 text-center text-xs text-white/20 border-t border-white/5 mt-12 w-full max-w-[200px] shrink-0">
              Made with{' '}
              <a href="/" className="text-violet-400 hover:text-violet-300">
                TypstFlow
              </a>
            </footer>
          )}
        </div>
      </div>

      <CanvasToolbar
        mode="preview"
        activePage={activePreviewPageIdx}
        totalPageCount={svgContent?.length || 0}
        onPageChange={(idx) => {
          const el = document.getElementById(`page-slide-${idx}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
      />
    </div>
  );
});
