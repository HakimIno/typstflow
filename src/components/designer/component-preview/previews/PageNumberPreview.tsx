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
        fontFamily: `${fontFamily || 'Sarabun'}, "Noto Sans Thai", sans-serif`,
        visibility: isFontReady ? 'visible' : 'hidden',
      }}
    >
      {display}
    </div>
  );
});
