'use client';

import { Canvas } from '@/components/designer/Canvas';
import { PreviewPane } from '@/components/designer/PreviewPane';
import { PropertiesPanel } from '@/components/designer/PropertiesPanel';
import { SidebarNav } from '@/components/designer/SidebarNav';
import { Toolbar } from '@/components/designer/Toolbar';
import { AiPanel } from '@/components/designer/panel/AiPanel';
import { DataPanel } from '@/components/designer/panel/DataPanel';
import { LayersPanel } from '@/components/designer/panel/LayersPanel';
import { Palette } from '@/components/designer/panel/Palette';
import { AlertDialog } from '@/components/shared/AlertDialog';
import { DesignerErrorBoundary } from '@/components/shared/ErrorBoundary';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useFontInstaller } from '@/hooks/use-font-installer';

import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { useEffect, useState } from 'react';

export default function DesignerPage() {
  const [mounted, setMounted] = useState(false);
  useKeyboardShortcuts();
  useFontInstaller(); // Re-register persisted fonts on hydration

  // Granular Selectors - Optimized for high performance
  const _hasHydrated = useDesignerStore((state) => state._hasHydrated);
  const schemaName = useDesignerStore((state) => state.schema.name);
  const schemaVersion = useDesignerStore((state) => state.schema.version);
  const pageSize = useDesignerStore((state) => state.schema.page.size);
  const pageOrientation = useDesignerStore((state) => state.schema.page.orientation);
  const viewMode = useDesignerStore((state) => state.viewMode);
  const activeTab = useDesignerStore((state) => state.activeTab);
  const isSidebarOpen = useDesignerStore((state) => state.isSidebarOpen);
  const isRightSidebarOpen = useDesignerStore((state) => state.isRightSidebarOpen);
  const setRightSidebarOpen = useDesignerStore((state) => state.setRightSidebarOpen);
  const theme = useDesignerStore((state) => state.theme);
  const primaryColor = useDesignerStore((state) => state.primaryColor);

  // Apply Theme & Primary Color
  // Theme & Accent styles
  const themeStyles = {
    '--accent': primaryColor,
    '--accent-glow': primaryColor.startsWith('#')
      ? `${primaryColor}15`
      : 'rgba(139, 92, 246, 0.15)',
  } as React.CSSProperties;

  // Apply Theme to HTML root for global effects (portals, browser UI, etc)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  // Auto-hide Properties in Preview Mode
  useEffect(() => {
    if (viewMode === 'preview') {
      setRightSidebarOpen(false);
    }
  }, [viewMode, setRightSidebarOpen]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !_hasHydrated) return null;

  const renderLeftPanel = () => {
    switch (activeTab) {
      case 'palette':
        return <Palette />;
      case 'outline':
        return <LayersPanel />;
      case 'data':
        return <DataPanel />;
      case 'ai':
        return <AiPanel />;
      default:
        return <Palette />;
    }
  };

  return (
    <div
      className={clsx('flex flex-col h-screen bg-[var(--bg-app)] overflow-hidden font-sans', theme)}
      style={themeStyles}
    >
      <DesignerErrorBoundary componentName="Toolbar">
        <Toolbar />
      </DesignerErrorBoundary>

      <div className="flex flex-1 overflow-hidden p-0 gap-0 relative">
        {/* Stage 1: Nav Rail (Narrow Sidebar) - Always visible, z-index 50 */}
        <SidebarNav />

        {/* The Detail Drawer and Workspace are synced in a relative container */}
        <div className="flex-1 relative flex overflow-hidden bg-[var(--bg-app)]">
          {/* Stage 2: Detail Drawer (Hardware-Accelerated Slide-out) */}
          <aside
            className={clsx(
              'absolute left-0 top-0 bottom-0 w-80 bg-[var(--bg-surface)] border-r border-[var(--border-default)] z-30 transition-transform duration-[200ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform shadow-[var(--shadow-premium)]',
              isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            <div className="w-80 h-full flex flex-col overflow-hidden">
              <DesignerErrorBoundary componentName="Sidebar Panel">
                {renderLeftPanel()}
              </DesignerErrorBoundary>
            </div>
          </aside>

          {/* Center: Workspace (Design / Preview / Split) - Hardware-Accelerated PUSH */}
          <div
            className={clsx(
              'flex-1 flex overflow-hidden gap-0.5 min-w-0 transition-transform duration-[200ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform transform-gpu',
              isSidebarOpen ? 'translate-x-[320px]' : 'translate-x-0'
            )}
            style={{ width: '100%' }}
          >
            {(viewMode === 'design' || viewMode === 'split') && (
              <main
                className={clsx(
                  'flex-1 overflow-auto bg-[var(--bg-canvas)] flex justify-center p-0 transition-all duration-300',
                  viewMode === 'split' &&
                    'border-r-2 border-[var(--border-default)] shadow-2xl z-10'
                )}
              >
                <DesignerErrorBoundary componentName="Designer Canvas">
                  <Canvas />
                </DesignerErrorBoundary>
              </main>
            )}

            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className="flex-1 flex overflow-hidden transition-all duration-300 bg-[var(--bg-app)]">
                <DesignerErrorBoundary componentName="Preview Engine">
                  <PreviewPane />
                </DesignerErrorBoundary>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Properties - Professional Slide-out (Hardware Accelerated) */}
        <aside
          className={clsx(
            'absolute right-0 top-0 bottom-0 w-64 bg-[var(--bg-surface)] overflow-hidden border-l border-[var(--border-default)] z-30 transition-transform duration-[200ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform shadow-[var(--shadow-premium)]',
            isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          <div className="w-64 h-full flex flex-col overflow-hidden">
            <DesignerErrorBoundary componentName="Properties Inspector">
              <PropertiesPanel />
            </DesignerErrorBoundary>
          </div>
        </aside>
      </div>

      {/* Status Bar */}
      <footer className="h-[26px] bg-[var(--bg-surface)] border-t border-[var(--border-default)] text-[var(--text-muted)] px-3 flex items-center justify-between text-[9px] uppercase tracking-[0.06em] font-medium shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 pr-4 border-r border-[var(--border-default)]">
            <div className="w-[5px] h-[5px] bg-[var(--green)] rounded-full" />
            <span>STATUS: READY</span>
          </div>
          <span className="text-[9px]">REPORT: {schemaName}</span>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-[9px]">
            {pageSize} {pageOrientation}
          </span>
          <div className="w-px h-2.5 border-r border-[var(--border-default)]" />
          <span className="text-[9px]">V{schemaVersion}</span>
        </div>
      </footer>

      <AlertDialog />
    </div>
  );
}
