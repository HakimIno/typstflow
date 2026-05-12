import { useDesignerStore } from '@/store/designer-store';
import type { TableComponent } from '@/types/schema';
import { Minus, Plus } from 'lucide-react';
import { PropertyRow, SectionHeader } from '../Shared';
import { MiniInput } from './TableShared';
import { DesignerToggle } from '@/components/shared/DesignerToggle';
import { ColorPicker } from '@/components/shared/ColorPicker';

interface Props {
  component: TableComponent;
}

export const TableDataSection = ({ component }: Props) => {
  const updateComponent = useDesignerStore((state) => state.updateComponent);

  return (
    <div className="bg-[var(--bg-widget)] animate-in fade-in duration-200">
      <section>
        <SectionHeader label="Data Source & Behavior" />
        <div className="space-y-1.5 px-2 pb-2">
          <PropertyRow label="Data Source">
            <MiniInput
              value={component.dataSource || ''}
              onChange={(v) => updateComponent(component.id, { dataSource: v } as any)}
              placeholder="{{items}}"
              mono
              className="w-full h-7"
            />
          </PropertyRow>
          <PropertyRow label="Repeat Header">
            <DesignerToggle
              value={component.repeatHeaderOnPage}
              onChange={(v) => updateComponent(component.id, { repeatHeaderOnPage: v })}
            />
          </PropertyRow>
        </div>
      </section>

      <section>
        <SectionHeader label="Data Grouping" />
        <div className="space-y-1.5 px-2 pb-2 bg-[var(--bg-widget)] rounded">
          <PropertyRow label="Group By Field">
            <MiniInput
              value={component.groupBy || ''}
              onChange={(v) => updateComponent(component.id, { groupBy: v } as any)}
              placeholder="e.g. department"
              mono
              className="w-full h-7"
            />
          </PropertyRow>
          <PropertyRow label="Header Format">
            <MiniInput
              value={component.groupHeaderFormat || ''}
              onChange={(v) => updateComponent(component.id, { groupHeaderFormat: v } as any)}
              placeholder="แผนก: {{department}}"
              className="w-full h-7"
            />
          </PropertyRow>

          <div className="pt-2 mt-2 border-t border-[var(--border-default)]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 block">Group Header Styling</span>

            <PropertyRow label="Background">
              <div className="flex items-center gap-2 w-full">
                <ColorPicker
                  color={component.groupHeaderStyle?.background || '#f1f5f9'}
                  onChange={(v) => {
                    const s = component.groupHeaderStyle || {};
                    updateComponent(component.id, { groupHeaderStyle: { ...s, background: v } } as any);
                  }}
                  className="!w-auto"
                />
              </div>
            </PropertyRow>

            <div className="grid grid-cols-1 gap-2 mt-2">
              <PropertyRow label="Text Color">
                <div className="flex items-center gap-1.5">
                  <ColorPicker
                    color={component.groupHeaderStyle?.color || '#000000'}
                    onChange={(v) => {
                      const s = component.groupHeaderStyle || {};
                      updateComponent(component.id, { groupHeaderStyle: { ...s, color: v } } as any);
                    }}
                    className="!w-auto"
                  />
                </div>
              </PropertyRow>
              <PropertyRow label="Font Size">
                <MiniInput
                  type="number"
                  value={component.groupHeaderStyle?.fontSize || 9}
                  onChange={(v) => {
                    const s = component.groupHeaderStyle || {};
                    updateComponent(component.id, { groupHeaderStyle: { ...s, fontSize: Number.parseInt(v) || 9 } } as any);
                  }}
                  className="w-full h-7"
                />
              </PropertyRow>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader label="Summary Totals" />
        <div className="space-y-1 px-2 pb-2">
          {(component.summaryRows || []).map((row, idx) => (
            <div key={idx} className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded p-1.5 shadow-sm">
              <MiniInput
                value={row.label}
                onChange={(v) => {
                  const rows = [...(component.summaryRows || [])];
                  rows[idx].label = v;
                  updateComponent(component.id, { summaryRows: rows } as any);
                }}
                placeholder="Label"
                className="w-20 h-6"
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
                className="flex-1 h-6"
              />
              <button
                onClick={() => {
                  const rows = (component.summaryRows || []).filter((_, i) => i !== idx);
                  updateComponent(component.id, { summaryRows: rows } as any);
                }}
                className="p-1 text-red-500 hover:bg-red-500/10 rounded"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const rows = [...(component.summaryRows || []), { label: '', value: '', separator: false }];
              updateComponent(component.id, { summaryRows: rows } as any);
            }}
            className="w-full py-1 text-[9px] font-bold border border-dashed border-[var(--border-default)] rounded text-[var(--text-muted)] flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add Summary
          </button>
        </div>
      </section>
    </div>
  );
};
