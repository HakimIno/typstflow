import { ColorPicker } from '@/components/shared/ColorPicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { useDesignerStore } from '@/store/designer-store';
import type { FillPattern, TableComponent } from '@/types/schema';
import { clsx } from 'clsx';
import { FontWeightSelect } from '../../ui/FontWeightSelect';
import { CollapsibleSection, ControlField, PropertyGrid, PROPERTY_STACK_CLASS } from '../Shared';
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

export const TableVisualSection = ({ component }: Props) => {
  const updateComponent = useDesignerStore((state) => state.updateComponent);

  const handleStyleUpdate = (updates: any) => {
    const currentStyle = component.style || {};
    updateComponent(component.id, {
      style: { ...currentStyle, ...updates },
    } as any);
  };

  return (
    <div className={`${PROPERTY_STACK_CLASS} animate-in fade-in slide-in-from-right-1 duration-200`}>
      {/* 1. Borders & Spacing */}
      <CollapsibleSection label="Borders & Spacing">
        <div className="space-y-2.5">
          {/* Outer Borders Sub-section */}
          <div className="flex justify-between items-center bg-white/[0.02] p-1 rounded border border-[var(--border-default)]">
            <span className="text-[8px] font-black uppercase text-[var(--text-muted)] pl-1">
              Outer Borders
            </span>
            <div className="flex gap-1">
              {(['top', 'bottom', 'left', 'right'] as const).map((side) => {
                const isActive = component.style?.borderSides?.[side] ?? true;
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => {
                      const current = component.style?.borderSides ?? {
                        top: true,
                        bottom: true,
                        left: true,
                        right: true,
                        innerH: true,
                        innerV: true,
                      };
                      handleStyleUpdate({ borderSides: { ...current, [side]: !isActive } });
                    }}
                    className={clsx(
                      'w-4 h-4 flex items-center justify-center rounded border text-[7px] font-bold uppercase',
                      isActive
                        ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30'
                        : 'bg-black/5 text-[var(--text-muted)] border-[var(--border-default)]'
                    )}
                  >
                    {side[0]}
                  </button>
                );
              })}
            </div>
          </div>

          <PropertyGrid cols={2}>
            <ControlField label="Border Color">
              <ColorPicker
                color={component.style?.borderColor || '#cbd5e1'}
                onChange={(color) => handleStyleUpdate({ borderColor: color })}
              />
            </ControlField>
            <ControlField label="Border Width">
              <MiniInput
                value={component.style?.borderWidth || '0.5pt'}
                onChange={(v) => handleStyleUpdate({ borderWidth: v })}
                mono
              />
            </ControlField>
          </PropertyGrid>

          {/* Body Internal Lines Sub-section */}
          <div className="flex justify-between items-center bg-white/[0.02] p-1 rounded border border-[var(--border-default)]">
            <span className="text-[8px] font-black uppercase text-[var(--text-muted)] pl-1">
              Internal Grid Lines
            </span>
            <div className="flex gap-1">
              {(['innerH', 'innerV'] as const).map((side) => {
                const isActive = component.style?.borderSides?.[side] ?? true;
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => {
                      const current = component.style?.borderSides ?? {
                        top: true,
                        bottom: true,
                        left: true,
                        right: true,
                        innerH: true,
                        innerV: true,
                      };
                      handleStyleUpdate({ borderSides: { ...current, [side]: !isActive } });
                    }}
                    className={clsx(
                      'px-1.5 h-4 flex items-center justify-center rounded border text-[7px] font-bold uppercase',
                      isActive
                        ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30'
                        : 'bg-black/5 text-[var(--text-muted)] border-[var(--border-default)]'
                    )}
                  >
                    {side === 'innerH' ? 'Rows' : 'Cols'}
                  </button>
                );
              })}
            </div>
          </div>

          <PropertyGrid cols={2}>
            <ControlField label="Horiz. Style">
              <Select
                value={component.style?.horizontalDash || 'solid'}
                onValueChange={(val) => handleStyleUpdate({ horizontalDash: val })}
              >
                <SelectTrigger className="h-6 text-[9px] bg-[var(--bg-widget)] border-[var(--border-default)] px-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid ──</SelectItem>
                  <SelectItem value="dashed">Dashed ╍╍</SelectItem>
                  <SelectItem value="dotted">Dotted ⋯⋯</SelectItem>
                </SelectContent>
              </Select>
            </ControlField>
            <ControlField label="Horiz. Color">
              <ColorPicker
                color={
                  component.style?.innerHBorderColor || component.style?.borderColor || '#cbd5e1'
                }
                onChange={(color) => handleStyleUpdate({ innerHBorderColor: color })}
              />
            </ControlField>

            <ControlField label="Vert. Style">
              <Select
                value={component.style?.verticalDash || 'solid'}
                onValueChange={(val) => handleStyleUpdate({ verticalDash: val })}
              >
                <SelectTrigger className="h-6 text-[9px] bg-[var(--bg-widget)] border-[var(--border-default)] px-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid │</SelectItem>
                  <SelectItem value="dashed">Dashed ┆</SelectItem>
                  <SelectItem value="dotted">Dotted ┊</SelectItem>
                </SelectContent>
              </Select>
            </ControlField>
            <ControlField label="Vert. Color">
              <ColorPicker
                color={
                  component.style?.innerVBorderColor || component.style?.borderColor || '#cbd5e1'
                }
                onChange={(color) => handleStyleUpdate({ innerVBorderColor: color })}
              />
            </ControlField>
          </PropertyGrid>

          <PropertyGrid cols={1}>
            <ControlField label="Cell Padding">
              <MiniInput
                value={component.style?.inset || '2mm'}
                onChange={(v) => handleStyleUpdate({ inset: v })}
                mono
                placeholder="e.g. 2mm"
              />
            </ControlField>
          </PropertyGrid>
        </div>
      </CollapsibleSection>

      {/* 2. Header Styling */}
      <CollapsibleSection label="Header Styling" defaultOpen={false}>
        <div className="space-y-2.5">
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

          <div className="bg-white/[0.02] p-1 rounded border border-[var(--border-default)]">
            <span className="text-[8px] font-black uppercase text-[var(--text-muted)] pl-1">
              Header Separator
            </span>
          </div>

          <PropertyGrid cols={2}>
            <ControlField label="Color">
              <ColorPicker
                color={
                  component.style?.headerBorderColor || component.style?.borderColor || '#cbd5e1'
                }
                onChange={(color) => handleStyleUpdate({ headerBorderColor: color })}
              />
            </ControlField>
            <ControlField label="Width">
              <MiniInput
                value={
                  component.style?.headerBorderWidth || component.style?.borderWidth || '0.5pt'
                }
                onChange={(v) => handleStyleUpdate({ headerBorderWidth: v })}
                mono
              />
            </ControlField>
            <ControlField label="Horiz. Dash">
              <Select
                value={component.style?.headerHorizontalDash || 'solid'}
                onValueChange={(val) => handleStyleUpdate({ headerHorizontalDash: val as any })}
              >
                <SelectTrigger className="h-6 text-[9px] bg-[var(--bg-widget)] border-[var(--border-default)] px-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid ──</SelectItem>
                  <SelectItem value="dashed">Dashed ╍╍</SelectItem>
                  <SelectItem value="dotted">Dotted ⋯⋯</SelectItem>
                </SelectContent>
              </Select>
            </ControlField>
            <ControlField label="Vert. Dash">
              <Select
                value={component.style?.headerVerticalDash || 'solid'}
                onValueChange={(val) => handleStyleUpdate({ headerVerticalDash: val as any })}
              >
                <SelectTrigger className="h-6 text-[9px] bg-[var(--bg-widget)] border-[var(--border-default)] px-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid │</SelectItem>
                  <SelectItem value="dashed">Dashed ┆</SelectItem>
                  <SelectItem value="dotted">Dotted ┊</SelectItem>
                </SelectContent>
              </Select>
            </ControlField>
          </PropertyGrid>
        </div>
      </CollapsibleSection>

      {/* 3. Body & Alternating Fill */}
      <CollapsibleSection label="Body Styling" defaultOpen={false}>
        <div className="space-y-2.5">
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
                suffix="pt"
              />
            </ControlField>
          </PropertyGrid>

          <div className="bg-white/[0.02] p-1 rounded border border-[var(--border-default)]">
            <span className="text-[8px] font-black uppercase text-[var(--text-muted)] pl-1">
              Alternating Fill
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {FILL_PATTERNS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.label}
                onClick={() => handleStyleUpdate({ fillPattern: p.id })}
                className={clsx(
                  'flex flex-row items-center gap-1.5 p-1 rounded border transition-all text-left group',
                  component.style?.fillPattern === p.id
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                    : 'bg-black/5 text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-black/10'
                )}
              >
                <div
                  className={clsx(
                    'w-5 h-5 rounded flex items-center justify-center shrink-0 text-[10px]',
                    component.style?.fillPattern === p.id
                      ? 'bg-white/20'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-default)]'
                  )}
                >
                  {p.preview}
                </div>
                <span className="text-[8px] font-bold uppercase tracking-tight leading-tight">
                  {p.label}
                </span>
              </button>
            ))}
          </div>

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
      </CollapsibleSection>

      {/* 4. Group Subtotal Styling */}
      <CollapsibleSection label="Subtotal Styling" defaultOpen={false}>
        <div className="space-y-2.5">
          <PropertyGrid cols={2}>
            <ControlField label="Background">
              <ColorPicker
                color={component.groupFooterStyle?.background || '#f8fafc'}
                onChange={(v) =>
                  updateComponent(component.id, {
                    groupFooterStyle: { ...component.groupFooterStyle, background: v },
                  } as any)
                }
              />
            </ControlField>
            <ControlField label="Text Color">
              <ColorPicker
                color={component.groupFooterStyle?.color || '#000000'}
                onChange={(v) =>
                  updateComponent(component.id, {
                    groupFooterStyle: { ...component.groupFooterStyle, color: v },
                  } as any)
                }
              />
            </ControlField>
            <ControlField label="Font Size">
              <MiniInput
                value={String(component.groupFooterStyle?.fontSize || 9)}
                onChange={(v) =>
                  updateComponent(component.id, {
                    groupFooterStyle: {
                      ...component.groupFooterStyle,
                      fontSize: Number.parseFloat(v),
                    },
                  } as any)
                }
                mono
              />
            </ControlField>
            <ControlField label="Bold">
              <button
                type="button"
                onClick={() =>
                  updateComponent(component.id, {
                    groupFooterStyle: {
                      ...component.groupFooterStyle,
                      fontWeight:
                        component.groupFooterStyle?.fontWeight === 'bold' ? 'normal' : 'bold',
                    },
                  } as any)
                }
                className={clsx(
                  'h-6 w-full border rounded text-[9px] font-bold transition-colors',
                  component.groupFooterStyle?.fontWeight === 'bold'
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                    : 'border-[var(--border-default)] hover:bg-[var(--bg-widget)] bg-[var(--bg-surface)]'
                )}
              >
                Bold
              </button>
            </ControlField>
          </PropertyGrid>
        </div>
      </CollapsibleSection>
    </div>
  );
};
