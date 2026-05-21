import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { useDesignerStore } from '@/store/designer-store';
import type { TableComponent } from '@/types/schema';
import { Minus } from 'lucide-react';
import { InsetSection, PANEL_SELECT_TRIGGER } from '../Shared';
import { AddRowButton, MiniInput, TABLE_FIELD_STACK } from './TableShared';

interface Props {
  component: TableComponent;
}

const LineRowEditor = ({
  axis,
  position,
  stroke,
  dash,
  onPositionChange,
  onStrokeChange,
  onDashChange,
  onRemove,
}: {
  axis: 'x' | 'y';
  position: number;
  stroke: string;
  dash: string;
  onPositionChange: (v: number) => void;
  onStrokeChange: (v: string) => void;
  onDashChange: (v: string) => void;
  onRemove: () => void;
}) => (
  <div className="flex items-center gap-1 min-w-0">
    <span className="text-[8px] font-bold text-[var(--text-muted)] w-3 uppercase">{axis}</span>
    <MiniInput
      type="number"
      value={position}
      onChange={(v) => onPositionChange(Number.parseInt(v) || 0)}
      className="w-10 shrink-0"
    />
    <MiniInput
      value={stroke}
      onChange={onStrokeChange}
      placeholder="0.2pt"
      mono
      className="flex-1 min-w-0"
    />
    <Select value={dash} onValueChange={onDashChange}>
      <SelectTrigger className={`${PANEL_SELECT_TRIGGER} w-9 shrink-0 px-0.5`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="solid">{axis === 'y' ? '─' : '│'}</SelectItem>
        <SelectItem value="dashed">{axis === 'y' ? '╍' : '┆'}</SelectItem>
        <SelectItem value="dotted">{axis === 'y' ? '⋯' : '┊'}</SelectItem>
      </SelectContent>
    </Select>
    <button
      type="button"
      onClick={onRemove}
      className="w-5 h-5 shrink-0 flex items-center justify-center text-red-500/50 hover:text-red-500 rounded-[3px]"
      title="Remove line"
    >
      <Minus className="w-3 h-3" />
    </button>
  </div>
);

export const TableGuideLinesPanel = ({ component }: Props) => {
  const updateComponent = useDesignerStore((state) => state.updateComponent);

  return (
    <div className={TABLE_FIELD_STACK}>
      <InsetSection label="Horizontal" contentClassName="space-y-1">
        {(component.hlines || []).map((line, idx) => (
          <LineRowEditor
            key={line.id ?? idx}
            axis="y"
            position={line.y}
            stroke={String(line.stroke)}
            dash={(line as { dash?: string }).dash || 'solid'}
            onPositionChange={(y) => {
              const lines = [...(component.hlines || [])];
              lines[idx] = { ...lines[idx], y };
              updateComponent(component.id, { hlines: lines } as Partial<TableComponent>);
            }}
            onStrokeChange={(stroke) => {
              const lines = [...(component.hlines || [])];
              lines[idx] = { ...lines[idx], stroke };
              updateComponent(component.id, { hlines: lines } as Partial<TableComponent>);
            }}
            onDashChange={(dash) => {
              const lines = [...(component.hlines || [])];
              (lines[idx] as { dash?: string }).dash = dash;
              updateComponent(component.id, { hlines: lines } as Partial<TableComponent>);
            }}
            onRemove={() => {
              updateComponent(component.id, {
                hlines: (component.hlines || []).filter((_, i) => i !== idx),
              } as Partial<TableComponent>);
            }}
          />
        ))}
        <AddRowButton
          label="Add H-Line"
          onClick={() =>
            updateComponent(component.id, {
              hlines: [
                ...(component.hlines || []),
                { id: crypto.randomUUID(), y: 0, stroke: '0.2pt' },
              ],
            } as Partial<TableComponent>)
          }
        />
      </InsetSection>

      <InsetSection label="Vertical" contentClassName="space-y-1">
        {(component.vlines || []).map((line, idx) => (
          <LineRowEditor
            key={line.id ?? idx}
            axis="x"
            position={line.x}
            stroke={String(line.stroke)}
            dash={(line as { dash?: string }).dash || 'solid'}
            onPositionChange={(x) => {
              const lines = [...(component.vlines || [])];
              lines[idx] = { ...lines[idx], x };
              updateComponent(component.id, { vlines: lines } as Partial<TableComponent>);
            }}
            onStrokeChange={(stroke) => {
              const lines = [...(component.vlines || [])];
              lines[idx] = { ...lines[idx], stroke };
              updateComponent(component.id, { vlines: lines } as Partial<TableComponent>);
            }}
            onDashChange={(dash) => {
              const lines = [...(component.vlines || [])];
              (lines[idx] as { dash?: string }).dash = dash;
              updateComponent(component.id, { vlines: lines } as Partial<TableComponent>);
            }}
            onRemove={() => {
              updateComponent(component.id, {
                vlines: (component.vlines || []).filter((_, i) => i !== idx),
              } as Partial<TableComponent>);
            }}
          />
        ))}
        <AddRowButton
          label="Add V-Line"
          onClick={() =>
            updateComponent(component.id, {
              vlines: [
                ...(component.vlines || []),
                { id: crypto.randomUUID(), x: 0, stroke: '0.2pt' },
              ],
            } as Partial<TableComponent>)
          }
        />
      </InsetSection>
    </div>
  );
};

/** @deprecated Use TableGuideLinesPanel inside TableAdvancedSection */
export const TableLinesSection = TableGuideLinesPanel;
