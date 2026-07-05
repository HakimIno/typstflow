'use client';

import { ColorPicker } from '@/components/shared/ColorPicker';
import { DesignerToggle } from '@/components/shared/DesignerToggle';
import type { TextStyle } from '@/types/schema';
import { clsx } from 'clsx';
import { AlignCenter, AlignLeft, AlignRight, Italic, Minus, Plus, Underline } from 'lucide-react';
import { VariablePicker } from '../../VariablePicker';
import { FontWeightSelect } from '../../ui/FontWeightSelect';
import { ControlField, PanelMiniInput, PropertyGrid } from '../Shared';

/** Re-export for table property panels — alias must be a binding for in-file use */
export const MiniInput = PanelMiniInput;

/** Dark-theme defaults for group header (avoid bright #f1f5f9 in the panel) */
export const TABLE_DEFAULT_GROUP_HEADER_BG = '#27272a';
export const TABLE_DEFAULT_GROUP_HEADER_COLOR = '#e4e4e7';

export const TABLE_FIELD_STACK = 'space-y-2';

const TOGGLE_BTN_CLASS =
  'flex-1 h-5 flex items-center justify-center rounded-[3px] border transition-all';

export const BindingField = ({
  label,
  value,
  onChange,
  sampleData,
  onBindingSelect,
  placeholder,
  mono,
  appendBinding,
  pathFilter,
  formatSelectedBinding,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  sampleData: Record<string, unknown>;
  onBindingSelect: (path: string, binding: string) => void;
  placeholder?: string;
  mono?: boolean;
  /** Append binding to current value instead of replacing */
  appendBinding?: boolean;
  pathFilter?: (path: string) => boolean;
  formatSelectedBinding?: (path: string, func?: string) => string;
}) => (
  <ControlField label={label}>
    <div className="flex items-center gap-1 min-w-0 w-full">
      <MiniInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        mono={mono}
        className="flex-1 min-w-0"
      />
      <VariablePicker
        compact
        sampleData={sampleData}
        pathFilter={pathFilter}
        formatSelectedBinding={formatSelectedBinding}
        onSelect={(_path, binding) =>
          onBindingSelect(_path, appendBinding ? `${value}${binding}` : binding)
        }
      />
    </div>
  </ControlField>
);

export const SettingToggle = ({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-2">
    <div className="min-w-0">
      <span className="text-[9px] font-medium text-[var(--text-secondary)]">{label}</span>
      {description ? (
        <p className="text-[8px] text-[var(--text-muted)] leading-tight mt-0.5">{description}</p>
      ) : null}
    </div>
    <DesignerToggle value={value} onChange={(v) => onChange(v === true || v === 'true')} />
  </div>
);

const toggleActive = (on: boolean) =>
  on
    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
    : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:bg-white/[0.06]';

export const FormatToggleGroup = ({
  italic,
  underline,
  onToggleItalic,
  onToggleUnderline,
}: {
  italic?: boolean;
  underline?: boolean;
  onToggleItalic: () => void;
  onToggleUnderline: () => void;
}) => (
  <div className="flex gap-0.5 w-full">
    <button
      type="button"
      title="Italic"
      onClick={onToggleItalic}
      className={clsx(TOGGLE_BTN_CLASS, toggleActive(!!italic))}
    >
      <Italic className="w-2.5 h-2.5" />
    </button>
    <button
      type="button"
      title="Underline"
      onClick={onToggleUnderline}
      className={clsx(TOGGLE_BTN_CLASS, toggleActive(!!underline))}
    >
      <Underline className="w-2.5 h-2.5" />
    </button>
  </div>
);

export const AlignToggleGroup = ({
  value,
  onChange,
}: {
  value?: TextStyle['align'];
  onChange: (align: 'left' | 'center' | 'right') => void;
}) => (
  <div className="flex border border-[var(--border-default)] rounded-[3px] overflow-hidden h-5 w-full">
    {(['left', 'center', 'right'] as const).map((align) => {
      const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
      return (
        <button
          type="button"
          key={align}
          title={align}
          onClick={() => onChange(align)}
          className={clsx(
            'flex-1 flex items-center justify-center transition-colors',
            (value || 'left') === align
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-muted)] hover:bg-white/[0.06]'
          )}
        >
          <Icon className="w-3 h-3" />
        </button>
      );
    })}
  </div>
);

export const CompactTextStyleFields = ({
  style,
  onPatch,
  defaultBackground = TABLE_DEFAULT_GROUP_HEADER_BG,
  defaultColor = TABLE_DEFAULT_GROUP_HEADER_COLOR,
  defaultFontSize = 9,
  defaultFontWeight = 'bold',
}: {
  style: TextStyle;
  onPatch: (patch: Partial<TextStyle>) => void;
  defaultBackground?: string;
  defaultColor?: string;
  defaultFontSize?: number;
  defaultFontWeight?: TextStyle['fontWeight'];
}) => (
  <PropertyGrid cols={2} className="gap-2">
    <ControlField label="Background">
      <ColorPicker
        color={style.background || defaultBackground}
        onChange={(v) => onPatch({ background: v })}
      />
    </ControlField>
    <ControlField label="Text">
      <ColorPicker color={style.color || defaultColor} onChange={(v) => onPatch({ color: v })} />
    </ControlField>
    <ControlField label="Size">
      <MiniInput
        type="number"
        value={style.fontSize ?? defaultFontSize}
        onChange={(v) => onPatch({ fontSize: Number.parseInt(v) || defaultFontSize })}
        className="w-full"
      />
    </ControlField>
    <ControlField label="Weight">
      <FontWeightSelect
        value={style.fontWeight || defaultFontWeight}
        onChange={(v) => onPatch({ fontWeight: v as TextStyle['fontWeight'] })}
        className="w-full h-5 text-[9px] bg-[var(--bg-widget)] border-[var(--border-default)]"
      />
    </ControlField>
    <ControlField label="Format">
      <FormatToggleGroup
        italic={style.italic}
        underline={style.underline}
        onToggleItalic={() => onPatch({ italic: !style.italic })}
        onToggleUnderline={() => onPatch({ underline: !style.underline })}
      />
    </ControlField>
    <ControlField label="Align">
      <AlignToggleGroup value={style.align} onChange={(align) => onPatch({ align })} />
    </ControlField>
  </PropertyGrid>
);

export const AddRowButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full h-6 flex items-center justify-center gap-1 text-[8px] font-bold uppercase tracking-[0.1em] border border-dashed border-[var(--border-default)] rounded-[3px] text-[var(--text-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors"
  >
    <Plus className="w-3 h-3" />
    {label}
  </button>
);

export const SummaryRowEditor = ({
  label,
  value,
  onLabelChange,
  onValueChange,
  onRemove,
}: {
  label: string;
  value: string;
  onLabelChange: (v: string) => void;
  onValueChange: (v: string) => void;
  onRemove: () => void;
}) => (
  <div className="flex items-center gap-1">
    <MiniInput
      value={label}
      onChange={onLabelChange}
      placeholder="Label"
      className="w-[72px] shrink-0"
    />
    <MiniInput
      value={value}
      onChange={onValueChange}
      placeholder="{{total}}"
      mono
      className="flex-1 min-w-0"
    />
    <button
      type="button"
      onClick={onRemove}
      className="w-5 h-5 shrink-0 flex items-center justify-center text-red-500/50 hover:text-red-500 rounded-[3px] transition-colors"
      title="Remove row"
    >
      <Minus className="w-3 h-3" />
    </button>
  </div>
);
