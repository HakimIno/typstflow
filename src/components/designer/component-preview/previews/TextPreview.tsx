import { formatValue } from '@/lib/utils/formatters';
import { resolveBindings } from '@/lib/utils/json-path';
import { useDesignerStore } from '@/store/designer-store';
import type { TextComponent } from '@/types/schema';
import { memo } from 'react';

interface TextPreviewProps {
  component: TextComponent;
  sampleData: any;
}

export const TextPreview = memo(function TextPreview({ component, sampleData }: TextPreviewProps) {
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
        fontFamily: `${fontFamily || 'Sarabun'}, "Geist", "Inter", "Sarabun-Local", "Noto Sans Thai", sans-serif`,
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        visibility: isFontReady ? 'visible' : 'hidden',
      }}
    >
      {displayValue || <span className="text-slate-300 italic">Empty text</span>}
    </div>
  );
});
