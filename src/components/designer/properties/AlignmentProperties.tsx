import { clsx } from 'clsx';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from 'lucide-react';
import { CollapsibleSection, ControlField, PropertyGrid } from './Shared';

interface AlignmentPropertiesProps {
  align: string;
  onUpdateAlign: (align: any) => void;
}

export function AlignmentProperties({ align, onUpdateAlign }: AlignmentPropertiesProps) {
  return (
    <CollapsibleSection label="Alignment">
      <PropertyGrid cols={1}>
        <ControlField label="Horizontal" vertical={false} className="items-center">
          <div className="flex border border-[var(--border-default)] rounded-[4px] overflow-hidden bg-[var(--bg-widget)] shrink-0 w-32">
            {[
              { id: 'left', icon: AlignLeft, title: 'Align Left' },
              { id: 'center', icon: AlignCenter, title: 'Align Center' },
              { id: 'right', icon: AlignRight, title: 'Align Right' },
              { id: 'justify', icon: AlignJustify, title: 'Justify' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.title}
                onClick={() => onUpdateAlign(item.id)}
                className={clsx(
                  'flex-1 py-1 flex items-center justify-center transition-all h-6',
                  align === item.id
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
                )}
              >
                <item.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </ControlField>
      </PropertyGrid>
    </CollapsibleSection>
  );
}
