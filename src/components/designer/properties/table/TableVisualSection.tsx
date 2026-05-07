import { useDesignerStore } from '@/store/designer-store';
import type { FillPattern, TableComponent } from '@/types/schema';
import { clsx } from 'clsx';
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
    <div className="space-y-4 animate-in fade-in duration-200">
      <SectionHeader label="Visual Styling" />
      <div className="p-3 space-y-3 bg-[var(--bg-widget)] rounded-lg border border-[var(--border-default)]">
        <PropertyRow label="Table Layout">
          <div className="grid grid-cols-2 gap-2 w-full">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-[var(--text-muted)]">Border Color</span>
              <div className="flex items-center gap-1.5">
                <input 
                  type="color" 
                  value={component.style?.borderColor || '#e2e8f0'}
                  onChange={(e) => handleStyleUpdate({ borderColor: e.target.value })}
                  className="w-4 h-4 rounded-sm border-0 p-0 bg-transparent cursor-pointer"
                />
                <MiniInput
                  value={component.style?.borderColor || '#e2e8f0'}
                  onChange={(v) => handleStyleUpdate({ borderColor: v })}
                  className="flex-1 h-6"
                  mono
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-[var(--text-muted)]">Border Width</span>
              <MiniInput
                value={component.style?.borderWidth || '0.2mm'}
                onChange={(v) => handleStyleUpdate({ borderWidth: v })}
                className="w-full h-6"
                mono
              />
            </div>
          </div>
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
           <div className="grid grid-cols-2 gap-2 mt-2 p-2 rounded bg-white/[0.02] border border-[var(--border-default)]">
              <div className="flex flex-col gap-1">
                <span className="text-[8px] text-[var(--text-muted)] uppercase">Color 1</span>
                <div className="flex items-center gap-1">
                  <input 
                    type="color" 
                    value={component.style?.stripedColor1 || '#ffffff'}
                    onChange={(e) => handleStyleUpdate({ stripedColor1: e.target.value })}
                    className="w-4 h-4 rounded-sm"
                  />
                  <MiniInput
                    value={component.style?.stripedColor1 || '#ffffff'}
                    onChange={(v) => handleStyleUpdate({ stripedColor1: v })}
                    className="flex-1 h-6 text-[9px]"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[8px] text-[var(--text-muted)] uppercase">Color 2</span>
                <div className="flex items-center gap-1">
                  <input 
                    type="color" 
                    value={component.style?.stripedColor2 || '#f8fafc'}
                    onChange={(e) => handleStyleUpdate({ stripedColor2: e.target.value })}
                    className="w-4 h-4 rounded-sm"
                  />
                  <MiniInput
                    value={component.style?.stripedColor2 || '#f8fafc'}
                    onChange={(v) => handleStyleUpdate({ stripedColor2: v })}
                    className="flex-1 h-6 text-[9px]"
                  />
                </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};
