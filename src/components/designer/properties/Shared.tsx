import { clsx } from 'clsx';
import { Check, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import type { DesignerInputProps } from '../../shared/DesignerInput';
import { DesignerInput } from '../../shared/DesignerInput';

/** Panel section shell — single source for PropertiesPanel + table sections */
export const PROPERTY_SECTION_CLASS =
  'border-b border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden';

/** Sections separated by a single hairline — no gap stripes */
export const PROPERTY_STACK_CLASS =
  'flex flex-col divide-y divide-[var(--border-default)] bg-[var(--bg-surface)]';

/** Flat section label row (no filled header bar) */
export const SECTION_HEADER_CLASS =
  'h-7 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] flex items-center gap-2 select-none';

/** Body padding under SectionHeader */
export const PANEL_SECTION_BODY = 'px-2.5 pb-2 space-y-2';

export const PANEL_FIELD_STACK = 'space-y-2';

export const PANEL_SELECT_TRIGGER =
  'h-5 min-h-5 text-[9px] bg-[var(--bg-widget)] border-[var(--border-default)] w-full';

export const PanelMiniInput = (props: DesignerInputProps) => (
  <DesignerInput
    variant="mini"
    {...props}
    className={clsx(
      'bg-[var(--bg-widget)] border-[var(--border-default)] rounded-[3px] focus:border-[var(--accent)] transition-colors',
      props.className
    )}
  />
);

type SegmentTone = 'accent' | 'emerald';

export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: LucideIcon; tone?: SegmentTone }[];
  value: T;
  onChange: (value: T) => void;
}) => (
  <div className="flex border border-[var(--border-default)] rounded-[3px] overflow-hidden h-6 w-full">
    {options.map(({ value: optValue, label, icon: Icon, tone = 'accent' }) => {
      const isActive = value === optValue;
      const activeClass =
        tone === 'emerald'
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-[var(--accent)]/15 text-[var(--accent)]';
      return (
        <button
          type="button"
          key={optValue}
          onClick={() => onChange(optValue)}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1 transition-colors text-[8px] font-bold uppercase tracking-wide',
            isActive ? activeClass : 'text-[var(--text-muted)] hover:bg-white/[0.04]'
          )}
        >
          {Icon ? <Icon className="w-3 h-3 shrink-0" /> : null}
          <span>{label}</span>
        </button>
      );
    })}
  </div>
);

/**
 * Standalone pill-shaped toggle — visually consistent with SegmentedControl
 * but independent (multiple can be active at once).
 *
 * Use `ToggleChipGroup` to wrap a row of chips with consistent spacing.
 */
export const ToggleChip = ({
  checked,
  onChange,
  label,
  icon: Icon,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  icon?: LucideIcon;
  className?: string;
}) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={clsx(
      'inline-flex items-center gap-1 px-2 h-5 rounded-full text-[8px] font-bold uppercase tracking-wide transition-all select-none shrink-0',
      checked
        ? 'bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]/25'
        : 'bg-white/[0.04] text-[var(--text-muted)] ring-1 ring-transparent hover:bg-white/[0.07] hover:text-[var(--text-secondary)]',
      className
    )}
  >
    <span
      className={clsx(
        'w-1.5 h-1.5 rounded-full shrink-0 transition-colors',
        checked ? 'bg-[var(--accent)]' : 'bg-white/20'
      )}
    />
    {Icon && <Icon className="w-2.5 h-2.5 shrink-0" />}
    <span>{label}</span>
  </button>
);

/** Wraps a row of `ToggleChip` components with consistent gap. */
export const ToggleChipGroup = ({
  children,
  className,
}: { children: React.ReactNode; className?: string }) => (
  <div className={clsx('flex flex-wrap items-center gap-1', className)}>{children}</div>
);

