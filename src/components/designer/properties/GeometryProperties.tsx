import { DesignerInput } from '../../shared/DesignerInput';
import { PropertyGrid } from './Shared';

interface GeometryPropertiesProps {
  x: number;
  y: number;
  width: number;
  height: number;
  onUpdate: (key: string, value: string) => void;
}

export function GeometryProperties({ x, y, width, height, onUpdate }: GeometryPropertiesProps) {
  return (
    <PropertyGrid cols={2} className="p-0.5">
      <DesignerInput
        type="number"
        variant="mini"
        step="1"
        value={x || 0}
        prefix="X"
        suffix="mm"
        onChange={(v) => onUpdate('x', v)}
      />
      <DesignerInput
        type="number"
        variant="mini"
        step="1"
        value={y || 0}
        prefix="Y"
        suffix="mm"
        onChange={(v) => onUpdate('y', v)}
      />
      <DesignerInput
        type="number"
        variant="mini"
        step="1"
        min={1}
        value={width || 0}
        prefix="W"
        suffix="mm"
        onChange={(v) => onUpdate('width', v)}
      />
      <DesignerInput
        type="number"
        variant="mini"
        step="1"
        min={1}
        value={height || 0}
        prefix="H"
        suffix="mm"
        onChange={(v) => onUpdate('height', v)}
      />
    </PropertyGrid>
  );
}
