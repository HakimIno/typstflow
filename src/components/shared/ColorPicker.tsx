'use client';

import { clsx } from 'clsx';
import { Check, Hash, Pipette } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { DropdownMenu, useDropdown } from './DropdownMenu';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
  className?: string;
  compact?: boolean;
}

const PRESET_COLORS = [
  // Row 1: Grayscale & Core
  '#000000', '#4B5563', '#9CA3AF', '#D1D5DB', '#FFFFFF', '#EF4444', '#F97316', '#F5A524',
  // Row 2: Vivid Colors
  '#EAB308', '#84CC16', '#22C55E', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
];

const ColorPickerContent = ({ color, onChange }: { color: string, onChange: (color: string) => void }) => {
  const { setIsOpen } = useDropdown();
  const [inputValue, setInputValue] = useState(color);

  useEffect(() => {
    setInputValue(color);
  }, [color]);

  const handleHexChange = useCallback((val: string) => {
    setInputValue(val);
    if (/^#?([0-9A-F]{3}){1,2}$/i.test(val)) {
      const formatted = val.startsWith('#') ? val : `#${val}`;
      onChange(formatted);
    }
  }, [onChange]);

  return (
    <div className="p-2 w-[200px] flex flex-col gap-2">
      {/* Presets Grid - 8 columns per row */}
      <div className="grid grid-cols-8 gap-1">
        {PRESET_COLORS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              onChange(preset);
              setIsOpen(false);
            }}
            className={clsx(
              'w-full aspect-square rounded-[3px] border border-black/10 transition-all hover:scale-110 active:scale-95 flex items-center justify-center relative',
              color.toUpperCase() === preset.toUpperCase() && 'ring-1 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-surface)] z-10'
            )}
            style={{ backgroundColor: preset }}
          >
            {color.toUpperCase() === preset.toUpperCase() && (
              <Check className={clsx(
                "w-2 h-2",
                preset.toLowerCase() === '#ffffff' ? "text-black" : "text-white"
              )} />
            )}
          </button>
        ))}
      </div>

      {/* Custom & Advanced */}
      <div className="pt-2 border-t border-[var(--border-default)] flex items-center gap-1.5">
        <div className="relative flex-1">
          <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            <Hash className="w-2 h-2" />
          </div>
          <input
            type="text"
            value={inputValue.replace('#', '')}
            onChange={(e) => handleHexChange(e.target.value)}
            className="w-full bg-[var(--bg-widget)] border border-[var(--border-default)] text-[10px] font-mono text-[var(--text-primary)] rounded pl-4 pr-1 py-1 focus:outline-none focus:border-[var(--accent)] transition-colors uppercase"
            placeholder="000000"
          />
        </div>
        <label className="shrink-0 cursor-pointer group relative">
          <div className="w-5 h-5 rounded bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 border border-white/20 shadow-sm transition-transform group-hover:scale-105" />
          <input
            type="color"
            className="sr-only"
            value={color}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
          />
        </label>
      </div>
    </div>
  );
};

export const ColorPicker = memo(function ColorPicker({
  color = '#000000',
  onChange,
  className,
  compact,
}: ColorPickerProps) {
  return (
    <DropdownMenu
      className={clsx('w-full', className)}
      align="right"
      trigger={
        <button
          type="button"
          className={clsx(
            "w-full flex items-center bg-[var(--bg-widget)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)] rounded transition-all group",
            compact ? "h-7 justify-center px-1" : "gap-1.5 px-1.5 py-1 h-7"
          )}
        >
          <div
            className="w-4 h-4 rounded-full border border-black/10 shrink-0 shadow-sm"
            style={{ backgroundColor: color }}
          />
          {!compact && (
            <span className="text-[10px] font-mono text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors uppercase leading-none">
              {color}
            </span>
          )}
          {!compact && (
            <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
              <Pipette className="w-3 h-3 text-[var(--text-muted)]" />
            </div>
          )}
        </button>
      }
    >
      <ColorPickerContent color={color} onChange={onChange} />
    </DropdownMenu>
  );
});