/** Shared visual — used by both Checkbox and CheckboxField to stay DRY. */
const CheckboxIndicator = ({
  checked,
  className,
}: { checked: boolean; className?: string }) => (
  <div
    className={clsx(
      'w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0 transition-all',
      checked
        ? 'bg-[var(--accent)] border-[var(--accent)]'
        : 'bg-transparent border-[var(--border-default)]',
      className
    )}
  >
    {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
  </div>
);

/**
 * Standalone checkbox button — rounded square, accent fill + white ✓ when checked.
 * Use `CheckboxField` for the full label+checkbox combo.
 */
export const Checkbox = ({
  checked,
  onChange,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={clsx(
      'shrink-0 transition-all hover:opacity-80',
      disabled && 'opacity-40 pointer-events-none',
      className
    )}
  >
    <CheckboxIndicator checked={checked} />
  </button>
);

/**
 * Checkbox with label (and optional description).
 * Uses a `<div>` wrapper — NOT a `<button>` — to avoid nested button hydration errors.
 * The whole row is clickable via onClick on the div.
 */
export const CheckboxField = ({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) => (
  <div
    role="checkbox"
    aria-checked={checked}
    onClick={disabled ? undefined : () => onChange(!checked)}
    className={clsx(
      'flex items-start gap-2 w-full cursor-pointer select-none group transition-opacity',
      disabled && 'opacity-40 pointer-events-none',
      className
    )}
  >
    <CheckboxIndicator checked={checked} className="mt-px" />
    <div className="min-w-0">
      <span className="text-[11px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors leading-none block">
        {label}
      </span>
      {description && (
        <span className="text-[9px] text-[var(--text-muted)] mt-0.5 block leading-snug">
          {description}
        </span>
      )}
    </div>
  </div>
);

const SectionHeaderRow = ({
  label,
  trailing,
  className,
}: {
  label: string;
  trailing?: React.ReactNode;
  className?: string;
}) => (
  <div className={clsx(SECTION_HEADER_CLASS, className)}>
    <span className="truncate shrink-0">{label}</span>
    <div className="h-px flex-1 bg-[var(--border-default)]/50 min-w-2" />
    {trailing}
  </div>
);

export const PropertyGrid = ({
  children,
  cols = 2,
  className,
}: { children: React.ReactNode; cols?: 1 | 2 | 3 | 4; className?: string }) => (
  <div
    className={clsx(
      'grid gap-2.5',
      cols === 1 && 'grid-cols-1',
      cols === 2 && 'grid-cols-2',
      cols === 3 && 'grid-cols-3',
      cols === 4 && 'grid-cols-4',
      className
    )}
  >
    {children}
  </div>
);

export const ControlField = ({
  label,
  children,
  className,
  vertical = true,
}: { label: string; children: React.ReactNode; className?: string; vertical?: boolean }) => (
  <div
    className={clsx(
      'flex gap-1.5 transition-colors w-full min-w-0',
      vertical ? 'flex-col' : 'flex-row items-center justify-between',
      className
    )}
  >
    <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)] leading-none select-none">
      {label}
    </span>
    <div className="flex items-center min-h-[24px] w-full min-w-0">{children}</div>
  </div>
);

export const PropertyRow = ({
  label,
  children,
  inline = false,
  className,
}: {
  label: string;
  children: React.ReactNode;
  inline?: boolean;
  className?: string;
}) => (
  <div
    className={clsx(
      'flex transition-colors py-1.5 gap-1.5 items-center w-full min-w-0',
      inline ? 'flex-row justify-between' : 'flex-col items-start',
      className
    )}
  >
    <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-[0.08em] select-none shrink-0">
      {label}
    </div>
    <div className="w-full flex items-center min-w-0">{children}</div>
  </div>
);

export const SectionHeader = ({ label, className }: { label: string; className?: string }) => (
  <SectionHeaderRow label={label} className={className} />
);

/** Light subsection label inside an open collapsible — no bordered card */
export const InsetSection = ({
  label,
  children,
  className,
  contentClassName,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) => (
  <div className={clsx('space-y-2.5 pt-1', className)}>
    <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
      {label}
    </p>
    <div className={clsx('min-w-0', contentClassName)}>{children}</div>
  </div>
);

export const CollapsibleSection = ({
  label,
  children,
  defaultOpen = true,
  action,
  className,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  className?: string;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          SECTION_HEADER_CLASS,
          'w-full justify-between hover:text-[var(--text-secondary)] transition-colors text-left'
        )}
      >
        <span className="truncate shrink-0">{label}</span>
        <div className="h-px flex-1 bg-[var(--border-default)]/50 min-w-2" />
        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {action}
          <ChevronDown
            className={clsx(
              'w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 pointer-events-none',
              !isOpen && '-rotate-90'
            )}
          />
        </div>
      </button>
      {isOpen && <div className="px-2.5 pb-2 pt-0.5 space-y-2 min-w-0">{children}</div>}
    </div>
  );
};
