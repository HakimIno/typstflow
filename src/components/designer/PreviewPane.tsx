'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { renderReportToSvg } from '@/lib/typst-wasm';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { AlertTriangle } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { CanvasRevealEffect } from '@/components/ui/canvas-reveal-effect';
import { Loading } from '../shared/Loading';

export const PreviewPane = memo(function PreviewPane() {
  const schema = useDesignerStore((state) => state.schema);
  const sampleData = useDesignerStore((state) => state.sampleData);
  const zoom = useDesignerStore((state) => state.zoom);
  const isDragging = useDesignerStore((state) => state.dragState.isDragging);
  const fontLoadedAt = useDesignerStore((state) => state.fontLoadedAt);
  const primaryColor = useDesignerStore((state) => state.primaryColor);
  const [svgContent, setSvgContent] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shouldShowLoading, setShouldShowLoading] = useState(false);

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

        const result = await renderReportToSvg(schema, sampleData);

        if (!active) return;
        if (!result) throw new Error('Engine returned empty result');

        const svgs = result.split('<!-- PAGE_BREAK -->').filter((s) => s.trim().length > 0);
        setSvgContent(svgs);
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

  const canvasLayout = useDesignerStore((state) => state.canvasLayout);

  const { width: pageWidthMm, height: pageHeightMm } = getPaperDimensions(
    schema.page.size,
    schema.page.orientation
  );

  const accentRgb = hexToRgb(primaryColor);

  return (
    <div className="flex-1 flex flex-col bg-slate-400/20 shadow-inner overflow-hidden relative">
      {/* Precision Preview Area */}
      <div className="flex-1 overflow-auto p-8 scrollbar-thin">
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
                className="relative bg-white shadow-xl overflow-hidden"
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
              className="relative overflow-hidden rounded-sm shadow-2xl"
              style={{
                width: `${LayoutEngine.mmToPx(pageWidthMm)}px`,
                height: `${LayoutEngine.mmToPx(pageHeightMm)}px`,
              }}
            >
              {/* GPU-Accelerated Canvas Reveal Effect */}
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

              {/* Center Content Overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                {/* Radial glow behind the icon */}
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

              {/* Bottom fade gradient */}
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

/** Convert hex color string to [R, G, B] array (0-255) */
function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return [139, 92, 246]; // fallback to purple
  const r = Number.parseInt(cleaned.substring(0, 2), 16);
  const g = Number.parseInt(cleaned.substring(2, 4), 16);
  const b = Number.parseInt(cleaned.substring(4, 6), 16);
  return [r, g, b];
}
