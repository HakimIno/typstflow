'use client';

import { Canvas } from '@/components/designer/Canvas';
import { DataPanel } from '@/components/designer/DataPanel';
import { Palette } from '@/components/designer/Palette';
import { PreviewPane } from '@/components/designer/PreviewPane';
import { PropertiesPanel } from '@/components/designer/PropertiesPanel';
import { ReportTree as ReportTreeComponent } from '@/components/designer/ReportTree';
import { SidebarNav } from '@/components/designer/SidebarNav';
import { Toolbar } from '@/components/designer/Toolbar';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { useEffect, useState } from 'react';

export default function DesignerPage() {
  const [mounted, setMounted] = useState(false);

  // Granular Selectors - Optimized for high performance
  const schema = useDesignerStore((state) => state.schema);
  const viewMode = useDesignerStore((state) => state.viewMode);
  const activeTab = useDesignerStore((state) => state.activeTab);
  const isSidebarOpen = useDesignerStore((state) => state.isSidebarOpen);
  const isRightSidebarOpen = useDesignerStore((state) => state.isRightSidebarOpen);
  const setRightSidebarOpen = useDesignerStore((state) => state.setRightSidebarOpen);

  // Auto-hide Properties in Preview Mode
  useEffect(() => {
    if (viewMode === 'preview') {
      setRightSidebarOpen(false);
    }
  }, [viewMode, setRightSidebarOpen]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const renderLeftPanel = () => {
    switch (activeTab) {
      case 'palette':
        return <Palette />;
      case 'outline':
        return <ReportTreeComponent />;
      case 'data':
        return <DataPanel />;
      default:
        return <Palette />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-200 overflow-hidden font-sans">
      <ErrorBoundary componentName="Toolbar">
        <Toolbar />
      </ErrorBoundary>

      <div className="flex flex-1 overflow-hidden p-0 gap-0 relative">
        {/* Stage 1: Nav Rail (Narrow Sidebar) - Always visible, z-index 50 */}
        <SidebarNav />

        {/* The Detail Drawer and Workspace are synced in a relative container */}
        <div className="flex-1 relative flex overflow-hidden bg-slate-200">

          {/* Stage 2: Detail Drawer (Hardware-Accelerated Slide-out) */}
          <aside
            className={clsx(
              "absolute left-0 top-0 bottom-0 w-80 bg-white border-r border-slate-300 shadow-xl z-30 transition-transform duration-[200ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform",
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="w-80 h-full flex flex-col overflow-hidden">
              <ErrorBoundary componentName="Sidebar Panel">
                {renderLeftPanel()}
              </ErrorBoundary>
            </div>
          </aside>

          {/* Center: Workspace (Design / Preview / Split) - Hardware-Accelerated PUSH */}
          <div
            className={clsx(
              "flex-1 flex overflow-hidden gap-0.5 min-w-0 transition-transform duration-[200ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform transform-gpu",
              isSidebarOpen ? "translate-x-[320px]" : "translate-x-0"
            )}
            style={{ width: '100%' }}
          >
            {(viewMode === 'design' || viewMode === 'split') && (
              <main className={clsx(
                "flex-1 overflow-auto bg-slate-300 shadow-inner flex justify-center p-0 transition-all duration-300",
                viewMode === 'split' && "border-r-2 border-slate-400/50 shadow-2xl z-10"
              )}>
                <ErrorBoundary componentName="Designer Canvas">
                  <Canvas />
                </ErrorBoundary>
              </main>
            )}

            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className="flex-1 flex overflow-hidden transition-all duration-300 bg-slate-200">
                <ErrorBoundary componentName="Preview Engine">
                  <PreviewPane />
                </ErrorBoundary>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Properties - Professional Slide-out (Hardware Accelerated) */}
        <aside
          className={clsx(
            "absolute right-0 top-0 bottom-0 w-64 bg-white pro-panel overflow-hidden border-l border-slate-300 shadow-xl z-30 transition-transform duration-[200ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform",
            isRightSidebarOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="w-64 h-full flex flex-col overflow-hidden">
            <ErrorBoundary componentName="Properties Inspector">
              <PropertiesPanel />
            </ErrorBoundary>
          </div>
        </aside>
      </div>

      {/* Status Bar */}
      <footer className="h-6 bg-slate-700 text-slate-300 px-3 flex items-center justify-between text-[10px] uppercase tracking-wider font-bold shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 border-r border-slate-600 pr-4">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>Status: Ready</span>
          </div>
          <span className="opacity-50 text-[9px]">Report: {schema.name}</span>
        </div>
        <div className="flex gap-4">
          <span className="text-[9px]">
            {schema.page.size} {schema.page.orientation}
          </span>
          <span className="opacity-50 text-[9px]">v{schema.version}</span>
        </div>
      </footer>
    </div>
  );
}
