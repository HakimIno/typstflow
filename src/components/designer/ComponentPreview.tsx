import { clsx } from 'clsx';
import { resolveBindings } from '@/lib/utils/json-path';
import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode, TableComponent } from '@/types/schema';
import { TablePreview } from './TablePreview';
import { formatValue } from '@/lib/utils/formatters';

interface Props {
  component: ComponentNode;
  pageIndex?: number;
  totalPages?: number;
}

export function ComponentPreview({ component, pageIndex = 0, totalPages = 1 }: Props) {
  const sampleData = useDesignerStore((state) => state.sampleData);

  switch (component.type) {
    case 'text': {
      const resolvedValue = resolveBindings(component.content || '', sampleData);
      const hasBinding = (component.content || '').includes('{{');
      const displayValue = hasBinding ? formatValue(resolvedValue, component.format) : resolvedValue;
      
      return (
        <div
          className="w-full h-full overflow-hidden"
          style={{
            fontSize: `${component.style?.fontSize || 10}pt`,
            fontWeight: component.style?.fontWeight || 'regular',
            fontStyle: component.style?.italic ? 'italic' : 'normal',
            textDecoration: component.style?.underline ? 'underline' : 'none',
            color: component.style?.color || '#0f172a',
            textAlign: component.align || 'left',
            lineHeight: component.style?.lineHeight || '1.2',
            letterSpacing: component.style?.letterSpacing || 'normal',
            fontFamily: `${component.style?.fontFamily || 'Sarabun'}, "Noto Sans Thai", sans-serif`,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {displayValue || (
            <span className="text-slate-300 italic">Empty text</span>
          )}
        </div>
      );
    }
    case 'table':
      return <TablePreview component={component as TableComponent} />;
    case 'line': {
      const thickness = (component as any).thickness || '1pt';
      const color = (component as any).color || '#0f172a';
      const lineStyle = (component as any).style || 'solid';
      
      return (
        <div className="w-full h-full flex flex-col justify-center">
          <div
            style={{ 
              borderTopWidth: thickness,
              borderTopColor: color,
              borderTopStyle: lineStyle === 'dotted' ? 'dotted' : lineStyle === 'dashed' ? 'dashed' : 'solid'
            }}
          />
        </div>
      );
    }
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
    case 'barcode':
    case 'qr':
      return (
        <div className="w-full h-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
          <div className="text-center p-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{component.type}</div>
            <div className="text-[8px] text-slate-400 font-mono truncate max-w-[150px]">
              {resolveBindings((component as any).value || '', sampleData)}
            </div>
          </div>
        </div>
      );
    case 'summary-box':
      return (
        <div className="w-full h-full p-2 bg-slate-50 border border-slate-200 rounded flex flex-col gap-1">
          {(component as any).rows?.map((row: any, i: number) => (
            <div key={i} className={clsx(
              "flex justify-between items-center text-[9px]",
              row.separator && "border-t border-slate-200 mt-1 pt-1",
              row.style === 'total' && "font-bold text-[11px] text-blue-600"
            )}>
              <span className="text-slate-500">{row.label}</span>
              <span className="font-medium">{resolveBindings(row.value, sampleData)}</span>
            </div>
          ))}
        </div>
      );
    case 'page-break-indicator':
      return (
        <div className="w-full py-4 flex items-center justify-center gap-4 relative">
          <div className="flex-1 h-[1px] bg-dashed border-t border-dashed border-blue-400 opacity-50" />
          <div className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-full flex items-center gap-2">
            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Page Break</span>
            {(component as any).showPageNumber && (
              <span className="text-[9px] text-blue-400">Page {pageIndex + 1} / {totalPages}</span>
            )}
          </div>
          <div className="flex-1 h-[1px] bg-dashed border-t border-dashed border-blue-400 opacity-50" />
        </div>
      );
    case 'page-number': {
      const display = ((component as any).format || 'Page {{page}} of {{pageTotal}}')
        .replace(/\{\{page\}\}/g, (pageIndex + 1).toString())
        .replace(/\{\{pageTotal\}\}/g, totalPages.toString());
      
      return (
        <div
          className="w-full h-full"
          style={{
            fontSize: `${component.style?.fontSize || 9}pt`,
            fontWeight: component.style?.fontWeight || 'regular',
            fontStyle: component.style?.italic ? 'italic' : 'normal',
            textDecoration: component.style?.underline ? 'underline' : 'none',
            color: component.style?.color || '#0f172a',
            textAlign: component.align || 'center',
            fontFamily: `${component.style?.fontFamily || 'Sarabun'}, "Noto Sans Thai", sans-serif`,
          }}
        >
          {display}
        </div>
      );
    }
    default:
      return <div>Preview for {component.type}</div>;
  }
}
