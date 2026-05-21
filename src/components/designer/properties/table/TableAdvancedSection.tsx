import type { TableComponent } from '@/types/schema';
import { CollapsibleSection, PROPERTY_STACK_CLASS } from '../Shared';
import { TableLinesSection } from './TableLinesSection';
import { TableRowsSection } from './TableRowsSection';

interface Props {
  component: TableComponent;
}

export const TableAdvancedSection = ({ component }: Props) => {
  return (
    <div className={`${PROPERTY_STACK_CLASS} animate-in fade-in slide-in-from-right-1 duration-200`}>
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
