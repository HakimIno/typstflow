import type { TableComponent } from '@/types/schema';
import { clsx } from 'clsx';
import {
  Columns3,
  Database,
  Paintbrush,
  Settings2
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { TableColumnsSection } from './properties/table/TableColumnsSection';
import { TableDataSection } from './properties/table/TableDataSection';
import { TableVisualSection } from './properties/table/TableVisualSection';
import { TableAdvancedSection } from './properties/table/TableAdvancedSection';

type TableTab = 'columns' | 'data' | 'style' | 'advanced';

const TAB_CONFIG: { id: TableTab; label: string; icon: React.ElementType }[] = [
  { id: 'columns', label: 'Cols', icon: Columns3 },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'style', label: 'Style', icon: Paintbrush },
  { id: 'advanced', label: 'Adv.', icon: Settings2 },
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
        {activeTab === 'data' && <TableDataSection component={component} />}
        {activeTab === 'style' && <TableVisualSection component={component} />}
        {activeTab === 'advanced' && <TableAdvancedSection component={component} />}
      </div>
    </div>
  );
};
