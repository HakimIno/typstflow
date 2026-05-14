import { Plus, Trash2 } from 'lucide-react';
import { DesignerInput } from '../../shared/DesignerInput';
import { SectionHeader } from './Shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';

interface SummaryBoxPropertiesProps {
  component: any;
  onUpdate: (updates: any) => void;
}

export function SummaryBoxProperties({ component, onUpdate }: SummaryBoxPropertiesProps) {
  const rows = component.rows || [];

  const updateRow = (idx: number, updates: any) => {
    const newRows = [...rows];
    newRows[idx] = { ...newRows[idx], ...updates };
    onUpdate({ rows: newRows });
  };

  const addRow = () => {
    onUpdate({
      rows: [...rows, { label: 'New Label', value: '$0.00', style: 'normal' }],
    });
  };

  const removeRow = (idx: number) => {
    onUpdate({
      rows: rows.filter((_: any, i: number) => i !== idx),
    });
  };

  return (
    <section>
      <SectionHeader label="Summary Data" />
      <div className="p-2 space-y-2">
        {rows.map((row: any, idx: number) => (
          <div
            key={idx}
            className="bg-[var(--bg-widget)] border border-[var(--border-default)] rounded p-2 space-y-2 group/row relative"
          >
            <button
              type="button"
              onClick={() => removeRow(idx)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity shadow-sm z-10"
            >
              <Trash2 className="w-3 h-3" />
            </button>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                  Label
                </span>
                <DesignerInput
                  type="text"
                  value={row.label}
                  onChange={(v) => updateRow(idx, { label: v })}
                  placeholder="Label"
                />
              </div>
              <div className="space-y-0.5">
                <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                  Value
                </span>
                <DesignerInput
                  type="text"
                  value={row.value}
                  onChange={(v) => updateRow(idx, { value: v })}
                  placeholder="{{total}}"
                  mono
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">Style</span>
              <Select
                value={row.style || 'normal'}
                onValueChange={(val) => updateRow(idx, { style: val })}
              >
                <SelectTrigger className="flex-1 h-6 text-[10px] bg-[var(--bg-surface)] border-[var(--border-default)] px-1 py-0.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="subtotal">Subtotal</SelectItem>
                  <SelectItem value="total">Grand Total</SelectItem>
                  <SelectItem value="highlight">Highlight</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="w-full py-1.5 border border-dashed border-[var(--border-default)] rounded text-[9px] font-bold uppercase text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all flex items-center justify-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add Row
        </button>
      </div>
    </section>
  );
}
