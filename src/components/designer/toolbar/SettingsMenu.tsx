import {
  DropdownMenu,
  DropdownMenuHeader,
  DropdownMenuSeparator,
} from '@/components/shared/DropdownMenu';
import { Palette, Settings } from 'lucide-react';
import { memo } from 'react';
import { ThemeSettings } from './ThemeSettings';
import { ToolbarButton } from './ToolbarButton';

export const SettingsMenu = memo(function SettingsMenu() {
  return (
    <DropdownMenu align="right" trigger={<ToolbarButton icon={Settings} variant="toolbar-item" />}>
      <DropdownMenuHeader>Application Settings</DropdownMenuHeader>

      <div className="p-2 flex flex-col gap-4 min-w-[260px]">
        {/* Theme Section */}
        <div className="flex flex-col gap-2">
          <div className="px-1 text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-2">
            <Palette className="w-3.5 h-3.5" />
            Theme & Branding
          </div>
          <div className="bg-[var(--bg-app)] rounded-lg p-2 border border-[var(--border-default)]">
            <ThemeSettings />
          </div>
        </div>

        {/* Auto-save indicator */}
        <div className="border-t border-[var(--border-default)] pt-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] text-[var(--text-muted)]">Auto-save</span>
            <div className="w-6 h-3 bg-[var(--green)] rounded-full opacity-50" />
          </div>
        </div>
      </div>

      <DropdownMenuSeparator />

      <div className="px-3 py-1 flex justify-between items-center">
        <span className="text-[9px] text-[var(--text-muted)] font-mono">TypstFlow v1.0.0</span>
      </div>
    </DropdownMenu>
  );
});
