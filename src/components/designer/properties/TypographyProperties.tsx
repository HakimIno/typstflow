import { clsx } from 'clsx';
import { Bold } from 'lucide-react';
import { DesignerInput } from '../../shared/DesignerInput';
import { PropertyRow, SectionHeader } from './Shared';

interface TypographyPropertiesProps {
  style: any;
  onUpdateStyle: (updates: any) => void;
}

export function TypographyProperties({ style, onUpdateStyle }: TypographyPropertiesProps) {
  return (
    <section>
      <SectionHeader label="Typography" />
      <PropertyRow label="Font Size (pt)">
        <DesignerInput
          type="number"
          min={1}
          max={200}
          value={style?.fontSize || 10}
          onChange={(v) => onUpdateStyle({ fontSize: Number.parseInt(v) || 10 })}
        />
      </PropertyRow>
      <PropertyRow label="Line Height">
        <DesignerInput
          type="number"
          step="0.1"
          min={0.5}
          max={3}
          value={style?.lineHeight || 1.2}
          onChange={(v) => onUpdateStyle({ lineHeight: Number.parseFloat(v) || 1.2 })}
        />
      </PropertyRow>
      <PropertyRow label="Spacing (em)">
        <DesignerInput
          type="text"
          value={style?.letterSpacing || '0pt'}
          onChange={(v) => onUpdateStyle({ letterSpacing: v })}
          mono
          placeholder="0.05em"
        />
      </PropertyRow>
      <PropertyRow label="Weight">
        <button
          type="button"
          onClick={() =>
            onUpdateStyle({
              fontWeight: style?.fontWeight === 'bold' ? 'regular' : 'bold',
            })
          }
          className={clsx(
            'px-2 py-0.5 border text-[10px] font-bold transition-all',
            style?.fontWeight === 'bold'
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
              : 'bg-white/[0.04] border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/[0.08]'
          )}
        >
          <Bold className="w-3 h-3" />
        </button>
      </PropertyRow>
    </section>
  );
}
