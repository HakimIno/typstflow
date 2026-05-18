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
import { useFontInstaller } from '@/hooks/use-font-installer';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { AlertCircle, AlertTriangle, Info, Terminal, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function DesignerPage() {
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogPanel, setShowLogPanel] = useState(false);

  useKeyboardShortcuts();
  useFontInstaller(); // Re-register persisted fonts on hydration

  useEffect(() => {
    const handleLog = (type: string, ...args: any[]) => {
      const msg = `[${type.toUpperCase()}] ${args
        .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
        .join(' ')}`;
      setLogs((prev) => [...prev.slice(-99), msg]);
    };

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
      originalLog(...args);
      handleLog('log', ...args);
    };
    console.warn = (...args) => {
      originalWarn(...args);
      handleLog('warn', ...args);
    };
    console.error = (...args) => {
      originalError(...args);
      handleLog('error', ...args);
    };

    const handleError = (e: ErrorEvent) => {
      handleLog('uncaught', e.message);
    };
    window.addEventListener('error', handleError);

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      window.removeEventListener('error', handleError);
    };
  }, []);

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

  if (!mounted || !_hasHydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg-app)]">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent) transparent transparent transparent' }}
          />
          <span className="text-[11px] text-white/25 tracking-wide">Loading...</span>
        </div>
      </div>
    );
  }

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

      {/* Floating Diagnostic Panel (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-8 right-8 z-[9999] flex flex-col items-end gap-2 select-none pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowLogPanel(!showLogPanel)}
            className="flex items-center gap-2 bg-zinc-900/85 hover:bg-zinc-900 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider shadow-2xl backdrop-blur-md active:scale-95 transition-all"
          >
            <Terminal className="w-3.5 h-3.5 text-zinc-500" />
            <span>Dev Console</span>
            <span className="flex items-center justify-center bg-zinc-800/80 px-1.5 py-0.5 rounded text-[8px] font-semibold text-zinc-300 font-mono">
              {logs.length}
            </span>
          </button>

          {showLogPanel && (
            <div className="w-[580px] h-[360px] bg-zinc-950/95 text-zinc-300 font-mono text-[10px] p-4 rounded-xl overflow-hidden border border-zinc-800/60 shadow-[0_20px_50px_rgba(0,0,0,0.65)] flex flex-col backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Header */}
              <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2.5 mb-2.5 text-zinc-400 font-bold text-[8.5px] uppercase tracking-wider shrink-0 select-none">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-zinc-300 font-bold">System Diagnostics</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setLogs([])}
                    className="flex items-center gap-1 hover:text-zinc-200 transition-colors text-[8px]"
                    title="Clear Console"
                  >
                    <Trash2 className="w-3 h-3 text-zinc-500" />
                    <span>Clear</span>
                  </button>
                  <div className="w-px h-2.5 bg-zinc-800" />
                  <button
                    type="button"
                    onClick={() => setShowLogPanel(false)}
                    className="hover:text-zinc-200 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-zinc-500" />
                  </button>
                </div>
              </div>

              {/* Log List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar select-text">
                {logs.map((log, i) => {
                  const isError =
                    log.includes('[ERROR]') ||
                    log.includes('[UNCAUGHT]') ||
                    log.includes('error') ||
                    log.includes('Error') ||
                    log.includes('failed');
                  const isWarn =
                    log.includes('[WARN]') || log.includes('warn') || log.includes('Warning');

                  return (
                    <div
                      key={i}
                      className={clsx(
                        'flex gap-2 p-1.5 rounded border text-[9.5px] break-all leading-relaxed font-mono transition-all',
                        isError
                          ? 'bg-red-500/5 border-red-500/10 text-red-300/90'
                          : isWarn
                            ? 'bg-amber-500/5 border-amber-500/10 text-amber-300/90'
                            : 'bg-zinc-900/10 border-zinc-800/20 text-zinc-300/85'
                      )}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {isError ? (
                          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                        ) : isWarn ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <Info className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                      </div>
                      <div className="flex-1">{log}</div>
                    </div>
                  );
                })}

                {logs.length === 0 && (
                  <div className="text-zinc-600 italic py-16 text-center text-[9px] flex flex-col items-center justify-center gap-2 select-none">
                    <Terminal className="w-6 h-6 text-zinc-800" />
                    <span>
                      No logs generated yet. Perform canvas actions to trigger compiler events.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
