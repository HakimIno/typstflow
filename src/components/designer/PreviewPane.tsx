'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { renderReportToSvg } from '@/lib/typst-wasm';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Loading } from '../shared/Loading';

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

  const canvasLayout = useDesignerStore((state) => state.canvasLayout);

  const { width: pageWidthMm, height: pageHeightMm } = getPaperDimensions(
    schema.page.size,
    schema.page.orientation
  );

  return (
    <div className="flex-1 flex flex-col bg-slate-400/20 shadow-inner overflow-hidden relative transition-colors duration-500">
      {/* Precision Preview Area */}
      <div className="flex-1 overflow-auto p-8 scrollbar-thin transition-transform duration-[200ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform">
        <div
          className={clsx(
            'origin-top-left pl-16 pr-16 pb-32',
            canvasLayout === 'grid' ? 'grid' : 'flex flex-col items-start'
          )}
          style={{
            transform: `scale(${zoom})`,
            display: canvasLayout === 'grid' ? 'grid' : 'flex',
            gridTemplateColumns:
              canvasLayout === 'grid'
                ? `repeat(2, ${LayoutEngine.mmToPx(pageWidthMm)}px)`
                : undefined,
            gap: canvasLayout === 'grid' ? '48px 32px' : '32px',
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
              className="relative overflow-hidden "
              style={{
                width: `${LayoutEngine.mmToPx(pageWidthMm)}px`,
                height: `${LayoutEngine.mmToPx(pageHeightMm)}px`,
              }}
            >
              {/* Animated Background Blobs */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none ">
                <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] rounded-full bg-blue-400/30 blur-[80px] animate-blob" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full bg-purple-400/30 blur-[80px] animate-blob animation-delay-2000" />
                <div className="absolute top-[20%] right-[10%] w-[60%] h-[60%] rounded-full bg-pink-400/20 blur-[80px] animate-blob animation-delay-4000" />
              </div>

              <div className="relative z-10 flex h-full items-center justify-center">
                <Loading message={'Compiling Report...'} />
              </div>
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
}
