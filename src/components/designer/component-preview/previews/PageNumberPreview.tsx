import { memo } from 'react';
import type { PageNumberComponent } from '@/types/schema';

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
});
