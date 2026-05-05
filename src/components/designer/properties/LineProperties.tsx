import { clsx } from 'clsx';
import { Circle, Minus, MoreHorizontal, MoreVertical, Square, Type } from 'lucide-react';
import { DesignerInput } from '../../shared/DesignerInput';
import { PropertyRow, SectionHeader } from './Shared';

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
    <section className="space-y-4">
      <div>
        <SectionHeader label="Orientation" />
        <div className="flex border border-[var(--border-default)] rounded-[4px] overflow-hidden w-full bg-white/[0.02]">
          <button
            type="button"
            onClick={() => handleOrientationChange('horizontal')}
            className={clsx(
              'flex-1 py-1.5 text-[11px] font-medium transition-all',
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
              'flex-1 py-1.5 text-[11px] font-medium transition-all border-l border-[var(--border-default)]',
              component.orientation === 'vertical'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
            )}
          >
            Vertical
          </button>
        </div>
      </div>

      <div>
        <SectionHeader label="Appearance" />
        <PropertyRow label="Thickness">
          <DesignerInput
            type="text"
            value={component.thickness || '1pt'}
            onChange={(v) => onUpdate({ thickness: v })}
            mono
            placeholder="1pt"
          />
        </PropertyRow>

        <PropertyRow label="Color">
          <div className="flex gap-1.5 items-center w-full">
            <div
              className="w-5 h-5 rounded border border-[var(--border-default)] shrink-0"
              style={{ backgroundColor: component.color || '#000000' }}
            />
            <DesignerInput
              type="text"
              value={component.color || '#000000'}
              onChange={(v) => onUpdate({ color: v })}
              mono
              placeholder="#000000"
            />
          </div>
        </PropertyRow>

        <PropertyRow label="Stroke Style">
          <div className="flex border border-[var(--border-default)] rounded-[4px] overflow-hidden w-full bg-white/[0.02]">
            {styles.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.label}
                onClick={() => onUpdate({ style: item.id })}
                className={clsx(
                  'flex-1 py-1 flex items-center justify-center transition-all',
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
      </div>

      <div>
        <SectionHeader label="Advanced Styling" />
        <PropertyRow label="Cap Style">
          <div className="flex border border-[var(--border-default)] rounded-[4px] overflow-hidden w-full bg-white/[0.02]">
            {caps.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.label}
                onClick={() => onUpdate({ cap: item.id })}
                className={clsx(
                  'flex-1 py-1 flex items-center justify-center transition-all',
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
            value={component.dashArray || ''}
            onChange={(v) => onUpdate({ dashArray: v })}
            mono
            placeholder="e.g. 3pt 2pt"
          />
        </PropertyRow>

        <PropertyRow label="Typst Stroke">
          <DesignerInput
            type="text"
            value={component.stroke || ''}
            onChange={(v) => onUpdate({ stroke: v })}
            mono
            placeholder="(paint: red, thickness: 2pt)"
          />
        </PropertyRow>
      </div>
    </section>
  );
}

