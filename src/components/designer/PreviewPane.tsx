'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { renderReportToSvg } from '@/lib/typst-wasm';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

export function PreviewPane() {
  const schema = useDesignerStore((state) => state.schema);
  const sampleData = useDesignerStore((state) => state.sampleData);
  const viewMode = useDesignerStore((state) => state.viewMode);
  const zoom = useDesignerStore((state) => state.zoom);
  const isDragging = useDesignerStore((state) => state.dragState.isDragging);
  const [svgContent, setSvgContent] = useState<string[] | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't trigger a new render while the user is actively dragging.
    // The schema updates after drop (onPointerUp) will fire a fresh render.
    if (isDragging) return;

    let active = true;

    const performRender = async () => {
      try {
        setIsRendering(true);
        setError(null);

        const result = await renderReportToSvg(schema, sampleData);

        if (!active) return;
        if (!result) throw new Error('Engine returned empty result');

        const svgs = result.split('<!-- PAGE_BREAK -->').filter((s) => s.trim().length > 0);
        setSvgContent(svgs);
      } catch (err: any) {
        if (!active) return;
        console.error('Render error:', err);
        setError(err.message || 'Failed to render Typst');
      } finally {
        if (active) setIsRendering(false);
      }
    };

    const timeoutId = setTimeout(performRender, 200);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [schema, sampleData, isDragging]);

  const { width: pageWidthMm, height: pageHeightMm } = getPaperDimensions(
    schema.page.size,
    schema.page.orientation
  );

  return (
    <div className="flex-1 flex flex-col bg-slate-400/20 shadow-inner overflow-hidden relative transition-colors duration-500">
      {/* Precision Preview Area */}
      <div className="flex-1 overflow-auto p-8 scrollbar-thin transition-transform duration-[200ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform">
        <div
          className="flex flex-col items-start gap-8 origin-top-left pl-16 pr-16"
          style={{
            transform: `scale(${zoom})`,
          }}
        >
          {svgContent ? (
            svgContent.map((svg, idx) => (
              <div
                key={idx}
                className={clsx(
                  'relative bg-white shadow-2xl overflow-hidden border border-slate-400'
                )}
                style={{
                  width: `${LayoutEngine.mmToPx(pageWidthMm)}px`,
                  height: `${LayoutEngine.mmToPx(pageHeightMm)}px`,
                }}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Needed for SVG preview
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ))
          ) : (
            <div
              className="relative bg-white shadow-2xl overflow-hidden border border-slate-400 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50/50"
              style={{
                width: `${LayoutEngine.mmToPx(pageWidthMm)}px`,
                height: `${LayoutEngine.mmToPx(pageHeightMm)}px`,
              }}
            >
              <Loader2 className="w-12 h-12 animate-spin opacity-20" />
              <p className="text-[11px] font-bold uppercase tracking-widest opacity-40">
                Compiling Report...
              </p>
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

      {/* Floating Status / Info */}
      <div
        className={clsx(
          'absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800/90 text-white rounded-full shadow-lg border border-slate-700 flex items-center gap-3 transition-all duration-500',
          isRendering && viewMode !== 'split'
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Rendering Live View
          </span>
        </div>
      </div>
    </div>
  );
}
