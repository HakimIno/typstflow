import { DesignerInput } from '../../shared/DesignerInput';
import { PropertyRow, SectionHeader } from './Shared';

interface GeometryPropertiesProps {
  x: number;
  y: number;
  width: number;
  height: number | 'auto';
  onUpdate: (key: string, value: string) => void;
}

export function GeometryProperties({ x, y, width, height, onUpdate }: GeometryPropertiesProps) {
  const isAutoHeight = height === 'auto';

  return (
    <section>
      <SectionHeader label="Geometry (mm)" />
      <div className="grid grid-cols-2">
        <PropertyRow label="X Pos">
          <DesignerInput type="number" step="1" value={x || 0} onChange={(v) => onUpdate('x', v)} />
        </PropertyRow>
        <PropertyRow label="Y Pos">
          <DesignerInput type="number" step="1" value={y || 0} onChange={(v) => onUpdate('y', v)} />
        </PropertyRow>
        <PropertyRow label="Width">
          <DesignerInput
            type="number"
            step="1"
            min={1}
            value={width || 0}
            onChange={(v) => onUpdate('width', v)}
          />
        </PropertyRow>
        <PropertyRow label="Height">
          <div className="flex gap-1">
            <DesignerInput
              type={isAutoHeight ? 'text' : 'number'}
              step="1"
              min={1}
              value={isAutoHeight ? 'AUTO' : (height || 0)}
              disabled={isAutoHeight}
              onChange={(v) => onUpdate('height', v)}
            />
            <button
              type="button"
              onClick={() => onUpdate('height', isAutoHeight ? '20' : 'auto')}
              className={`px-1.5 rounded text-[8px] font-bold border transition-colors ${
                isAutoHeight
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              AUTO
            </button>
          </div>
        </PropertyRow>
      </div>
    </section>
  );
}
