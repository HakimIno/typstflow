import { useDesignerStore } from '@/store/designer-store';
import type { ColumnLayoutComponent } from '@/types/schema';
import { Columns, GripVertical, Minus, Plus, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import { DesignerInput } from '../../shared/DesignerInput';
import { PropertyRow, SectionHeader } from './Shared';

interface Props {
  component: ColumnLayoutComponent;
}

export function ColumnProperties({ component }: Props) {
  const updateComponent = useDesignerStore((s) => s.updateComponent);

  const handleGapChange = useCallback(
    (v: string) => {
      updateComponent(component.id, { gap: v } as any);
    },
    [component.id, updateComponent]
  );

  const handleColumnWidthChange = useCallback(
    (index: number, width: string) => {
      const newColumns = component.columns.map((col, i) =>
        i === index ? { ...col, width } : col
      );
      updateComponent(component.id, { columns: newColumns } as any);
    },
    [component.id, component.columns, updateComponent]
  );

  const handleAddColumn = useCallback(() => {
    const newColumns = [
      ...component.columns,
      { width: '1fr', components: [] },
    ];
    updateComponent(component.id, { columns: newColumns } as any);
  }, [component.id, component.columns, updateComponent]);

  const handleRemoveColumn = useCallback(
    (index: number) => {
      if (component.columns.length <= 1) return;
      const newColumns = component.columns.filter((_, i) => i !== index);
      updateComponent(component.id, { columns: newColumns } as any);
    },
    [component.id, component.columns, updateComponent]
  );

  return (
    <>
      <SectionHeader label="Column Layout" />

      {/* Gap */}
      <PropertyRow label="Gap">
        <DesignerInput
          type="text"
          variant="mini"
          value={component.gap ?? '10mm'}
          onChange={handleGapChange}
          placeholder="10mm"
          mono
        />
      </PropertyRow>

      {/* Column Widths */}
      <div className="border-t border-[var(--border-default)]">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">
            Columns ({component.columns.length})
          </span>
          <button
            type="button"
            onClick={handleAddColumn}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded transition-colors uppercase tracking-wider"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>

        <div className="px-2 pb-2 space-y-1">
          {component.columns.map((col, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 group"
            >
              <GripVertical className="w-3 h-3 text-[var(--text-muted)] opacity-30 shrink-0" />
              <div className="flex items-center gap-1 flex-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-1.5 py-1">
                <Columns className="w-3 h-3 text-[var(--accent)] opacity-60 shrink-0" />
                <span className="text-[8px] font-bold text-[var(--text-muted)] w-4 shrink-0">
                  {idx + 1}
                </span>
                <DesignerInput
                  type="text"
                  variant="mini"
                  value={col.width}
                  onChange={(v) => handleColumnWidthChange(idx, v)}
                  placeholder="1fr"
                  mono
                  className="flex-1"
                />
                <span className="text-[7px] text-[var(--text-muted)] opacity-40 shrink-0">
                  {col.components.length} items
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveColumn(idx)}
                disabled={component.columns.length <= 1}
                className="p-0.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
                title="Remove column"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Width hint */}
        <div className="px-2 pb-2">
          <p className="text-[7px] text-[var(--text-muted)] opacity-50 leading-relaxed italic">
            Widths: <code className="bg-black/20 px-1 rounded">1fr</code> (flexible),{' '}
            <code className="bg-black/20 px-1 rounded">60mm</code> (fixed),{' '}
            <code className="bg-black/20 px-1 rounded">30%</code> (relative)
          </p>
        </div>
      </div>
    </>
  );
}
