'use client';

import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { Cpu, Layers, Layout, Settings2 } from 'lucide-react';
import { memo } from 'react';

export const SidebarNav = memo(function SidebarNav() {
  const activeTab = useDesignerStore((state) => state.activeTab);
  const setActiveTab = useDesignerStore((state) => state.setActiveTab);
  const isSidebarOpen = useDesignerStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useDesignerStore((state) => state.setSidebarOpen);

  const navItems = [
    { id: 'palette' as const, icon: Layout, label: 'Elements' },
    { id: 'outline' as const, icon: Layers, label: 'Layers' },
    { id: 'data' as const, icon: Cpu, label: 'Data' },
  ];

  const handleTabClick = (tabId: 'palette' | 'outline' | 'data') => {
    if (activeTab === tabId && isSidebarOpen) {
      setSidebarOpen(false);
    } else {
      setActiveTab(tabId);
    }
  };

  return (
    <aside className="w-[36px] flex flex-col items-center py-4 bg-[var(--bg-surface)] backdrop-blur-2xl border-r border-[var(--border-default)] shrink-0 z-40">
      {/* Nav Group */}
      <div className="flex-1 flex flex-col items-center gap-2 w-full px-1.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleTabClick(item.id)}
            className={clsx(
              'group relative flex flex-col items-center transition-all duration-150 w-7 h-7 justify-center rounded-[5px]',
              activeTab === item.id && isSidebarOpen
                ? 'bg-[var(--accent-glow)] text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            )}
            title={item.label}
          >
            <item.icon className="w-[14px] h-[14px]" />
          </button>
        ))}
      </div>

      {/* Settings Action */}
      <div className="flex flex-col items-center gap-4 w-full px-1.5 pt-4 border-t border-[var(--border-default)]">
        <button
          type="button"
          className="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors rounded-[5px] hover:bg-[var(--bg-hover)]"
          title="Settings"
        >
          <Settings2 className="w-[14px] h-[14px]" />
        </button>
      </div>
    </aside>
  );
});
