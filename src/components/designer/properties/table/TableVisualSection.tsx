import { useDesignerStore } from '@/store/designer-store';
import type { FillPattern, TableComponent } from '@/types/schema';
import { clsx } from 'clsx';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { PropertyRow, SectionHeader } from '../Shared';
import { MiniInput } from './TableShared';

const FILL_PATTERNS: { id: FillPattern; label: string; preview: string }[] = [
  { id: 'none', label: 'No Fill', preview: '⬜' },
  { id: 'header-only', label: 'Header Only', preview: '🟦' },
  { id: 'striped-rows', label: 'Striped Rows', preview: '〓' },
  { id: 'striped-cols', label: 'Striped Cols', preview: '||' },
  { id: 'checkerboard', label: 'Checkerboard', preview: '▦' },
];

interface Props {
  component: TableComponent;
}

const CompactField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1 p-1.5 bg-black/5 rounded border border-[var(--border-default)]">
    <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)] leading-none">{label}</span>
    <div className="flex items-center min-h-[24px]">{children}</div>
  </div>
);

export const TableVisualSection = ({ component }: Props) => {
  const updateComponent = useDesignerStore((state) => state.updateComponent);

  const handleStyleUpdate = (updates: any) => {
    const currentStyle = component.style || {};
    updateComponent(component.id, {
      style: { ...currentStyle, ...updates },
    } as any);
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-1 duration-200">
      <SectionHeader label="Visual Styling" />
      <div className="p-2 space-y-3 bg-[var(--bg-widget)]">
        
        {/* Global Table Borders */}
        <div className="space-y-1.5">
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
              className="w-full h-7"
              mono
            />
          </PropertyRow>

          <PropertyRow label="Cell Padding">
            <MiniInput
              value={component.style?.inset || '2mm'}
              onChange={(v) => handleStyleUpdate({ inset: v })}
              className="w-full h-7"
              mono
              placeholder="e.g. 2mm"
            />
          </PropertyRow>
        </div>

        {/* Header Styling */}
        <div className="pt-2 border-t border-[var(--border-default)]">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 block">Header Styling</span>
          <div className="grid grid-cols-2 gap-1.5">
            <CompactField label="Fill">
              <ColorPicker
                color={component.style?.headerBackground || '#f1f5f9'}
                onChange={(color) => handleStyleUpdate({ headerBackground: color })}
              />
            </CompactField>
            <CompactField label="Text Color">
              <ColorPicker
                color={component.style?.headerColor || '#1e293b'}
                onChange={(color) => handleStyleUpdate({ headerColor: color })}
              />
            </CompactField>
            <CompactField label="Size">
              <MiniInput
                type="number"
                value={component.style?.headerFontSize || 10}
                onChange={(v) => handleStyleUpdate({ headerFontSize: Number.parseInt(v) || 10 })}
                className="w-full h-6"
                suffix="pt"
              />
            </CompactField>
            <CompactField label="Weight">
              <select
                value={component.style?.headerFontWeight || 'bold'}
                onChange={(e) => handleStyleUpdate({ headerFontWeight: e.target.value })}
                className="w-full h-6 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-[10px] px-1 outline-none focus:border-[var(--accent)]"
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
              </select>
            </CompactField>
          </div>
        </div>

        {/* Body Styling */}
        <div className="pt-2 border-t border-[var(--border-default)]">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 block">Body Styling</span>
          <div className="grid grid-cols-2 gap-1.5">
            <CompactField label="Text Color">
              <ColorPicker
                color={component.style?.bodyColor || '#334155'}
                onChange={(color) => handleStyleUpdate({ bodyColor: color })}
              />
            </CompactField>
            <CompactField label="Font Size">
              <MiniInput
                type="number"
                value={component.style?.bodyFontSize || 10}
                onChange={(v) => handleStyleUpdate({ bodyFontSize: Number.parseInt(v) || 10 })}
                className="w-full h-6"
                suffix="pt"
              />
            </CompactField>
          </div>
        </div>

        {/* Fill Pattern */}
        <div className="pt-2 border-t border-[var(--border-default)]">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 block">Fill Pattern</span>
          <div className="grid grid-cols-5 gap-1">
            {FILL_PATTERNS.map((p) => (
              <button
                key={p.id}
                title={p.label}
                onClick={() => handleStyleUpdate({ fillPattern: p.id })}
                className={clsx(
                  'flex flex-col items-center justify-center gap-1 aspect-square rounded border transition-all',
                  component.style?.fillPattern === p.id
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
                )}
              >
                <span className="text-[14px] leading-none">{p.preview}</span>
                <span className="text-[6px] uppercase font-bold text-center leading-tight truncate px-0.5">{p.id.replace('-', ' ')}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pattern Colors */}
        {component.style?.fillPattern && component.style?.fillPattern !== 'none' && (
          <div className="mt-2 grid grid-cols-2 gap-1.5 pt-2 border-t border-[var(--border-default)]">
            <CompactField label="Fill 1">
              <ColorPicker
                color={component.style?.stripedColor1 || '#ffffff'}
                onChange={(color) => handleStyleUpdate({ stripedColor1: color })}
              />
            </CompactField>
            <CompactField label="Fill 2">
              <ColorPicker
                color={component.style?.stripedColor2 || '#f8fafc'}
                onChange={(color) => handleStyleUpdate({ stripedColor2: color })}
              />
            </CompactField>
          </div>
        )}
      </div>
    </div>
  );
};
