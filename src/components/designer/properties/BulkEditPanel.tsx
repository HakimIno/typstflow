'use client';

import type { ComponentNode, TextStyle } from '@/types/schema';
import { clsx } from 'clsx';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Minus,
  MoreHorizontal,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { ColorPicker } from '../../shared/ColorPicker';
import { PANEL_PRESET_ICONS, PanelHeaderIcon, getComponentTypeIcon } from '../ComponentTypeIcon';
import { BulkTypographySection } from './BulkTypographySection';
import {
  CollapsibleSection,
  ControlField,
  PANEL_FIELD_STACK,
  PROPERTY_STACK_CLASS,
  PanelMiniInput,
  PropertyGrid,
} from './Shared';
import {
  LINE_TYPES,
  TYPE_CHIP_COLORS,
  TYPOGRAPHY_TYPES,
  componentsOfType,
  countByType,
  getMixedValue,
  isMixed,
  isTypographyType,
} from './bulk-edit-utils';

export interface BulkEditActions {
  /** Apply to every selected component */
  updateAll: (updates: Partial<ComponentNode>) => void;
  /** Apply only to components of this type (e.g. all text, all tables) */
  updateByType: (type: ComponentNode['type'], updates: Partial<ComponentNode>) => void;
  updateStyleByType: (type: ComponentNode['type'], updates: Partial<TextStyle>) => void;
  deleteAll: () => void;
}

interface BulkEditPanelProps {
  selectedComponents: ComponentNode[];
  actions: BulkEditActions;
}

const TYPE_LABELS: Partial<Record<ComponentNode['type'], string>> = {
  text: 'Text',
  table: 'Table',
  image: 'Image',
  line: 'Line',
  checklist: 'Checklist',
  'page-number': 'Page #',
  'summary-box': 'Summary',
  barcode: 'Barcode',
  qr: 'QR',
  spacer: 'Spacer',
  columns: 'Columns',
  repeater: 'Repeater',
  'page-break-indicator': 'Break',
};

function BulkLineSection({
  components,
  onUpdate,
}: {
  components: ComponentNode[];
  onUpdate: (updates: Partial<ComponentNode>) => void;
}) {
  const lineColor = getMixedValue(components, (c) => (c as { color?: string }).color || '#000000');
  const lineThickness = getMixedValue(
    components,
    (c) => (c as { thickness?: string }).thickness || '1pt'
  );
  const lineStyle = getMixedValue(components, (c) => (c as { style?: string }).style || 'solid');

  return (
    <div className={PANEL_FIELD_STACK}>
      <ControlField label="Thickness">
        <PanelMiniInput
          value={isMixed(lineThickness) ? '' : (lineThickness as string)}
          onChange={(v) => onUpdate({ thickness: v } as Partial<ComponentNode>)}
          mono
          placeholder={isMixed(lineThickness) ? '—' : '1pt'}
          className="w-full"
        />
      </ControlField>
      <ControlField label="Color">
        <ColorPicker
          color={isMixed(lineColor) ? '#000000' : (lineColor as string)}
          onChange={(color) => onUpdate({ color } as Partial<ComponentNode>)}
        />
      </ControlField>
      <ControlField label="Dash">
        <div className="flex border border-[var(--border-default)] rounded-[3px] overflow-hidden h-5 w-full">
          {(
            [
              { id: 'solid', icon: Minus },
              { id: 'dashed', icon: MoreHorizontal },
              { id: 'dotted', icon: MoreVertical },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onUpdate({ style: item.id } as Partial<ComponentNode>)}
              className={clsx(
                'flex-1 flex items-center justify-center transition-colors',
                !isMixed(lineStyle) && lineStyle === item.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:bg-white/[0.04]'
              )}
            >
              <item.icon className="w-3 h-3" />
            </button>
          ))}
        </div>
      </ControlField>
    </div>
  );
}

