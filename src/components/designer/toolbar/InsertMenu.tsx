import {
  DropdownMenu,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/shared/DropdownMenu';
import { useDesignerStore } from '@/store/designer-store';
import { FileDown, Play, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { ToolbarButton } from './ToolbarButton';

export const InsertMenu = memo(function InsertMenu() {
  const loadTemplate = useDesignerStore((state) => state.loadTemplate);

  const handleLoad = (name: 'blank' | 'invoice' | 'complex' | 'invoice-with-breaks') => {
    loadTemplate(name);
  };

  return (
    <DropdownMenu trigger={<ToolbarButton label="Insert" variant="toolbar-item" showChevron />}>
      <DropdownMenuHeader>Insert Templates</DropdownMenuHeader>

      <DropdownMenuItem
        icon={Play}
        label="Advanced Table Demo"
        onClick={() => handleLoad('complex')}
      />

      <DropdownMenuItem
        icon={() => (
          <div className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-[var(--accent-glow)] text-[var(--accent)] text-[10px] font-bold">
            T
          </div>
        )}
        label="Tax Invoice (Blue Sky)"
        onClick={() => handleLoad('tax-invoice' as any)}
      />

      <DropdownMenuItem
        icon={FileDown}
        label="Invoice w/ Page Breaks"
        onClick={() => handleLoad('invoice-with-breaks')}
      />

      <DropdownMenuSeparator />

      <DropdownMenuItem
        icon={Trash2}
        label="Clear Canvas (Blank)"
        variant="danger"
        onClick={() => handleLoad('blank')}
      />
    </DropdownMenu>
  );
});
