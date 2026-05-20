import { clsx } from 'clsx';
import { Circle, Minus, MoreHorizontal, MoreVertical, Square } from 'lucide-react';
import { ColorPicker } from '../../shared/ColorPicker';
import { DesignerInput } from '../../shared/DesignerInput';
import { CollapsibleSection, ControlField, PropertyGrid, PropertyRow } from './Shared';

interface LinePropertiesProps {
  component: any;
  onUpdate: (updates: any) => void;
}

export function LineProperties({ component, onUpdate }: LinePropertiesProps) {
  const styles = [
    { id: 'solid', icon: Minus, label: 'Solid' },
    { id: 'dashed', icon: MoreHorizontal, label: 'Dashed' },
    { id: 'dotted', icon: MoreVertical, label: 'Dotted' },
  ];

  const caps = [
    { id: 'butt', icon: Square, label: 'Butt' },
    { id: 'round', icon: Circle, label: 'Round' },
    { id: 'square', icon: Square, label: 'Square' },
  ];

  const handleOrientationChange = (orientation: 'horizontal' | 'vertical') => {
    if (component.orientation === orientation) return;

    // Swap width and height for better UX
    onUpdate({
      orientation,
      width: component.height,
      height: component.width,
    });
  };

  return (
    <>
      <CollapsibleSection label="Line Setup">
        <PropertyGrid cols={1}>
          <ControlField label="Orientation" vertical={false}>
            <div className="flex border border-[var(--border-default)] rounded-[4px] overflow-hidden bg-white/[0.02] w-36 shrink-0">
              <button
                type="button"
                onClick={() => handleOrientationChange('horizontal')}
                className={clsx(
                  'flex-1 py-1 text-[9px] font-bold transition-all h-6',
                  (component.orientation || 'horizontal') === 'horizontal'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
                )}
              >
                Horizontal
              </button>
              <button
                type="button"
                onClick={() => handleOrientationChange('vertical')}
                className={clsx(
                  'flex-1 py-1 text-[9px] font-bold transition-all border-l border-[var(--border-default)] h-6',
                  component.orientation === 'vertical'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
                )}
              >
                Vertical
              </button>
            </div>
          </ControlField>
        </PropertyGrid>

        <PropertyGrid cols={2}>
          <ControlField label="Thickness">
            <DesignerInput
              type="text"
              variant="mini"
              value={component.thickness || '1pt'}
              onChange={(v) => onUpdate({ thickness: v })}
              mono
              placeholder="1pt"
            />
          </ControlField>

          <ControlField label="Color">
            <ColorPicker
              color={component.color || '#000000'}
              onChange={(color) => onUpdate({ color })}
            />
          </ControlField>
        </PropertyGrid>

        <PropertyRow label="Stroke Style">
          <div className="flex border border-[var(--border-default)] rounded-[4px] overflow-hidden w-full bg-white/[0.02]">
            {styles.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.label}
                onClick={() => onUpdate({ style: item.id })}
                className={clsx(
                  'flex-1 py-1 flex items-center justify-center transition-all h-6',
                  component.style === item.id || (!component.style && item.id === 'solid')
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
                )}
              >
                <item.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </PropertyRow>
      </CollapsibleSection>

      <CollapsibleSection label="Advanced Line Style" defaultOpen={false}>
        <PropertyRow label="Cap Style">
          <div className="flex border border-[var(--border-default)] rounded-[4px] overflow-hidden w-full bg-white/[0.02]">
            {caps.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.label}
                onClick={() => onUpdate({ cap: item.id })}
                className={clsx(
                  'flex-1 py-1 flex items-center justify-center transition-all h-6',
                  (component.cap || 'butt') === item.id
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
                )}
              >
                <item.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </PropertyRow>

        <PropertyRow label="Dash Pattern">
          <DesignerInput
            type="text"
            variant="mini"
            value={component.dashArray || ''}
            onChange={(v) => onUpdate({ dashArray: v })}
            mono
            placeholder="e.g. 3pt 2pt"
          />
        </PropertyRow>

        <PropertyRow label="Typst Stroke">
          <DesignerInput
            type="text"
            variant="mini"
            value={component.stroke || ''}
            onChange={(v) => onUpdate({ stroke: v })}
            mono
            placeholder="(paint: red, thickness: 2pt)"
          />
        </PropertyRow>
      </CollapsibleSection>
    </>
  );
}
