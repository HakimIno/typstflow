import { ColorPicker } from '@/components/shared/ColorPicker';
import { DesignerToggle } from '@/components/shared/DesignerToggle';
import { useDesignerStore } from '@/store/designer-store';
import type { TableComponent } from '@/types/schema';
import { clsx } from 'clsx';
import { AlignCenter, AlignLeft, AlignRight, Italic, Minus, Plus, Underline } from 'lucide-react';
import { VariablePicker } from '../../VariablePicker';
import { FontWeightSelect } from '../../ui/FontWeightSelect';
import { CollapsibleSection, ControlField, PropertyGrid } from '../Shared';
import { MiniInput } from './TableShared';

interface Props {
  component: TableComponent;
}

export const TableDataSection = ({ component }: Props) => {
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const sampleData = useDesignerStore((state) => state.sampleData);
  const groupHeaderStyle = component.groupHeaderStyle || {};

  return (
    <div className="bg-[var(--bg-widget)] animate-in fade-in duration-200 divide-y divide-[var(--border-default)]">
      <CollapsibleSection label="Data Source & Behavior">
        <div className="space-y-3">
          <ControlField label="Data Path">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 w-full">
              <MiniInput
                value={component.dataSource || ''}
                onChange={(v) => updateComponent(component.id, { dataSource: v } as any)}
                placeholder="{{items}}"
                mono
                className="w-full h-8"
              />
              <VariablePicker
                sampleData={sampleData}
                onSelect={(_path, binding) =>
                  updateComponent(component.id, { dataSource: binding } as any)
                }
              />
            </div>
          </ControlField>

          <div className="flex items-center justify-between rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-2">
            <div className="min-w-0">
              <div className="text-[9px] font-bold text-[var(--text-secondary)]">Repeat Header</div>
              <div className="text-[8px] text-[var(--text-muted)]">
                Repeat table header on page breaks
              </div>
            </div>
            <DesignerToggle
              value={component.repeatHeaderOnPage}
              onChange={(v) => updateComponent(component.id, { repeatHeaderOnPage: v })}
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="Data Grouping" defaultOpen={false}>
        <div className="space-y-4">
          <PropertyGrid cols={1} className="gap-3">
            <ControlField label="Group By">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 w-full">
                <MiniInput
                  value={component.groupBy || ''}
                  onChange={(v) => updateComponent(component.id, { groupBy: v } as any)}
                  placeholder="department"
                  mono
                  className="w-full h-8"
                />
                <VariablePicker
                  sampleData={sampleData}
                  onSelect={(_path, binding) =>
                    updateComponent(component.id, { groupBy: binding } as any)
                  }
                />
              </div>
            </ControlField>
            <ControlField label="Header Text">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 w-full">
                <MiniInput
                  value={component.groupHeaderFormat || ''}
                  onChange={(v) => updateComponent(component.id, { groupHeaderFormat: v } as any)}
                  placeholder="Group: {{department}}"
                  className="w-full h-8"
                />
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

          <div className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <div className="px-2.5 py-2 border-b border-[var(--border-default)]">
              <span className="text-[8px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Group Header Style
              </span>
            </div>
            <PropertyGrid cols={2} className="p-2.5">
              <ControlField label="Background">
                <ColorPicker
                  color={groupHeaderStyle.background || '#f1f5f9'}
                  onChange={(v) => {
                    updateComponent(component.id, {
                      groupHeaderStyle: { ...groupHeaderStyle, background: v },
                    } as any);
                  }}
                />
              </ControlField>
              <ControlField label="Text Color">
                <ColorPicker
                  color={groupHeaderStyle.color || '#000000'}
                  onChange={(v) => {
                    updateComponent(component.id, {
                      groupHeaderStyle: { ...groupHeaderStyle, color: v },
                    } as any);
                  }}
                />
              </ControlField>
              <ControlField label="Size">
                <MiniInput
                  type="number"
                  value={groupHeaderStyle.fontSize || 9}
                  onChange={(v) => {
                    updateComponent(component.id, {
                      groupHeaderStyle: { ...groupHeaderStyle, fontSize: Number.parseInt(v) || 9 },
                    } as any);
                  }}
                  className="w-full h-8"
                />
              </ControlField>
              <ControlField label="Weight">
                <FontWeightSelect
                  value={groupHeaderStyle.fontWeight || 'bold'}
                  onChange={(v) => {
                    updateComponent(component.id, {
                      groupHeaderStyle: { ...groupHeaderStyle, fontWeight: v },
                    } as any);
                  }}
                  className="w-full h-8 text-[10px] bg-[var(--bg-widget)] border-[var(--border-default)]"
                />
              </ControlField>

              <ControlField label="Format" className="col-span-1">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      updateComponent(component.id, {
                        groupHeaderStyle: { ...groupHeaderStyle, italic: !groupHeaderStyle.italic },
                      } as any);
                    }}
                    className={clsx(
                      'flex-1 h-8 flex items-center justify-center rounded border transition-all',
                      groupHeaderStyle.italic
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:bg-white/5'
                    )}
                  >
                    <Italic className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateComponent(component.id, {
                        groupHeaderStyle: {
                          ...groupHeaderStyle,
                          underline: !groupHeaderStyle.underline,
                        },
                      } as any);
                    }}
                    className={clsx(
                      'flex-1 h-8 flex items-center justify-center rounded border transition-all',
                      groupHeaderStyle.underline
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:bg-white/5'
                    )}
                  >
                    <Underline className="w-3 h-3" />
                  </button>
                </div>
              </ControlField>

              <ControlField label="Align" className="col-span-1">
                <div className="flex border border-[var(--border-default)] rounded overflow-hidden h-8 bg-[var(--bg-widget)]">
                  {(['left', 'center', 'right'] as const).map((align) => {
                    const Icon =
                      align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
                    return (
                      <button
                        type="button"
                        key={align}
                        onClick={() => {
                          updateComponent(component.id, {
                            groupHeaderStyle: { ...groupHeaderStyle, align },
                          } as any);
                        }}
                        className={clsx(
                          'flex-1 flex items-center justify-center transition-colors',
                          (groupHeaderStyle.align || 'left') === align
                            ? 'bg-[var(--accent)] text-white'
                            : 'text-[var(--text-muted)] hover:bg-white/5'
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    );
                  })}
                </div>
              </ControlField>
            </PropertyGrid>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="Summaries & Totals" defaultOpen={false}>
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-2">
              <div>
                <div className="text-[9px] font-bold text-[var(--text-secondary)]">
                  Auto Subtotal
                </div>
                <div className="text-[8px] text-[var(--text-muted)]">
                  Add subtotal row for each group
                </div>
              </div>
              <DesignerToggle
                value={!!component.autoGroupFooter}
                onChange={(v) => updateComponent(component.id, { autoGroupFooter: v } as any)}
              />
            </div>

            {component.autoGroupFooter && (
              <ControlField label="Footer Label">
                <MiniInput
                  value={component.autoGroupFooterLabel ?? 'Subtotal'}
                  onChange={(v) =>
                    updateComponent(component.id, { autoGroupFooterLabel: v } as any)
                  }
                  placeholder="Subtotal"
                  className="w-full h-8"
                />
              </ControlField>
            )}

            <div className="flex items-center justify-between rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 py-2">
              <div>
                <div className="text-[9px] font-bold text-[var(--text-secondary)]">
                  Repeat Notes
                </div>
                <div className="text-[8px] text-[var(--text-muted)]">
                  Render summary rows per group
                </div>
              </div>
              <DesignerToggle
                value={component.repeatSummaryOnGroup || false}
                onChange={(v) => updateComponent(component.id, { repeatSummaryOnGroup: v } as any)}
              />
            </div>
          </div>

          <div className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-2.5 py-2 border-b border-[var(--border-default)]">
              <span className="text-[8px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Manual Summary Rows
              </span>
            </div>
            <div className="p-2.5 space-y-2">
              {(component.summaryRows || []).map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 group/row animate-in fade-in slide-in-from-left-2"
                >
                  <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
                    <MiniInput
                      value={row.label}
                      onChange={(v) => {
                        const rows = [...(component.summaryRows || [])];
                        rows[idx].label = v;
                        updateComponent(component.id, { summaryRows: rows } as any);
                      }}
                      placeholder="Label"
                      className="h-8 bg-[var(--bg-widget)] px-2"
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
                      className="h-8 bg-[var(--bg-widget)] px-2"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const rows = (component.summaryRows || []).filter((_, i) => i !== idx);
                      updateComponent(component.id, { summaryRows: rows } as any);
                    }}
                    className="w-8 h-8 flex items-center justify-center text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const rows = [
                    ...(component.summaryRows || []),
                    { label: '', value: '', separator: false },
                  ];
                  updateComponent(component.id, { summaryRows: rows } as any);
                }}
                className="w-full h-9 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] border border-dashed border-[var(--border-default)] rounded text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add Summary
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
};
