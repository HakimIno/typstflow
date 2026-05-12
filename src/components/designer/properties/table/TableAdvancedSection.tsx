import type { TableComponent } from '@/types/schema';
import { TableLinesSection } from './TableLinesSection';
import { TableRowsSection } from './TableRowsSection';

interface Props {
  component: TableComponent;
}

export const TableAdvancedSection = ({ component }: Props) => {
  return (
    <div className="flex flex-col gap-4 p-2 animate-in fade-in slide-in-from-right-1 duration-200">
      <div>
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-2 mb-1 block">Manual Header Rows</span>
        <TableRowsSection component={component} type="header" />
      </div>
      <div className="border-t border-[var(--border-default)] pt-4">
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-2 mb-1 block">Manual Footer Rows</span>
        <TableRowsSection component={component} type="footer" />
      </div>
      <div className="border-t border-[var(--border-default)] pt-4">
        <TableLinesSection component={component} />
      </div>
    </div>
  );
};
