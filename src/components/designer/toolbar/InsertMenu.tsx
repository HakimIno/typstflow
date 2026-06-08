import {
  DropdownMenu,
  DropdownMenuHeader,
  DropdownMenuItem,
} from '@/components/shared/DropdownMenu';
import { useDesignerStore } from '@/store/designer-store';
import { Trash2 } from 'lucide-react';
import { memo } from 'react';
import { ToolbarButton } from './ToolbarButton';

export const InsertMenu = memo(function InsertMenu() {
  const loadTemplate = useDesignerStore((state) => state.loadTemplate);

  return (
    <DropdownMenu trigger={<ToolbarButton label="Insert" variant="toolbar-item" showChevron />}>
      <DropdownMenuHeader>Insert Templates</DropdownMenuHeader>

      <DropdownMenuItem
        icon={Trash2}
        label="Clear Canvas (Blank)"
        variant="danger"
        onClick={() => loadTemplate('blank')}
      />
    </DropdownMenu>
  );
});
