'use client';

import { renderReportToSvg } from '@/lib/typst-wasm';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { AlertTriangle, Cpu, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function PreviewPane() {
  // Granular selectors to prevent unnecessary re-renders
  const schema = useDesignerStore((state) => state.schema);
  const sampleData = useDesignerStore((state) => state.sampleData);

  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the last rendered source to avoid redundant work
  const lastSourceRef = useRef<string>('');

  useEffect(() => {
    let active = true;

    const performRender = async () => {
      try {
        setIsRendering(true);
        setError(null);

        console.log('--- RENDERING VIA RUST ENGINE (WASM) ---');
        console.log('DEBUG SCHEMA:', JSON.stringify(schema, null, 2));
        console.log('DEBUG DATA:', JSON.stringify(sampleData, null, 2));
        const svg = await renderReportToSvg(schema, sampleData);

        if (!active) return;
        if (!svg) throw new Error('Engine returned empty SVG');

        setSvgContent(svg);
      } catch (err: any) {
        if (!active) return;
        console.error('Render error:', err);
        setError(err.message || 'Failed to render Typst');
      } finally {
        if (active) setIsRendering(false);
      }
    };

    // Low latency debounce - safe now that rendering is off-thread
    const timeoutId = setTimeout(performRender, 200);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [schema, sampleData]);

  return (
    <div className="flex-1 flex flex-col bg-slate-400/20 shadow-inner overflow-hidden relative">
      {/* Precision Preview Area */}
      <div className="flex-1 overflow-auto flex justify-center p-8 scrollbar-thin">
        <div className="relative bg-white shadow-2xl overflow-hidden border border-slate-400 min-w-[210mm] min-h-[297mm]">
          {svgContent ? (
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Needed for SVG preview
            <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: svgContent }} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50/50">
              <Loader2 className="w-12 h-12 animate-spin opacity-20" />
              <p className="text-[11px] font-bold uppercase tracking-widest opacity-40">
                Compiling Report...
              </p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 bg-red-50/90 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-300">
              <AlertTriangle className="w-12 h-12 text-red-600 mb-4" />
              <p className="text-sm font-bold text-red-800 mb-2">Build Error</p>
              <p className="text-[11px] text-red-600 font-mono bg-white p-4 border border-red-200 rounded-md shadow-sm max-w-md break-all">
                {error}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Status / Info */}
      <div
        className={clsx(
          'absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800/90 text-white rounded-full shadow-lg border border-slate-700 flex items-center gap-3 transition-all duration-500',
          isRendering ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Rendering Live View
          </span>
        </div>
      </div>

      {/* Stats overlay (Top Right) */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 pointer-events-none">
        <div className="flex items-center gap-2 px-2 py-1 bg-white border border-slate-300 rounded shadow-sm">
          <Cpu className="w-3 h-3 text-blue-500" />
          <span className="text-[9px] font-bold text-slate-500 uppercase">
            Engine: Custom Rust WASM
          </span>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-white border border-slate-300 rounded shadow-sm">
          <span className="text-[9px] font-bold text-slate-500 uppercase">
            Input: {Object.keys(sampleData).length} Fields
          </span>
        </div>
      </div>
    </div>
  );
}
