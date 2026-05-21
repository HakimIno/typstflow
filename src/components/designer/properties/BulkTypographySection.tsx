'use client';

import type { ComponentNode, TextStyle } from '@/types/schema';
import { clsx } from 'clsx';
import { Bold, Italic, Underline } from 'lucide-react';
import { ColorPicker } from '../../shared/ColorPicker';
import { FontFamilyPicker } from './FontFamilyPicker';
import { ControlField, PANEL_FIELD_STACK, PanelMiniInput, PropertyGrid } from './Shared';
import { getMixedStyleValue, isMixed } from './bulk-edit-utils';

const MixedTag = ({ show }: { show: boolean }) =>
  show ? <span className="text-[8px] text-[var(--text-muted)] italic shrink-0">mixed</span> : null;

interface Props {
  components: ComponentNode[];
  onStyleUpdate: (updates: Partial<TextStyle>) => void;
}

export function BulkTypographySection({ components, onStyleUpdate }: Props) {
  const fontFamily = getMixedStyleValue<string>(components, 'fontFamily');
  const fontSize = getMixedStyleValue<number>(components, 'fontSize');
  const fontWeight = getMixedStyleValue<string | number>(components, 'fontWeight');
  const isItalic = getMixedStyleValue<boolean>(components, 'italic');
  const isUnderline = getMixedStyleValue<boolean>(components, 'underline');
  const textColor = getMixedStyleValue<string>(components, 'color');
  const lineHeight = getMixedStyleValue<number>(components, 'lineHeight');

  const weightIsBold =
    !isMixed(fontWeight) && (fontWeight === 'bold' || fontWeight === 700 || fontWeight === '700');

  return (
    <div className={PANEL_FIELD_STACK}>
      <ControlField label="Font">
        <div className="flex items-center gap-1 min-w-0 w-full">
          <FontFamilyPicker
            value={isMixed(fontFamily) ? '' : (fontFamily as string) || 'Sarabun'}
            onChange={(family) => onStyleUpdate({ fontFamily: family })}
            mixed={isMixed(fontFamily)}
          />
          <MixedTag show={isMixed(fontFamily)} />
        </div>
      </ControlField>

      <PropertyGrid cols={2} className="gap-2">
        <ControlField label="Size">
          <PanelMiniInput
            type="number"
            min={1}
            max={200}
            value={isMixed(fontSize) ? '' : (fontSize as number) || 10}
            onChange={(v) => onStyleUpdate({ fontSize: Number.parseInt(v) || 10 })}
            placeholder={isMixed(fontSize) ? '—' : undefined}
            className="w-full"
          />
        </ControlField>
        <ControlField label="Line H">
          <PanelMiniInput
            type="number"
            step="0.1"
            min={0.5}
            max={3}
            value={isMixed(lineHeight) ? '' : (lineHeight as number) || 1.4}
            onChange={(v) => onStyleUpdate({ lineHeight: Number.parseFloat(v) || 1.4 })}
            placeholder={isMixed(lineHeight) ? '—' : undefined}
            className="w-full"
          />
        </ControlField>
      </PropertyGrid>

      <ControlField label="Style">
        <div className="flex items-center gap-1 w-full">
          {(
            [
              {
                title: 'Bold',
                icon: Bold,
                active: weightIsBold,
                onClick: () => onStyleUpdate({ fontWeight: weightIsBold ? 'regular' : 'bold' }),
              },
              {
                title: 'Italic',
                icon: Italic,
                active: !isMixed(isItalic) && !!isItalic,
                onClick: () => onStyleUpdate({ italic: isMixed(isItalic) ? true : !isItalic }),
              },
              {
                title: 'Underline',
                icon: Underline,
                active: !isMixed(isUnderline) && !!isUnderline,
                onClick: () =>
                  onStyleUpdate({ underline: isMixed(isUnderline) ? true : !isUnderline }),
              },
            ] as const
          ).map(({ title, icon: Icon, active, onClick }) => (
            <button
              key={title}
              type="button"
              title={title}
              onClick={onClick}
              className={clsx(
                'flex-1 h-5 flex items-center justify-center rounded-[3px] border transition-all',
                active
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)]'
              )}
            >
              <Icon className="w-2.5 h-2.5" />
            </button>
          ))}
          <MixedTag show={isMixed(fontWeight) || isMixed(isItalic) || isMixed(isUnderline)} />
        </div>
      </ControlField>

      <ControlField label="Color">
        <div className="flex items-center gap-1 w-full">
          <ColorPicker
            color={isMixed(textColor) ? '#000000' : (textColor as string) || '#000000'}
            onChange={(color) => onStyleUpdate({ color })}
          />
          <MixedTag show={isMixed(textColor)} />
        </div>
      </ControlField>
    </div>
  );
}
