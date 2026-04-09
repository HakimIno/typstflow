'use client';
import type { ComponentNode } from '@/types/schema';
import { Table as TableIcon } from 'lucide-react';

interface Props {
  component: ComponentNode;
}

export function ComponentPreview({ component }: Props) {
  switch (component.type) {
    case 'text':
      return (
        <div
          className="leading-tight text-slate-900 w-full h-full overflow-hidden"
          style={{
            fontSize: `${component.style?.fontSize || 10}pt`,
            fontWeight: component.style?.fontWeight || 'regular',
            textAlign: component.align || 'left',
            wordBreak: 'break-word',
          }}
        >
          {component.content || 'Empty text'}
        </div>
      );
    case 'table':
      return (
        <div className="border border-slate-200 bg-white w-full h-full text-slate-400">
          <div className="bg-slate-50 border-b border-slate-200 px-2 py-0.5 flex items-center justify-between text-[9px] font-bold text-slate-500">
            <span>Table: {(component as any).dataSource || 'Unbound'}</span>
            <TableIcon className="w-3 h-3" />
          </div>
          <div className="flex-1 flex items-center justify-center italic text-[9px]">
            [ Data Table Block ]
          </div>
        </div>
      );
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
    case 'image':
      return (
        <div className="w-full h-full bg-slate-50 border border-slate-200 flex items-center justify-center text-[9px] text-slate-400 font-bold uppercase tracking-widest overflow-hidden">
          Image Component
        </div>
      );
    case 'barcode':
      return (
        <div className="w-full h-full border border-slate-400 bg-slate-50 flex flex-col items-center justify-center p-1">
          <div className="text-[8px] font-bold text-slate-500">
            {(component as any).format?.toUpperCase() || 'CODE128'}
          </div>
          <div className="w-full flex-1 bg-white border border-slate-200 mt-1" />
        </div>
      );
    default:
      return <div className="p-2 text-[10px] italic text-slate-400">Block: {component.type}</div>;
  }
}
