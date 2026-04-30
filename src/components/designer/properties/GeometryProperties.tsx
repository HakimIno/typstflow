import { DesignerInput } from '../../shared/DesignerInput';
import { PropertyRow, SectionHeader } from './Shared';

interface GeometryPropertiesProps {
  x: number;
  y: number;
  width: number;
  height: number;
  onUpdate: (key: string, value: string) => void;
}

export function GeometryProperties({ x, y, width, height, onUpdate }: GeometryPropertiesProps) {
  return (
    <section>
      <SectionHeader label="Geometry (mm)" />
      <div className="grid grid-cols-2">
        <PropertyRow label="X Pos">
          <DesignerInput
            type="number"
            step="1"
            value={x || 0}
            onChange={(v) => onUpdate('x', v)}
          />
        </PropertyRow>
        <PropertyRow label="Y Pos">
          <DesignerInput
            type="number"
            step="1"
            value={y || 0}
            onChange={(v) => onUpdate('y', v)}
          />
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
          <DesignerInput
            type="number"
            step="1"
            min={1}
            value={height || 0}
            onChange={(v) => onUpdate('height', v)}
          />
        </PropertyRow>
      </div>
    </section>
  );
}
