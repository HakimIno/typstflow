'use client';

import { useDesignerStore } from '@/store/designer-store';
import { Moon, Sun, Palette as PaletteIcon } from 'lucide-react';
import { memo } from 'react';
import { clsx } from 'clsx';

const ACCENT_COLORS = [
  { name: 'Purple', color: '#8B5CF6' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Pink', color: '#EC4899' },
  { name: 'Orange', color: '#F59E0B' },
  { name: 'Green', color: '#10B981' },
  { name: 'Slate', color: '#64748B' },
];

export const ThemeSettings = memo(function ThemeSettings() {
  const theme = useDesignerStore((state) => state.theme);
  const setTheme = useDesignerStore((state) => state.setTheme);
  const primaryColor = useDesignerStore((state) => state.primaryColor);
  const setPrimaryColor = useDesignerStore((state) => state.setPrimaryColor);

  return (
    <div className="flex items-center gap-4 px-2">
      {/* Theme Toggle */}
      <div className="flex items-center bg-[var(--bg-widget)] rounded-full p-1 border border-[var(--border-default)] shadow-inner">
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={clsx(
            "p-1.5 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center",
            theme === 'light' 
              ? "bg-white shadow-md text-amber-500 scale-110" 
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          )}
          title="Light Mode"
        >
          <Sun className="w-3.5 h-3.5 pointer-events-none" />
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={clsx(
            "p-1.5 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center",
            theme === 'dark' 
              ? "bg-[var(--bg-surface)] shadow-md text-[var(--accent)] scale-110 border border-[var(--border-default)]" 
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          )}
          title="Dark Mode"
        >
          <Moon className="w-3.5 h-3.5 pointer-events-none" />
        </button>
      </div>

      {/* Primary Color Picker */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-widget)] rounded-full border border-[var(--border-default)]">
        {ACCENT_COLORS.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => setPrimaryColor(c.color)}
            className={clsx(
              "w-3.5 h-3.5 rounded-full transition-all hover:scale-125 cursor-pointer ring-offset-1 ring-offset-[var(--bg-surface)]",
              primaryColor === c.color ? "ring-2 ring-[var(--accent)] scale-110" : "opacity-60 hover:opacity-100"
            )}
            style={{ backgroundColor: c.color }}
            title={c.name}
          />
        ))}
      </div>
    </div>
  );
});
