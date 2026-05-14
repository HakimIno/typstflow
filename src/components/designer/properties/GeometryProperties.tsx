import { DesignerInput } from '../../shared/DesignerInput';
import { ControlField, PropertyGrid, SectionHeader } from './Shared';

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
      <PropertyGrid cols={2}>
        <ControlField label="X Pos">
          <DesignerInput
            type="number"
            variant="mini"
            step="1"
            value={x || 0}
            onChange={(v) => onUpdate('x', v)}
          />
        </ControlField>
        <ControlField label="Y Pos">
          <DesignerInput
            type="number"
            variant="mini"
            step="1"
            value={y || 0}
            onChange={(v) => onUpdate('y', v)}
          />
        </ControlField>
        <ControlField label="Width">
          <DesignerInput
            type="number"
            variant="mini"
            step="1"
            min={1}
            value={width || 0}
            onChange={(v) => onUpdate('width', v)}
          />
        </ControlField>
        <ControlField label="Height">
          <DesignerInput
            type="number"
            variant="mini"
            step="1"
            min={1}
            value={height || 0}
            onChange={(v) => onUpdate('height', v)}
          />
        </ControlField>
      </PropertyGrid>
    </section>
  );
}
