import type { TableComponent } from '@/types/schema';
import { CollapsibleSection } from '../Shared';
import { TableLinesSection } from './TableLinesSection';
import { TableRowsSection } from './TableRowsSection';

interface Props {
  component: TableComponent;
}

export const TableAdvancedSection = ({ component }: Props) => {
  return (
    <div className="flex flex-col gap-1 bg-[var(--bg-widget)] animate-in fade-in slide-in-from-right-1 duration-200">
      <CollapsibleSection label="Manual Header Rows" defaultOpen={false}>
        <TableRowsSection component={component} type="header" />
      </CollapsibleSection>
      <CollapsibleSection label="Manual Detail Rows" defaultOpen={false}>
        <TableRowsSection component={component} type="detail" />
      </CollapsibleSection>
      <CollapsibleSection label="Manual Footer Rows" defaultOpen={false}>
        <TableRowsSection component={component} type="footer" />
      </CollapsibleSection>
      <TableLinesSection component={component} />
    </div>
  );
};
