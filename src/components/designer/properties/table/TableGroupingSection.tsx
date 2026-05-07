import { useDesignerStore } from '@/store/designer-store';
import type { TableComponent } from '@/types/schema';
import { PropertyRow, SectionHeader } from '../Shared';
import { MiniInput } from './TableShared';
import { ColorPicker } from '@/components/shared/ColorPicker';

interface Props {
  component: TableComponent;
}

export const TableGroupingSection = ({ component }: Props) => {
  const updateComponent = useDesignerStore((state) => state.updateComponent);

  return (
    <div className="animate-in fade-in duration-200">
      <SectionHeader label="Data Grouping" />
      <div className="p-2 space-y-1 bg-[var(--bg-widget)] rounded">
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
    </div>
  );
};
