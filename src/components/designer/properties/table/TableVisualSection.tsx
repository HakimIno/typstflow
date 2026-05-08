import { useDesignerStore } from '@/store/designer-store';
import type { FillPattern, TableComponent } from '@/types/schema';
import { clsx } from 'clsx';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { PropertyRow, SectionHeader } from '../Shared';
import { MiniInput } from './TableShared';

const FILL_PATTERNS: { id: FillPattern; label: string; preview: string }[] = [
  { id: 'none', label: 'No Fill', preview: '⬜⬜⬜' },
  { id: 'header-only', label: 'Header Only', preview: '🟦⬜⬜' },
  { id: 'striped-rows', label: 'Striped Rows', preview: '🟦⬜🟦' },
  { id: 'striped-cols', label: 'Striped Cols', preview: '🟦⬜🟦' },
  { id: 'checkerboard', label: 'Checkerboard', preview: '🟦⬜🟦' },
];

interface Props {
  component: TableComponent;
}

export const TableVisualSection = ({ component }: Props) => {
  const updateComponent = useDesignerStore((state) => state.updateComponent);

  const handleStyleUpdate = (updates: any) => {
    const currentStyle = component.style || {};
    updateComponent(component.id, {
      style: { ...currentStyle, ...updates },
    } as any);
  };

  return (
    <div className="animate-in fade-in duration-200">
      <SectionHeader label="Visual Styling" />
      <div className="p-2 space-y-1.5 bg-[var(--bg-widget)]">
        <PropertyRow label="Border Color">
          <ColorPicker
            color={component.style?.borderColor || '#e2e8f0'}
            onChange={(color) => handleStyleUpdate({ borderColor: color })}
          />
        </PropertyRow>

        <PropertyRow label="Border Width">
          <MiniInput
            value={component.style?.borderWidth || '0.2mm'}
            onChange={(v) => handleStyleUpdate({ borderWidth: v })}
            className="w-full h-6"
            mono
          />
        </PropertyRow>

        <PropertyRow label="Cell Padding">
          <MiniInput
            value={component.style?.inset || '5pt'}
            onChange={(v) => handleStyleUpdate({ inset: v })}
            className="w-full h-7"
            mono
            placeholder="e.g. 5pt"
          />
        </PropertyRow>

        <div className="border-t border-[var(--border-default)] pt-2 mt-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 block">Fill Pattern</span>
          <div className="grid grid-cols-1 gap-1">
            {FILL_PATTERNS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleStyleUpdate({ fillPattern: p.id })}
                className={clsx(
                  'flex items-center justify-between px-3 py-1.5 rounded border transition-all text-[11px]',
                  component.style?.fillPattern === p.id
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
                )}
              >
                <span>{p.label}</span>
                <span className="text-[8px] font-mono opacity-60">{p.preview}</span>
              </button>
            ))}
          </div>
        </div>

        {component.style?.fillPattern && component.style?.fillPattern !== 'none' && (
          <div className="mt-2 space-y-1.5 border-t border-[var(--border-default)] pt-2">
            <PropertyRow label="Fill Color 1">
              <ColorPicker
                color={component.style?.stripedColor1 || '#ffffff'}
                onChange={(color) => handleStyleUpdate({ stripedColor1: color })}
              />
            </PropertyRow>
            <PropertyRow label="Fill Color 2">
              <ColorPicker
                color={component.style?.stripedColor2 || '#f8fafc'}
                onChange={(color) => handleStyleUpdate({ stripedColor2: color })}
              />
            </PropertyRow>
          </div>
        )}
      </div>
    </div>
  );
};
