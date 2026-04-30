import { clsx } from 'clsx';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from 'lucide-react';
import { PropertyRow, SectionHeader } from './Shared';

interface AlignmentPropertiesProps {
  align: string;
  onUpdateAlign: (align: any) => void;
}

export function AlignmentProperties({ align, onUpdateAlign }: AlignmentPropertiesProps) {
  return (
    <section>
      <SectionHeader label="Alignment" />
      <PropertyRow label="Horizontal">
        <div className="flex border border-[var(--border-default)] rounded-[4px] overflow-hidden w-full bg-white/[0.02]">
          {[
            { id: 'left', icon: AlignLeft },
            { id: 'center', icon: AlignCenter },
            { id: 'right', icon: AlignRight },
            { id: 'justify', icon: AlignJustify },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onUpdateAlign(item.id)}
              className={clsx(
                'flex-1 py-1 flex items-center justify-center transition-all',
                align === item.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
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
