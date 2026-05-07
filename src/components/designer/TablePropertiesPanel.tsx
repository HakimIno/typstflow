import { useDesignerStore } from '@/store/designer-store';
import type { TableComponent } from '@/types/schema';
import { clsx } from 'clsx';
import {
  BoxSelect,
  Columns3,
  Database,
  Grid3X3,
  Paintbrush,
  Rows3,
  Layers
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { TableColumnsSection } from './properties/table/TableColumnsSection';
import { TableDataSection } from './properties/table/TableDataSection';
import { TableGroupingSection } from './properties/table/TableGroupingSection';
import { TableLinesSection } from './properties/table/TableLinesSection';
import { TableRowsSection } from './properties/table/TableRowsSection';
import { TableVisualSection } from './properties/table/TableVisualSection';

type TableTab = 'columns' | 'rows' | 'style' | 'lines' | 'data' | 'grouping';

const TAB_CONFIG: { id: TableTab; label: string; icon: React.ElementType }[] = [
  { id: 'columns', label: 'Cols', icon: Columns3 },
  { id: 'rows', label: 'Rows', icon: Rows3 },
  { id: 'grouping', label: 'Group', icon: Layers },
  { id: 'style', label: 'Style', icon: Paintbrush },
  { id: 'lines', label: 'Lines', icon: Grid3X3 },
  { id: 'data', label: 'Data', icon: Database },
];

interface Props {
  component: TableComponent;
}

export const TablePropertiesPanel = ({ component }: Props) => {
  const [activeTab, setActiveTab] = useState<TableTab>('columns');

  return (
    <div className="flex flex-col bg-[var(--bg-surface)]">
      {/* Tab Navigation */}
      <div className="flex bg-white/[0.02] border-b border-[var(--border-default)] overflow-x-auto scrollbar-none">
        {TAB_CONFIG.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex-1 min-w-[50px] flex flex-col items-center py-2 px-1 transition-all border-b-2',
              activeTab === tab.id
                ? 'text-[var(--accent)] border-[var(--accent)] bg-[var(--accent)]/5'
                : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)] hover:bg-white/[0.02]'
            )}
          >
            <tab.icon className="w-3.5 h-3.5 mb-1" />
            <span className="text-[8px] font-bold uppercase tracking-tighter">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="overflow-auto max-h-[500px]">
        {activeTab === 'columns' && <TableColumnsSection component={component} />}
        {activeTab === 'rows' && (
          <div className="space-y-4 p-2">
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-2 mb-1 block">Header Rows</span>
              <TableRowsSection component={component} type="header" />
            </div>
            <div className="border-t border-[var(--border-default)] pt-4">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-2 mb-1 block">Footer Rows</span>
              <TableRowsSection component={component} type="footer" />
            </div>
          </div>
        )}
        {activeTab === 'grouping' && <TableGroupingSection component={component} />}
        {activeTab === 'style' && <TableVisualSection component={component} />}
        {activeTab === 'lines' && <TableLinesSection component={component} />}
        {activeTab === 'data' && <TableDataSection component={component} />}
      </div>
    </div>
  );
};