export const BulkEditPanel = memo(function BulkEditPanel({
  selectedComponents,
  actions,
}: BulkEditPanelProps) {
  const typeCounts = useMemo(() => countByType(selectedComponents), [selectedComponents]);
  const typeKeys = useMemo(
    () => Object.keys(typeCounts).sort() as ComponentNode['type'][],
    [typeCounts]
  );
  const hasMultipleTypes = typeKeys.length > 1;
  const [focusType, setFocusType] = useState<ComponentNode['type'] | 'all'>('all');

  const scoped =
    focusType === 'all' ? selectedComponents : componentsOfType(selectedComponents, focusType);

  const widthValue = getMixedValue(scoped, (c) => c.width);
  const heightValue = getMixedValue(scoped, (c) => c.height);
  const alignValue = getMixedValue(scoped, (c) => c.align || 'left');

  const handleWidthChange = (v: string) => {
    const num = Number.parseFloat(v);
    if (Number.isNaN(num)) return;
    if (focusType === 'all') actions.updateAll({ width: num });
    else actions.updateByType(focusType, { width: num });
  };

  const handleHeightChange = (v: string) => {
    const num = Number.parseFloat(v);
    if (Number.isNaN(num)) return;
    if (focusType === 'all') actions.updateAll({ height: num });
    else actions.updateByType(focusType, { height: num });
  };

  const handleAlignChange = (align: 'left' | 'center' | 'right' | 'justify') => {
    const patch = { align };
    if (focusType === 'all') {
      actions.updateAll(patch);
      for (const type of TYPOGRAPHY_TYPES) {
        if (typeCounts[type]) {
          actions.updateStyleByType(type, { justify: align === 'justify' });
        }
      }
    } else {
      actions.updateByType(focusType, patch);
      if (isTypographyType(focusType)) {
        actions.updateStyleByType(focusType, { justify: align === 'justify' });
      }
    }
  };

  const typographyTypes = typeKeys.filter((t) => isTypographyType(t));
  const lineTypes = typeKeys.filter((t) => (LINE_TYPES as readonly string[]).includes(t));

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border-default)]">
      <div className="h-10 min-h-[40px] border-b border-[var(--border-default)] flex items-center px-3 gap-2 bg-white/[0.01]">
        <PanelHeaderIcon icon={PANEL_PRESET_ICONS.group} />
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
            Bulk Edit
          </span>
          <span className="text-[8px] text-[var(--text-muted)] font-mono">
            {selectedComponents.length} selected
            {hasMultipleTypes ? ` · ${typeKeys.length} types` : ''}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className={PROPERTY_STACK_CLASS}>
          {/* Type filter — style per kind without re-selecting on canvas */}
          <div className="px-2.5 py-2 space-y-1.5 border-b border-[var(--border-default)]">
            <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Apply styles to
            </p>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setFocusType('all')}
                className={clsx(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[8px] font-bold border transition-colors',
                  focusType === 'all'
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/40'
                    : 'bg-[var(--bg-widget)] text-[var(--text-muted)] border-[var(--border-default)] hover:text-[var(--text-secondary)]'
                )}
              >
                All
                <span className="opacity-60">×{selectedComponents.length}</span>
              </button>
              {typeKeys.map((type) => {
                const Icon = getComponentTypeIcon(type);
                const active = focusType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFocusType(type)}
                    className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[8px] font-bold border transition-colors',
                      active
                        ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/40'
                        : TYPE_CHIP_COLORS[type] ||
                            'bg-[var(--bg-widget)] text-[var(--text-muted)] border-[var(--border-default)]'
                    )}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    {TYPE_LABELS[type] ?? type}
                    <span className="opacity-60">×{typeCounts[type]}</span>
                  </button>
                );
              })}
            </div>
            {hasMultipleTypes && focusType !== 'all' && (
              <p className="text-[8px] text-[var(--text-muted)] leading-snug">
                Layout changes below affect only{' '}
                <span className="text-[var(--text-secondary)]">
                  {TYPE_LABELS[focusType] ?? focusType}
                </span>
                . Typography sections always target each type separately.
              </p>
            )}
          </div>

          <CollapsibleSection
            label={
              focusType === 'all'
                ? 'Shared layout'
                : `Layout · ${TYPE_LABELS[focusType] ?? focusType}`
            }
          >
            <div className={PANEL_FIELD_STACK}>
              <PropertyGrid cols={2} className="gap-2">
                <ControlField label="Width">
                  <PanelMiniInput
                    type="number"
                    step="1"
                    min={1}
                    value={isMixed(widthValue) ? '' : (widthValue ?? 0)}
                    onChange={handleWidthChange}
                    placeholder={isMixed(widthValue) ? '—' : undefined}
                    className="w-full"
                  />
                </ControlField>
                <ControlField label="Height">
                  <PanelMiniInput
                    type="number"
                    step="1"
                    min={1}
                    value={isMixed(heightValue) ? '' : (heightValue ?? 0)}
                    onChange={handleHeightChange}
                    placeholder={isMixed(heightValue) ? '—' : undefined}
                    className="w-full"
                  />
                </ControlField>
              </PropertyGrid>

              <ControlField label="Align">
                <div className="flex border border-[var(--border-default)] rounded-[3px] overflow-hidden h-5 w-full">
                  {(
                    [
                      { id: 'left', icon: AlignLeft },
                      { id: 'center', icon: AlignCenter },
                      { id: 'right', icon: AlignRight },
                      { id: 'justify', icon: AlignJustify },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAlignChange(item.id)}
                      className={clsx(
                        'flex-1 flex items-center justify-center transition-colors',
                        !isMixed(alignValue) && alignValue === item.id
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--text-muted)] hover:bg-white/[0.04]'
                      )}
                    >
                      <item.icon className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </ControlField>
              {isMixed(alignValue) && (
                <p className="text-[8px] text-[var(--text-muted)] italic">Mixed — pick to unify</p>
              )}
            </div>
          </CollapsibleSection>

          {/* Per-type typography — always scoped by type */}
          {typographyTypes.map((type) => {
            const subset = componentsOfType(selectedComponents, type);
            const label = TYPE_LABELS[type] ?? type;
            return (
              <CollapsibleSection
                key={type}
                label={`Typography · ${label} ×${typeCounts[type]}`}
                defaultOpen={typographyTypes.length === 1}
              >
                <BulkTypographySection
                  components={subset}
                  onStyleUpdate={(updates) => actions.updateStyleByType(type, updates)}
                />
              </CollapsibleSection>
            );
          })}

          {lineTypes.map((type) => {
            const subset = componentsOfType(selectedComponents, type);
            return (
              <CollapsibleSection key={type} label={`Line · ×${typeCounts[type]}`}>
                <BulkLineSection
                  components={subset}
                  onUpdate={(updates) => actions.updateByType(type, updates)}
                />
              </CollapsibleSection>
            );
          })}

          <div className="px-2.5 py-2">
            <button
              type="button"
              onClick={actions.deleteAll}
              className="flex items-center justify-center gap-2 w-full h-7 rounded-[3px] bg-red-600/10 hover:bg-red-600/80 text-red-500 hover:text-white border border-red-600/25 transition-colors text-[9px] font-bold uppercase tracking-wide"
            >
              <Trash2 className="w-3 h-3" />
              Delete {selectedComponents.length}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
