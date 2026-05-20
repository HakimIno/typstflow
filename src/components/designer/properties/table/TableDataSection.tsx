import { ColorPicker } from '@/components/shared/ColorPicker';
import { DesignerToggle } from '@/components/shared/DesignerToggle';
import { useDesignerStore } from '@/store/designer-store';
import type { TableComponent } from '@/types/schema';
import { clsx } from 'clsx';
import { AlignCenter, AlignLeft, AlignRight, Italic, Minus, Plus, Underline } from 'lucide-react';
import { FontWeightSelect } from '../../ui/FontWeightSelect';
import { CollapsibleSection, ControlField, PropertyGrid } from '../Shared';
import { VariablePicker } from '../../VariablePicker';
import { MiniInput } from './TableShared';

interface Props {
  component: TableComponent;
}

export const TableDataSection = ({ component }: Props) => {
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const sampleData = useDesignerStore((state) => state.sampleData);

  return (
    <div className="bg-[var(--bg-widget)] animate-in fade-in duration-200">
      {/* 1. DATA SOURCE SECTION */}
      <CollapsibleSection label="Data Source & Behavior">
        <div className="p-0.5 space-y-px bg-[var(--border-default)]">
          <PropertyGrid cols={1}>
            <ControlField label="Data Path">
              <div className="flex items-center gap-1.5 w-full">
                <div className="flex-1">
                  <MiniInput
                    value={component.dataSource || ''}
                    onChange={(v) => updateComponent(component.id, { dataSource: v } as any)}
                    placeholder="{{items}}"
                    mono
                    className="w-full h-7"
                  />
                </div>
                <VariablePicker
                  sampleData={sampleData}
                  onSelect={(_path, binding) =>
                    updateComponent(component.id, { dataSource: binding } as any)
                  }
                />
              </div>
            </ControlField>
            <ControlField label="Repeat Header">
              <div className="flex justify-end w-full">
                <DesignerToggle
                  value={component.repeatHeaderOnPage}
                  onChange={(v) => updateComponent(component.id, { repeatHeaderOnPage: v })}
                />
              </div>
            </ControlField>
          </PropertyGrid>
        </div>
      </CollapsibleSection>

      {/* 2. GROUPING SECTION */}
      <CollapsibleSection label="Data Grouping" defaultOpen={false}>
        <div className="p-0.5 space-y-px bg-[var(--border-default)]">
          <PropertyGrid cols={2}>
            <ControlField label="Group By">
              <div className="flex items-center gap-1.5 w-full">
                <div className="flex-1">
                  <MiniInput
                    value={component.groupBy || ''}
                    onChange={(v) => updateComponent(component.id, { groupBy: v } as any)}
                    placeholder="e.g. department"
                    mono
                    className="w-full h-7"
                  />
                </div>
                <VariablePicker
                  sampleData={sampleData}
                  onSelect={(_path, binding) =>
                    updateComponent(component.id, { groupBy: binding } as any)
                  }
                />
              </div>
            </ControlField>
            <ControlField label="Header Text">
              <div className="flex items-center gap-1.5 w-full">
                <div className="flex-1">
                  <MiniInput
                    value={component.groupHeaderFormat || ''}
                    onChange={(v) => updateComponent(component.id, { groupHeaderFormat: v } as any)}
                    placeholder="แผนก: {{department}}"
                    className="w-full h-7"
                  />
                </div>
                <VariablePicker
                  sampleData={sampleData}
                  onSelect={(_path, binding) => {
                    const format = component.groupHeaderFormat || '';
                    updateComponent(component.id, { groupHeaderFormat: format + binding } as any);
                  }}
                />
              </div>
            </ControlField>
          </PropertyGrid>

          {/* Group Header Styling Sub-section */}
          <div className="bg-[var(--bg-surface)] px-2 py-1.5 border-b border-[var(--border-default)]">
            <span className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Group Header Style
            </span>
          </div>

          <PropertyGrid cols={2}>
            <ControlField label="Background">
              <ColorPicker
                color={component.groupHeaderStyle?.background || '#f1f5f9'}
                onChange={(v) => {
                  const s = component.groupHeaderStyle || {};
                  updateComponent(component.id, {
                    groupHeaderStyle: { ...s, background: v },
                  } as any);
                }}
              />
            </ControlField>
            <ControlField label="Text Color">
              <ColorPicker
                color={component.groupHeaderStyle?.color || '#000000'}
                onChange={(v) => {
                  const s = component.groupHeaderStyle || {};
                  updateComponent(component.id, { groupHeaderStyle: { ...s, color: v } } as any);
                }}
              />
            </ControlField>
            <ControlField label="Size">
              <MiniInput
                type="number"
                value={component.groupHeaderStyle?.fontSize || 9}
                onChange={(v) => {
                  const s = component.groupHeaderStyle || {};
                  updateComponent(component.id, {
                    groupHeaderStyle: { ...s, fontSize: Number.parseInt(v) || 9 },
                  } as any);
                }}
                className="w-full h-7"
              />
            </ControlField>
            <ControlField label="Weight">
              <FontWeightSelect
                value={component.groupHeaderStyle?.fontWeight || 'bold'}
                onChange={(v) => {
                  const s = component.groupHeaderStyle || {};
                  updateComponent(component.id, {
                    groupHeaderStyle: { ...s, fontWeight: v },
                  } as any);
                }}
              />
            </ControlField>

            {/* Typography Toggles */}
            <ControlField label="Format" className="col-span-1">
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    const s = component.groupHeaderStyle || {};
                    updateComponent(component.id, {
                      groupHeaderStyle: { ...s, italic: !s.italic },
                    } as any);
                  }}
                  className={clsx(
                    'flex-1 h-7 flex items-center justify-center rounded border transition-all',
                    component.groupHeaderStyle?.italic
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] '
                  )}
                >
                  <Italic className="w-3 h-3" />
                </button>
                <button
                  onClick={() => {
                    const s = component.groupHeaderStyle || {};
                    updateComponent(component.id, {
                      groupHeaderStyle: { ...s, underline: !s.underline },
                    } as any);
                  }}
                  className={clsx(
                    'flex-1 h-7 flex items-center justify-center rounded border transition-all',
                    component.groupHeaderStyle?.underline
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] '
                  )}
                >
                  <Underline className="w-3 h-3" />
                </button>
              </div>
            </ControlField>

            {/* Alignment Toggles */}
            <ControlField label="Align" className="col-span-1">
              <div className="flex border border-[var(--border-default)] rounded overflow-hidden h-6 bg-[var(--bg-widget)]">
                {(['left', 'center', 'right'] as const).map((align) => {
                  const Icon =
                    align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
                  return (
                    <button
                      key={align}
                      onClick={() => {
                        const s = component.groupHeaderStyle || {};
                        updateComponent(component.id, { groupHeaderStyle: { ...s, align } } as any);
                      }}
                      className={clsx(
                        'flex-1 flex items-center justify-center transition-colors',
                        (component.groupHeaderStyle?.align || 'left') === align
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--text-muted)] '
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </ControlField>
          </PropertyGrid>
        </div>
      </CollapsibleSection>

      {/* 3. SUMMARY SECTION */}
      <CollapsibleSection label="Summaries & Totals" defaultOpen={false}>
        <div className="p-0.5 space-y-px bg-[var(--border-default)]">
          {/* Toggles */}
          <PropertyGrid cols={1}>
            <ControlField label="Auto Subtotal">
              <div className="flex justify-end w-full">
                <DesignerToggle
                  value={!!component.autoGroupFooter}
                  onChange={(v) => updateComponent(component.id, { autoGroupFooter: v } as any)}
                />
              </div>
            </ControlField>

            {component.autoGroupFooter && (
              <ControlField label="Footer Label">
                <MiniInput
                  value={component.autoGroupFooterLabel ?? 'Subtotal'}
                  onChange={(v) =>
                    updateComponent(component.id, { autoGroupFooterLabel: v } as any)
                  }
                  placeholder="Subtotal"
                  className="w-full h-7"
                />
              </ControlField>
            )}

            <ControlField label="Repeat Notes">
              <div className="flex justify-end w-full">
                <DesignerToggle
                  value={component.repeatSummaryOnGroup || false}
                  onChange={(v) =>
                    updateComponent(component.id, { repeatSummaryOnGroup: v } as any)
                  }
                />
              </div>
            </ControlField>
          </PropertyGrid>

          {/* Manual Summary Rows */}
          <div className="bg-[var(--bg-surface)] px-2 py-1.5 border-b border-[var(--border-default)]">
            <span className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Manual Summary Rows
            </span>
          </div>

          <div className="bg-[var(--bg-surface)] p-2 space-y-1.5">
            {(component.summaryRows || []).map((row, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 group/row animate-in fade-in slide-in-from-left-2"
              >
                <div className="flex-1 grid grid-cols-[80px_1fr] gap-px bg-[var(--border-default)] border border-[var(--border-default)] rounded overflow-hidden shadow-sm">
                  <MiniInput
                    value={row.label}
                    onChange={(v) => {
                      const rows = [...(component.summaryRows || [])];
                      rows[idx].label = v;
                      updateComponent(component.id, { summaryRows: rows } as any);
                    }}
                    placeholder="Label"
                    className="h-7 border-none bg-[var(--bg-widget)] px-2 rounded-none"
                  />
                  <MiniInput
                    value={row.value}
                    onChange={(v) => {
                      const rows = [...(component.summaryRows || [])];
                      rows[idx].value = v;
                      updateComponent(component.id, { summaryRows: rows } as any);
                    }}
                    placeholder="{{total}}"
                    mono
                    className="h-7 border-none bg-[var(--bg-widget)] px-2 rounded-none"
                  />
                </div>
                <button
                  onClick={() => {
                    const rows = (component.summaryRows || []).filter((_, i) => i !== idx);
                    updateComponent(component.id, { summaryRows: rows } as any);
                  }}
                  className="w-7 h-7 flex items-center justify-center text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <button
              onClick={() => {
                const rows = [
                  ...(component.summaryRows || []),
                  { label: '', value: '', separator: false },
                ];
                updateComponent(component.id, { summaryRows: rows } as any);
              }}
              className="w-full h-8 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest border border-dashed border-[var(--border-default)] rounded text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all mt-2"
            >
              <Plus className="w-3.5 h-3.5" /> Add Summary
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
};
