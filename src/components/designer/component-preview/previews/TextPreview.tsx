import { formatValue } from '@/lib/utils/formatters';
import { resolveBindings } from '@/lib/utils/json-path';
import { useDesignerStore } from '@/store/designer-store';
import type { TextComponent } from '@/types/schema';
import { memo } from 'react';

interface TextPreviewProps {
  component: TextComponent;
  sampleData: any;
  autoHeight?: boolean;
}

export const TextPreview = memo(function TextPreview({
  component,
  sampleData,
  autoHeight,
}: TextPreviewProps) {
  const fontFamily = component.style?.fontFamily;

  // Subscribe to this font's installedAt timestamp (not a global value) so only THIS
  // component re-renders when its specific font finishes loading.
  const fontInstalledAt = useDesignerStore((s) => {
    if (!fontFamily || fontFamily === 'Sarabun') return -1;
    return s.installedFonts.find((f) => f.family === fontFamily)?.installedAt ?? 0;
  });

  // Prevent FOUT: hide text if the custom font is registered in the store (installedAt > 0)
  // but hasn't landed in the browser yet. text stays hidden until font is actually usable.
  // fontInstalledAt === 0  → font not in store, show with CSS fallback (first-time install flow)
  // fontInstalledAt === -1 → built-in font, always ready
  // fontInstalledAt  >  0  → custom font was installed; verify browser actually has it
  const isFontReady =
    fontInstalledAt <= 0 ||
    typeof document === 'undefined' ||
    document.fonts.check(`12px "${fontFamily}"`);

  const resolvedValue = resolveBindings(component.content || '', sampleData);
  const hasBinding = (component.content || '').includes('{{');
  const displayValue = hasBinding ? formatValue(resolvedValue, component.format) : resolvedValue;

  const decorations: string[] = [];
  if (component.style?.underline) decorations.push('underline');
  if (component.style?.strikethrough) decorations.push('line-through');
  const textDecoration = decorations.length > 0 ? decorations.join(' ') : 'none';

  const fontWeight = (() => {
    const w = component.style?.fontWeight;
    if (!w) return 'normal';
    if (typeof w === 'number') return String(w);
    switch (w) {
      case 'thin':
        return '100';
      case 'light':
        return '300';
      case 'regular':
        return 'normal';
      case 'medium':
        return '500';
      case 'semibold':
        return '600';
      case 'bold':
        return 'bold';
      case 'extrabold':
        return '800';
      case 'black':
        return '900';
      default:
        return 'normal';
    }
  })();

  const align = component.style?.align ?? component.align ?? 'left';
  const verticalAlign = component.style?.verticalAlign || 'top';

  const justifyMap = {
    top: 'flex-start',
    middle: 'center',
    bottom: 'flex-end',
  };

  return (
    <div
      className={autoHeight ? 'w-full' : 'w-full h-full overflow-hidden'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: justifyMap[verticalAlign] || 'flex-start',
        alignItems: 'stretch',
        fontSize: `${component.style?.fontSize || 10}pt`,
        fontWeight,
        fontStyle: component.style?.italic ? 'italic' : 'normal',
        textDecoration,
        color: component.style?.color || '#0f172a',
        textAlign: align === 'justify' ? 'justify' : align,
        lineHeight: component.style?.lineHeight || '1.4',
        letterSpacing: component.style?.letterSpacing || 'normal',
        fontFamily: `${fontFamily || 'Sarabun'}, "Geist", "Inter", "Sarabun-Local", "Noto Sans Thai", sans-serif`,
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        visibility: isFontReady ? 'visible' : 'hidden',
        textTransform: component.style?.textTransform || 'none',
        fontVariant: component.style?.smallcaps ? 'small-caps' : 'normal',
        fontVariantNumeric: component.style?.numberWidth === 'tabular' ? 'tabular-nums' : 'normal',
        WebkitTextStroke: component.style?.strokeColor
          ? `${component.style.strokeWidth || '0.5pt'} ${component.style.strokeColor}`
          : undefined,
        backgroundColor: component.style?.background || undefined,
        padding: component.style?.background
          ? component.style.backgroundPadding || '5px'
          : undefined,
        borderRadius: component.style?.backgroundRadius || undefined,
      }}
    >
      {displayValue ? (
        component.style?.highlight ? (
          <span style={{ backgroundColor: component.style.highlight, padding: '0 2px' }}>
            {displayValue}
          </span>
        ) : (
          displayValue
        )
      ) : (
        <span className="text-slate-300 italic">Empty text</span>
      )}
    </div>
  );
});
