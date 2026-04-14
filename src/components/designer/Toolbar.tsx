'use client';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Cpu,
  Download,
  FileText,
  Layout,
  PanelRight,
  Play,
  Redo,
  Save,
  Search,
  Undo,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { memo, useEffect, useState } from 'react';

export const Toolbar = memo(function Toolbar() {
  const schema = useDesignerStore((state) => state.schema);
  const updateSchema = useDesignerStore((state) => state.updateSchema);
  const viewMode = useDesignerStore((state) => state.viewMode);
  const setViewMode = useDesignerStore((state) => state.setViewMode);
  const zoom = useDesignerStore((state) => state.zoom);
  const setZoom = useDesignerStore((state) => state.setZoom);
  const activeTab = useDesignerStore((state) => state.activeTab);
  const setActiveTab = useDesignerStore((state) => state.setActiveTab);
  const selectedComponentId = useDesignerStore((state) => state.selectedComponentId);
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const undo = useDesignerStore((state) => state.undo);
  const redo = useDesignerStore((state) => state.redo);
  const history = useDesignerStore((state) => state.history);
  const historyIndex = useDesignerStore((state) => state.historyIndex);
  const sampleData = useDesignerStore((state) => state.sampleData);
  const [isExporting, setIsExporting] = useState(false);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      } else if (isMod && e.key === 'y') {
        redo();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleAlign = (type: string) => {
    if (!selectedComponentId) return;

    const A4_WIDTH_MM = schema.page.orientation === 'landscape' ? 297 : 210;
    const PAGE_CONTENT_WIDTH = A4_WIDTH_MM - 40; // Approx

    switch (type) {
      case 'left':
        updateComponent(selectedComponentId, { x: 0 });
        break;
      case 'center':
        updateComponent(selectedComponentId, { x: PAGE_CONTENT_WIDTH / 2 - 50 });
        break; 
      case 'right':
        updateComponent(selectedComponentId, { x: PAGE_CONTENT_WIDTH - 100 });
        break;
    }
  };

  const handleExport = async () => {
    const { renderReportToPdf } = await import('@/lib/typst-wasm');
    const { downloadPdf } = await import('@/lib/export-utils');

    setIsExporting(true);
    try {
      const pdfBytes = await renderReportToPdf(schema, sampleData);
      downloadPdf(pdfBytes, `${schema.name || 'report'}.pdf`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to generate PDF. Check console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSource = async () => {
    const { generateReportTypst } = await import('@/lib/typst-wasm');
    const { downloadText } = await import('@/lib/export-utils');

    try {
      const source = await generateReportTypst(schema, sampleData);
      downloadText(source, `${schema.name || 'report'}.typ`);
    } catch (error) {
      console.error('Download source failed:', error);
      alert('Failed to generate source.');
    }
  };

  return (
    <div className="flex flex-col flex-shrink-0">
      {/* Top Main Toolbar preserved */}
      <header className="h-8 bg-slate-800 flex items-center justify-between px-3 border-b border-slate-900 shadow-md z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-600 rounded-sm">
            <Cpu className="w-3.5 h-3.5 text-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-tighter">
              TypstFlow Pro
            </span>
          </div>

          <nav className="flex items-center gap-1">
            {['File', 'Edit'].map((item) => (
              <button
                key={item}
                type="button"
                className="px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 hover:text-white rounded-sm"
              >
                {item}
              </button>
            ))}
            <div className="relative group">
              <button
                type="button"
                className="px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 hover:text-white rounded-sm"
              >
                Insert
              </button>
              <div className="absolute top-full left-0 hidden group-hover:block bg-slate-800 border border-slate-700 shadow-xl rounded-md py-1 min-w-[160px] z-[100]">
                <button
                  type="button"
                  onClick={() => useDesignerStore.getState().loadTemplate('complex')}
                  className="w-full text-left px-3 py-1.5 text-[10px] text-slate-300 hover:bg-blue-600 hover:text-white flex items-center gap-2"
                >
                  <Play className="w-3 h-3 text-green-400" />
                  Advanced Table Demo
                </button>
                <div className="h-px bg-slate-700 my-1" />
                <button
                  type="button"
                  onClick={() => useDesignerStore.getState().loadTemplate('blank')}
                  className="w-full text-left px-3 py-1.5 text-[10px] text-red-400 hover:bg-red-600 hover:text-white"
                >
                  Clear Canvas
                </button>
              </div>
            </div>
            {['Format', 'View', 'Tools', 'Help'].map((item) => (
              <button
                key={item}
                type="button"
                className="px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 hover:text-white rounded-sm"
              >
                {item}
              </button>
            ))}
          </nav>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-slate-900/50 rounded-sm p-0.5 border border-slate-700">
          {(['design', 'preview', 'split'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={clsx(
                'px-3 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all',
                viewMode === mode
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono">v{schema.version}</span>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-sm">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[9px] text-green-500 font-bold uppercase">
              Live Preview Active
            </span>
          </div>
        </div>
      </header>

      {/* Sub Toolbar */}
      <div className="h-10 bg-slate-100 border-b border-slate-300 flex items-center justify-between px-4">
        <div className="flex items-center gap-1">
          {/* Panel Selector */}
          <div className="flex items-center gap-0.5 mr-4 bg-slate-200 p-0.5 rounded-sm border border-slate-300">
            {[
              { id: 'palette', icon: Layout, label: 'Palette' },
              { id: 'outline', icon: Search, label: 'Outline' },
              { id: 'data', icon: Cpu, label: 'Data' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as 'palette' | 'outline' | 'data')}
                className={clsx(
                  'p-1.5 rounded-sm transition-all',
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
                title={tab.label}
              >
                <tab.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 bg-white border border-slate-300 rounded-sm p-0.5 mr-2">
            <button
              type="button"
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-1 hover:bg-slate-100 text-slate-600 disabled:opacity-30"
              title="Undo (Cmd+Z)"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-1 hover:bg-slate-100 text-slate-600 disabled:opacity-30"
              title="Redo (Cmd+Shift+Z)"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-6 w-px bg-slate-300 mx-1" />

          {/* Alignment Tools (Professional CAD style) */}
          <div className="flex items-center gap-0.5 bg-white border border-slate-300 rounded-sm p-0.5 mr-2">
            <button
              type="button"
              disabled={!selectedComponentId}
              onClick={() => handleAlign('left')}
              className="p-1 hover:bg-slate-100 text-slate-600 disabled:opacity-30"
              title="Align Left"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!selectedComponentId}
              onClick={() => handleAlign('center')}
              className="p-1 hover:bg-slate-100 text-slate-600 disabled:opacity-30"
              title="Center Horizontally"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!selectedComponentId}
              onClick={() => handleAlign('right')}
              className="p-1 hover:bg-slate-100 text-slate-600 disabled:opacity-30"
              title="Align Right"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-6 w-px bg-slate-300 mx-1" />

          {/* Zoom Controls */}
          <div className="flex items-center bg-white border border-slate-300 rounded-sm mr-2 h-7 overflow-hidden">
            <button
              type="button"
              onClick={() => setZoom(zoom - 0.1)}
              className="px-1.5 h-full hover:bg-slate-100 text-slate-600 border-r border-slate-200 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-2 h-full hover:bg-slate-100 text-[10px] font-mono text-slate-600 font-bold w-12 text-center"
              title="Reset Zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom(zoom + 0.1)}
              className="px-1.5 h-full hover:bg-slate-100 text-slate-600 border-l border-slate-200 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          <div className="h-6 w-px bg-slate-300 mx-1" />

          <div className="flex items-center gap-1 h-7 px-2 bg-white border border-slate-300 rounded-sm mr-2">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={schema.name}
              onChange={(e) => updateSchema({ name: e.target.value })}
              className="text-[11px] font-bold text-slate-700 bg-transparent border-none focus:ring-0 w-32 outline-none"
            />
          </div>

          <button type="button" className="pro-button flex items-center gap-1.5 mr-1 bg-white">
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => useDesignerStore.getState().toggleRightSidebar()}
            className={clsx(
              "p-2 rounded-sm border transition-all mr-1",
              useDesignerStore((state) => state.isRightSidebarOpen)
                ? "bg-blue-50 border-blue-200 text-blue-600 shadow-inner"
                : "bg-white border-slate-300 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
            title="Toggle Properties Panel"
          >
            <PanelRight className="w-4 h-4" />
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1 mr-2" />

          <button
            type="button"
            onClick={handleDownloadSource}
            className="pro-button flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            <Download className="w-3 h-3" />
            Source (.typ)
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="pro-button flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white border-blue-900 shadow-sm disabled:opacity-50"
          >
            {isExporting ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Play className="w-3 h-3 fill-current" />
            )}
            Run Final PDF
          </button>
        </div>
      </div>
    </div>
  );
});
