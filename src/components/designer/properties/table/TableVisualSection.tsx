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
import { useState } from 'react';
import { FontWeightSelect } from '../../ui/FontWeightSelect';
import {
  CollapsibleSection,
  ControlField,
  PROPERTY_STACK_CLASS,
  PropertyGrid,
  SegmentedControl,
} from '../Shared';
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

const STYLE_TABS = [
  { value: 'header' as const, label: 'Header' },
  { value: 'body' as const, label: 'Body' },
  { value: 'subtotal' as const, label: 'Subtotal' },
];

export const TableVisualSection = ({ component }: Props) => {
  const [styleSection, setStyleSection] = useState<'header' | 'body' | 'subtotal'>('header');
  const updateComponent = useDesignerStore((state) => state.updateComponent);

  const handleStyleUpdate = (updates: any) => {
    const currentStyle = component.style || {};
    updateComponent(component.id, {
      style: { ...currentStyle, ...updates },
    } as any);
  };

  return (
    <div
      className={`${PROPERTY_STACK_CLASS} animate-in fade-in slide-in-from-right-1 duration-200`}
    >
      {/* 1. Borders & Spacing */}
      <CollapsibleSection label="Grid & Borders">
        <div className="space-y-2.5">
          {/* Outer Borders Sub-section */}
          <div className="flex justify-between items-center bg-white/[0.02] p-1.5 rounded border border-[var(--border-default)]">
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
                      'w-4 h-4 flex items-center justify-center rounded border text-[7px] font-bold uppercase transition-all',
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
          <div className="flex justify-between items-center bg-white/[0.02] p-1.5 rounded border border-[var(--border-default)]">
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
                      'px-1.5 h-4 flex items-center justify-center rounded border text-[7px] font-bold uppercase transition-all',
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

      {/* 2. Unified Row Styles */}
      <CollapsibleSection label="Styles by Section">
        <div className="space-y-3">
          <SegmentedControl value={styleSection} onChange={setStyleSection} options={STYLE_TABS} />

          {/* Header styling panel */}
          {styleSection === 'header' && (
            <div className="space-y-2.5 animate-in fade-in duration-200">
              <PropertyGrid cols={2}>
                <ControlField label="Fill Color">
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
                <ControlField label="Font Size">
                  <MiniInput
                    type="number"
                    value={component.style?.headerFontSize || 10}
                    onChange={(v) =>
                      handleStyleUpdate({ headerFontSize: Number.parseInt(v) || 10 })
                    }
                    suffix="pt"
                  />
                </ControlField>
                <ControlField label="Font Weight">
                  <FontWeightSelect
                    value={component.style?.headerFontWeight}
                    onChange={(v: string) => handleStyleUpdate({ headerFontWeight: v })}
                  />
                </ControlField>
              </PropertyGrid>

              <div className="bg-white/[0.02] p-1.5 rounded border border-[var(--border-default)] flex items-center justify-between">
                <span className="text-[8px] font-black uppercase text-[var(--text-muted)] pl-1">
                  Header Separator
                </span>
              </div>

              <PropertyGrid cols={2}>
                <ControlField label="Border Color">
                  <ColorPicker
                    color={
                      component.style?.headerBorderColor ||
                      component.style?.borderColor ||
                      '#cbd5e1'
                    }
                    onChange={(color) => handleStyleUpdate({ headerBorderColor: color })}
                  />
                </ControlField>
                <ControlField label="Border Width">
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
          )}

          {/* Body styling panel */}
          {styleSection === 'body' && (
            <div className="space-y-2.5 animate-in fade-in duration-200">
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

              <PropertyGrid cols={1}>
                <ControlField label="Fill Pattern">
                  <Select
                    value={component.style?.fillPattern || 'none'}
                    onValueChange={(val) => handleStyleUpdate({ fillPattern: val })}
                  >
                    <SelectTrigger className="h-6 text-[9px] bg-[var(--bg-widget)] border-[var(--border-default)] px-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILL_PATTERNS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.preview} {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ControlField>
              </PropertyGrid>

              {component.style?.fillPattern && component.style?.fillPattern !== 'none' && (
                <PropertyGrid cols={2} className="animate-in slide-in-from-top-1 duration-200">
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
          )}

          {/* Subtotal styling panel */}
          {styleSection === 'subtotal' && (
            <div className="space-y-2.5 animate-in fade-in duration-200">
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
                <ControlField label="Font Weight">
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
                        : 'border-[var(--border-default)] hover:bg-[var(--bg-widget)] bg-[var(--bg-surface)] text-[var(--text-muted)]'
                    )}
                  >
                    Bold
                  </button>
                </ControlField>
              </PropertyGrid>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
};
