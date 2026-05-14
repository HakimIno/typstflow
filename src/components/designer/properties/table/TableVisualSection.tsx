import { useDesignerStore } from '@/store/designer-store';
import type { FillPattern, TableComponent } from '@/types/schema';
import { clsx } from 'clsx';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { ControlField, PropertyGrid, SectionHeader } from '../Shared';
import { MiniInput } from './TableShared';
import { FontWeightSelect } from '../../ui/FontWeightSelect';

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
      <div className="p-0.5 space-y-px bg-[var(--border-default)]">

        {/* Global Table Borders */}
        <PropertyGrid cols={2}>
          <ControlField label="Border Color">
            <ColorPicker
              color={component.style?.borderColor || '#e2e8f0'}
              onChange={(color) => handleStyleUpdate({ borderColor: color })}
            />
          </ControlField>

          <ControlField label="Border Width">
            <MiniInput
              value={component.style?.borderWidth || '0.2mm'}
              onChange={(v) => handleStyleUpdate({ borderWidth: v })}
              className="w-full h-7"
              mono
            />
          </ControlField>

          <ControlField label="Cell Padding" className="col-span-2">
            <MiniInput
              value={component.style?.inset || '2mm'}
              onChange={(v) => handleStyleUpdate({ inset: v })}
              className="w-full h-7"
              mono
              placeholder="e.g. 2mm"
            />
          </ControlField>
        </PropertyGrid>

        {/* Header Styling */}
        <div className="bg-[var(--bg-surface)] px-2 py-1.5 border-b border-[var(--border-default)]">
          <span className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">Header Appearance</span>
        </div>
        <PropertyGrid cols={2}>
          <ControlField label="Fill">
            <ColorPicker
              color={component.style?.headerBackground || '#f1f5f9'}
              onChange={(color) => handleStyleUpdate({ headerBackground: color })}
            />
          </ControlField>
          <ControlField label="Text Color">
            <ColorPicker
              color={component.style?.headerColor || '#1e293b'}
              onChange={(color) => handleStyleUpdate({ headerColor: color })}
            />
          </ControlField>
          <ControlField label="Size">
            <MiniInput
              type="number"
              value={component.style?.headerFontSize || 10}
              onChange={(v) => handleStyleUpdate({ headerFontSize: Number.parseInt(v) || 10 })}
              className="w-full h-6"
              suffix="pt"
            />
          </ControlField>
          <ControlField label="Weight">
            <FontWeightSelect
              value={component.style?.headerFontWeight}
              onChange={(v: string) => handleStyleUpdate({ headerFontWeight: v })}
            />
          </ControlField>
        </PropertyGrid>

        {/* Body Styling */}
        <div className="bg-[var(--bg-surface)] px-2 py-1.5 border-b border-[var(--border-default)]">
          <span className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">Body Appearance</span>
        </div>
        <PropertyGrid cols={2}>
          <ControlField label="Text Color">
            <ColorPicker
              color={component.style?.bodyColor || '#334155'}
              onChange={(color) => handleStyleUpdate({ bodyColor: color })}
            />
          </ControlField>
          <ControlField label="Font Size">
            <MiniInput
              type="number"
              value={component.style?.bodyFontSize || 10}
              onChange={(v) => handleStyleUpdate({ bodyFontSize: Number.parseInt(v) || 10 })}
              className="w-full h-6"
              suffix="pt"
            />
          </ControlField>
        </PropertyGrid>

        {/* Fill Pattern */}
        <div className="bg-[var(--bg-surface)] px-2 py-1.5 border-b border-[var(--border-default)]">
          <span className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">Alternating Fill</span>
        </div>
        <div className="bg-[var(--bg-surface)] p-1.5">
          <div className="grid grid-cols-2 gap-1">
            {FILL_PATTERNS.map((p) => (
              <button
                key={p.id}
                title={p.label}
                onClick={() => handleStyleUpdate({ fillPattern: p.id })}
                className={clsx(
                  'flex flex-row items-center gap-2 p-1.5 rounded border transition-all text-left group',
                  component.style?.fillPattern === p.id
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                    : 'bg-black/5 text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-black/10'
                )}
              >
                <div className={clsx(
                  "w-5 h-5 rounded flex items-center justify-center shrink-0 text-[12px]",
                  component.style?.fillPattern === p.id ? "bg-white/20" : "bg-[var(--bg-surface)] border border-[var(--border-default)]"
                )}>
                  {p.preview}
                </div>
                <span className="text-[8px] font-bold uppercase tracking-tight leading-tight">
                  {p.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Pattern Colors */}
        {component.style?.fillPattern && component.style?.fillPattern !== 'none' && (
          <PropertyGrid cols={2}>
            <ControlField label="Fill 1">
              <ColorPicker
                color={component.style?.stripedColor1 || '#ffffff'}
                onChange={(color) => handleStyleUpdate({ stripedColor1: color })}
              />
            </ControlField>
            <ControlField label="Fill 2">
              <ColorPicker
                color={component.style?.stripedColor2 || '#f8fafc'}
                onChange={(color) => handleStyleUpdate({ stripedColor2: color })}
              />
            </ControlField>
          </PropertyGrid>
        )}
      </div>
    </div>
  );
};
