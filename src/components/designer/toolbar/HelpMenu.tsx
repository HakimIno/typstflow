import {
  DropdownMenu,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
} from '@/components/shared/DropdownMenu';
import { BookOpen, Keyboard, MessageSquare } from 'lucide-react';
import { memo } from 'react';
import { ShortcutGuide } from './ShortcutGuide';
import { ToolbarButton } from './ToolbarButton';

export const HelpMenu = memo(function HelpMenu() {
  return (
    <DropdownMenu trigger={<ToolbarButton label="Help" variant="toolbar-item" showChevron />}>
      <DropdownMenuHeader>Resources</DropdownMenuHeader>

      <DropdownMenuSub icon={Keyboard} label="Keyboard Shortcuts">
        <ShortcutGuide forcedOpen />
      </DropdownMenuSub>

      <DropdownMenuItem icon={BookOpen} label="Documentation" />

      <DropdownMenuSeparator />

      <DropdownMenuItem icon={MessageSquare} label="Feedback & Support" />
    </DropdownMenu>
  );
});
