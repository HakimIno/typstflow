'use client';

import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import {
  Database,
  ListTree,
  Monitor,
  Settings2,
  Cpu,
  Layout,
} from 'lucide-react';

import { memo } from 'react';

export const SidebarNav = memo(function SidebarNav() {
  const activeTab = useDesignerStore((state) => state.activeTab);
  const setActiveTab = useDesignerStore((state) => state.setActiveTab);
  const isSidebarOpen = useDesignerStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useDesignerStore((state) => state.setSidebarOpen);

  const navItems = [
    { id: 'palette', icon: Layout, label: 'Elements' },
    { id: 'outline', icon: ListTree, label: 'Outline' },
    { id: 'data', icon: Cpu, label: 'Data' },
  ];

  const handleTabClick = (tabId: any) => {
    if (activeTab === tabId && isSidebarOpen) {
      setSidebarOpen(false);
    } else {
      setActiveTab(tabId);
    }
  };

  return (
    <aside className="w-14 flex flex-col items-center py-4 bg-slate-100 border-r border-slate-300 shrink-0 z-40">
      {/* Nav Group */}
      <div className="flex-1 flex flex-col items-center gap-2 w-full px-1.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.id)}
            className={clsx(
              "group relative flex flex-col items-center transition-colors duration-100 w-full py-2.5 rounded-sm",
              activeTab === item.id && isSidebarOpen
                ? "bg-white text-slate-800 shadow-sm border border-slate-300"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
            )}
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}
      </div>

      {/* Settings Action */}
      <div className="flex flex-col items-center gap-4 w-full px-1.5 pt-4 border-t border-slate-200">
        <button className="p-2.5 text-slate-400 hover:text-slate-600 transition-colors rounded-sm hover:bg-slate-200" title="Settings">
          <Settings2 className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
});
