'use client';

import type { TableComponent } from '@/types/schema';
import { useState } from 'react';
import { CollapsibleSection, SegmentedControl } from '../Shared';
import { TableGuideLinesPanel } from './TableLinesSection';
import { TableRowsSection } from './TableRowsSection';
import { TABLE_FIELD_STACK } from './TableShared';

interface Props {
  component: TableComponent;
}

const ROW_KIND_OPTIONS = [
  { value: 'header' as const, label: 'Header' },
  { value: 'detail' as const, label: 'Detail' },
  { value: 'footer' as const, label: 'Footer' },
];

export const TableAdvancedSection = ({ component }: Props) => {
  const [rowKind, setRowKind] = useState<'header' | 'detail' | 'footer'>('header');

  return (
    <>
      <CollapsibleSection label="Manual Rows" defaultOpen={false}>
        <div className={TABLE_FIELD_STACK}>
          <SegmentedControl value={rowKind} onChange={setRowKind} options={ROW_KIND_OPTIONS} />
          <TableRowsSection component={component} type={rowKind} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="Guide Lines" defaultOpen={false}>
        <TableGuideLinesPanel component={component} />
      </CollapsibleSection>
    </>
  );
};
