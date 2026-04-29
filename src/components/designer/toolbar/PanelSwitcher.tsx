'use client';

import { useDesignerStore } from '@/store/designer-store';
import { Cpu, Layout, Search } from 'lucide-react';
import { memo } from 'react';
import { ToolbarButton } from './ToolbarButton';

export const PanelSwitcher = memo(function PanelSwitcher() {
  const activeTab = useDesignerStore((state) => state.activeTab);
  const setActiveTab = useDesignerStore((state) => state.setActiveTab);

  const tabs = [
    { id: 'palette', icon: Layout, label: 'Palette' },
    { id: 'outline', icon: Search, label: 'Outline' },
    { id: 'data', icon: Cpu, label: 'Data' },
  ] as const;

  return (
    <div className="flex items-center gap-0.5 mr-4 bg-slate-200 p-0.5 rounded-sm border border-slate-300">
      {tabs.map((tab) => (
        <ToolbarButton
          key={tab.id}
          icon={tab.icon}
          onClick={() => setActiveTab(tab.id)}
          active={activeTab === tab.id}
          variant="ghost"
          title={tab.label}
          className={
            activeTab === tab.id
              ? '!bg-white !text-slate-900 border-slate-400'
              : '!text-slate-500 !hover:bg-slate-300'
          }
        />
      ))}
    </div>
  );
});
