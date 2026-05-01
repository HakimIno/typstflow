import { resolveBindings } from '@/lib/utils/json-path';
import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode, TableComponent } from '@/types/schema';
import { TablePreview } from './TablePreview';

interface Props {
  component: ComponentNode;
  pageIndex?: number;
  totalPages?: number;
}

export function ComponentPreview({ component, pageIndex = 0, totalPages = 1 }: Props) {
  const sampleData = useDesignerStore((state) => state.sampleData);

  switch (component.type) {
    case 'text':
      return (
        <div
          className="text-slate-900 w-full h-full overflow-hidden"
          style={{
            fontSize: `${component.style?.fontSize || 10}pt`,
            fontWeight: component.style?.fontWeight || 'regular',
            textAlign: component.align || 'left',
            lineHeight: '1.2',
            fontFamily: 'Sarabun, "Noto Sans Thai", sans-serif',
            wordBreak: 'break-word',
          }}
        >
          {resolveBindings(component.content || '', sampleData) || (
            <span className="text-slate-300 italic">Empty text</span>
          )}
        </div>
      );
    case 'table':
      return <TablePreview component={component as TableComponent} />;
    case 'line':
      return (
        <div className="w-full h-full flex flex-col justify-center px-1">
          <div
            className="border-t border-slate-900"
            style={{ borderTopWidth: (component as any).thickness || '1pt' }}
          />
        </div>
      );
    case 'spacer':
      return (
        <div className="bg-slate-50/50 border border-dashed border-slate-200 flex items-center justify-center text-[8px] font-bold uppercase tracking-tight text-slate-400 w-full h-full">
          Spacer ({(component as any).height}mm)
        </div>
      );
    case 'image': {
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
    }
    case 'qr':
      return (
        <div className="w-full h-full border border-slate-400 bg-white flex flex-col items-center justify-center p-1 overflow-hidden relative shadow-sm">
          <svg
            className="w-full h-full text-slate-800 opacity-90"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
            role="img"
          >
            <title>QR Code preview</title>
            <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h-3v2h3v-2zm-3 4h3v2h-3v-2zm-2-2h-2v-2h2v2zm0 2h2v2h-2v-2zm-2 2h-2v-2h2v2zm4 0h-2v2h2v-2z" />
            <rect x="7" y="7" width="2" height="2" fill="currentColor" />
            <rect x="17" y="7" width="2" height="2" fill="currentColor" />
            <rect x="7" y="17" width="2" height="2" fill="currentColor" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="bg-white/90 px-1.5 py-0.5 rounded shadow-sm text-[8px] font-bold text-slate-800 truncate max-w-[90%] border border-slate-200">
              {resolveBindings((component as any).value || '', sampleData) || 'QR Code'}
            </span>
          </div>
        </div>
      );
    case 'barcode':
      return (
        <div className="w-full h-full border border-slate-400 bg-white flex flex-col p-0.5 overflow-hidden shadow-sm">
          <div className="flex-1 flex flex-col items-center justify-end px-1">
            <div className="w-full h-full flex items-end gap-[1px] opacity-80 justify-between overflow-hidden">
              {/* Fake barcode lines distributed across width */}
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-slate-900 pointer-events-none"
                  style={{
                    height: i % 10 === 0 || i % 13 === 0 ? '100%' : '80%',
                    width: i % 3 === 0 ? '3px' : i % 5 === 0 ? '1px' : '2px',
                    minWidth: '1px',
                  }}
                />
              ))}
            </div>
            <div className="text-[7.5px] font-mono leading-none font-medium text-slate-800 mt-0.5 truncate text-center w-full">
              {resolveBindings((component as any).value || '', sampleData) || '123456789012'}
            </div>
          </div>
        </div>
      );
    case 'page-break-indicator':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 px-2 py-1 bg-slate-50 border border-dashed border-slate-300">
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-px bg-slate-400" />
            <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
              {(component as any).label || 'Page Break'}
            </span>
            <div className="flex-1 h-px bg-slate-400" />
          </div>
          {(component as any).showPageNumber !== false && (
            <div className="text-[6px] text-slate-400 font-mono">Page X of Y</div>
          )}
        </div>
      );
    case 'page-number': {
      const format = (component as any).format || 'Page {{page}} of {{pageTotal}}';
      const displayText = format
        .replace(/\{\{page\}\}/g, String(pageIndex + 1))
        .replace(/\{\{pageTotal\}\}/g, String(totalPages));

      return (
        <div
          className="text-slate-900 w-full h-full flex items-center justify-center font-mono"
          style={{
            fontSize: `${component.style?.fontSize || 9}pt`,
            fontWeight: component.style?.fontWeight || 'medium',
            textAlign: component.align || 'center',
          }}
        >
          {displayText}
        </div>
      );
    }
    default:
      return <div className="p-2 text-[10px] italic text-slate-400">Block: {component.type}</div>;
  }
}
