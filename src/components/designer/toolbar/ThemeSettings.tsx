'use client';

import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { Moon, Sun } from 'lucide-react';
import { memo } from 'react';
import { SegmentedControl } from './SegmentedControl';

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
      <SegmentedControl
        shape="pill"
        options={[
          {
            value: 'light',
            icon: Sun,
            title: 'Light Mode',
            activeClassName: 'bg-white shadow-md text-amber-500 scale-110',
          },
          {
            value: 'dark',
            icon: Moon,
            title: 'Dark Mode',
            activeClassName:
              'bg-[var(--bg-surface)] shadow-md text-[var(--accent)] scale-110 border border-[var(--border-default)]',
          },
        ]}
        value={theme}
        onChange={setTheme}
        className="bg-[var(--bg-widget)] p-1 shadow-inner"
        itemClassName="duration-200"
        inactiveItemClassName="text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
      />

      {/* Primary Color Picker */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-widget)] rounded-full border border-[var(--border-default)]">
        {ACCENT_COLORS.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => setPrimaryColor(c.color)}
            className={clsx(
              'w-3.5 h-3.5 rounded-full transition-all hover:scale-125 cursor-pointer ring-offset-1 ring-offset-[var(--bg-surface)]',
              primaryColor === c.color
                ? 'ring-2 ring-[var(--accent)] scale-110'
                : 'opacity-60 hover:opacity-100'
            )}
            style={{ backgroundColor: c.color }}
            title={c.name}
          />
        ))}
      </div>
    </div>
  );
});
