import { memo } from 'react';
import type { TextComponent } from '@/types/schema';
import { resolveBindings } from '@/lib/utils/json-path';
import { formatValue } from '@/lib/utils/formatters';

interface TextPreviewProps {
  component: TextComponent;
  sampleData: any;
}

export const TextPreview = memo(function TextPreview({ component, sampleData }: TextPreviewProps) {
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
      {displayValue || <span className="text-slate-300 italic">Empty text</span>}
    </div>
  );
});
