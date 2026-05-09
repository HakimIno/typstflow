'use client';

import { clsx } from 'clsx';
import { Bold, Italic, Underline } from 'lucide-react';
import { ColorPicker } from '../../shared/ColorPicker';
import { DesignerInput } from '../../shared/DesignerInput';
import { FontFamilyPicker } from './FontFamilyPicker';
import { PropertyRow, SectionHeader } from './Shared';

interface TypographyPropertiesProps {
  style: any;
  onUpdateStyle: (updates: any) => void;
}

export function TypographyProperties({ style, onUpdateStyle }: TypographyPropertiesProps) {
  return (
    <section>
      <SectionHeader label="Typography" />

      <PropertyRow label="Font Family">
        <FontFamilyPicker
          value={style?.fontFamily || 'Sarabun'}
          onChange={(family) => onUpdateStyle({ fontFamily: family })}
        />
      </PropertyRow>

      <PropertyRow label="Font Size (pt)">
        <DesignerInput
          type="number"
          min={1}
          max={200}
          value={style?.fontSize || 10}
          onChange={(v) => onUpdateStyle({ fontSize: Number.parseInt(v) || 10 })}
        />
      </PropertyRow>

      <PropertyRow label="Style">
        <div className="flex gap-1">
          <button
            type="button"
            title="Bold"
            onClick={() =>
              onUpdateStyle({ fontWeight: style?.fontWeight === 'bold' ? 'regular' : 'bold' })
            }
            className={clsx(
              'w-6 h-6 flex items-center justify-center border rounded-[4px] transition-all',
              style?.fontWeight === 'bold'
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-white/[0.04] border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/[0.08]'
            )}
          >
            <Bold className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Italic"
            onClick={() => onUpdateStyle({ italic: !style?.italic })}
            className={clsx(
              'w-6 h-6 flex items-center justify-center border rounded-[4px] transition-all',
              style?.italic
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-white/[0.04] border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/[0.08]'
            )}
          >
            <Italic className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Underline"
            onClick={() => onUpdateStyle({ underline: !style?.underline })}
            className={clsx(
              'w-6 h-6 flex items-center justify-center border rounded-[4px] transition-all',
              style?.underline
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-white/[0.04] border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/[0.08]'
            )}
          >
            <Underline className="w-3 h-3" />
          </button>
        </div>
      </PropertyRow>

      <PropertyRow label="Color">
        <ColorPicker
          color={style?.color || '#000000'}
          onChange={(color) => onUpdateStyle({ color })}
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
    </section>
  );
}
