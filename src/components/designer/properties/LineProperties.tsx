import { clsx } from 'clsx';
import { Minus, MoreHorizontal, MoreVertical } from 'lucide-react';
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

  return (
    <section>
      <SectionHeader label="Line Style" />

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
        <div className="flex gap-1.5 items-center">
          <div
            className="w-5 h-5 rounded border border-[var(--border-default)]"
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

      <PropertyRow label="Stroke">
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
              <item.icon className="w-3 h-3" />
            </button>
          ))}
        </div>
      </PropertyRow>
    </section>
  );
}
