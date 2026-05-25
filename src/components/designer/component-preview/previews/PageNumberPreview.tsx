import { useDesignerStore } from '@/store/designer-store';
import type { PageNumberComponent } from '@/types/schema';
import { memo } from 'react';

interface PageNumberPreviewProps {
  component: PageNumberComponent;
  pageIndex: number;
  totalPages: number;
}

export const PageNumberPreview = memo(function PageNumberPreview({
  component,
  pageIndex,
  totalPages,
}: PageNumberPreviewProps) {
  const fontFamily = component.style?.fontFamily;

  const fontInstalledAt = useDesignerStore((s) => {
    if (!fontFamily || fontFamily === 'Sarabun') return -1;
    return s.installedFonts.find((f) => f.family === fontFamily)?.installedAt ?? 0;
  });

  const isFontReady =
    fontInstalledAt <= 0 ||
    typeof document === 'undefined' ||
    document.fonts.check(`12px "${fontFamily}"`);

  const display = (component.format || 'Page {{page}} of {{pageTotal}}')
    .replace(/\{\{page\}\}/g, (pageIndex + 1).toString())
    .replace(/\{\{pageTotal\}\}/g, totalPages.toString());

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

  return (
    <div
      className="w-full h-full"
      style={{
        fontSize: `${component.style?.fontSize || 9}pt`,
        fontWeight,
        fontStyle: component.style?.italic ? 'italic' : 'normal',
        textDecoration,
        color: component.style?.color || '#0f172a',
        textAlign: component.align || 'center',
        fontFamily: `${fontFamily || 'Sarabun'}, "Noto Sans Thai", sans-serif`,
        visibility: isFontReady ? 'visible' : 'hidden',
      }}
    >
      {display}
    </div>
  );
});
