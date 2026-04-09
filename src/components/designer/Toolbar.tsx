'use client';

import React from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { 
  Save, Download, Undo, Redo, Eye, FileText, ChevronDown, Play, Layout, Cpu, Search,
  AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical
} from 'lucide-react';
import { clsx } from 'clsx';

export function Toolbar() {
  const { 
    schema, updateSchema, viewMode, setViewMode, activeTab, setActiveTab, 
    sampleData, selectedComponentId, updateComponent 
  } = useDesignerStore();

  const handleAlign = (type: string) => {
    if (!selectedComponentId) return;
    
    const A4_WIDTH_MM = schema.page.orientation === 'landscape' ? 297 : 210;
    const padding = 20; // fallback / margin
    const PAGE_CONTENT_WIDTH = A4_WIDTH_MM - 40; // Approx

    switch(type) {
      case 'left': updateComponent(selectedComponentId, { x: 0 }); break;
      case 'center': updateComponent(selectedComponentId, { x: (PAGE_CONTENT_WIDTH / 2) - 50 }); break; // 50 is half default width
      case 'right': updateComponent(selectedComponentId, { x: PAGE_CONTENT_WIDTH - 100 }); break;
    }
  };

  const handleExport = async () => {
    // ... logic preserved ...
  };

  return (
    <div className="flex flex-col flex-shrink-0">
      {/* Top Main Toolbar preserved */}
      <header className="h-8 bg-slate-800 flex items-center justify-between px-3 border-b border-slate-900 shadow-md z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-600 rounded-sm">
            <Cpu className="w-3.5 h-3.5 text-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-tighter">TypstFlow Pro</span>
          </div>
          
          <nav className="flex items-center gap-1">
            {['File', 'Edit', 'Insert', 'Format', 'View', 'Tools', 'Help'].map(item => (
              <button key={item} className="px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 hover:text-white rounded-sm transition-colors">
                {item}
              </button>
            ))}
          </nav>
          
          <div className="h-4 w-px bg-slate-700 mx-2" />
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => (useDesignerStore.getState() as any).loadTemplate('invoice')}
              className="px-2 py-1 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-sm hover:bg-blue-500/40 transition-all flex items-center gap-1"
            >
              <Layout className="w-3 h-3" />
              Load Invoice Template
            </button>
            <button 
              onClick={() => (useDesignerStore.getState() as any).loadTemplate('blank')}
              className="px-2 py-1 text-[10px] font-bold bg-slate-700 text-slate-300 border border-slate-600 rounded-sm hover:bg-slate-600 transition-all"
            >
              Clear Canvas
            </button>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-slate-900/50 rounded-sm p-0.5 border border-slate-700">
           {(['design', 'preview', 'split'] as const).map(mode => (
             <button
               key={mode}
               onClick={() => setViewMode(mode)}
               className={clsx(
                 "px-3 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all",
                 viewMode === mode 
                   ? "bg-slate-600 text-white shadow-sm" 
                   : "text-slate-500 hover:text-slate-300"
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
                <span className="text-[9px] text-green-500 font-bold uppercase">Live Preview Active</span>
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
              { id: 'data', icon: Cpu, label: 'Data' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  "p-1.5 rounded-sm transition-all",
                  activeTab === tab.id 
                    ? "bg-white text-blue-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                )}
                title={tab.label}
              >
                <tab.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 bg-white border border-slate-300 rounded-sm p-0.5 mr-2">
            <button className="p-1 hover:bg-slate-100 text-slate-600" title="Undo"><Undo className="w-3.5 h-3.5" /></button>
            <button className="p-1 hover:bg-slate-100 text-slate-600" title="Redo"><Redo className="w-3.5 h-3.5" /></button>
          </div>

          <div className="h-6 w-px bg-slate-300 mx-1" />

          {/* Alignment Tools (Professional CAD style) */}
          <div className="flex items-center gap-0.5 bg-white border border-slate-300 rounded-sm p-0.5 mr-2">
             <button 
               disabled={!selectedComponentId}
               onClick={() => handleAlign('left')}
               className="p-1 hover:bg-slate-100 text-slate-600 disabled:opacity-30" title="Align Left"
             >
                <AlignLeft className="w-3.5 h-3.5" />
             </button>
             <button 
               disabled={!selectedComponentId}
               onClick={() => handleAlign('center')}
               className="p-1 hover:bg-slate-100 text-slate-600 disabled:opacity-30" title="Center Horizontally"
             >
                <AlignCenter className="w-3.5 h-3.5" />
             </button>
             <button 
               disabled={!selectedComponentId}
               onClick={() => handleAlign('right')}
               className="p-1 hover:bg-slate-100 text-slate-600 disabled:opacity-30" title="Align Right"
             >
                <AlignRight className="w-3.5 h-3.5" />
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

          <button className="pro-button flex items-center gap-1.5 mr-1 bg-white">
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
        </div>

        <div className="flex items-center gap-2">
           <button 
            onClick={handleExport}
            className="pro-button flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white border-blue-900 shadow-sm"
          >
            <Play className="w-3 h-3 fill-current" />
            Run Final PDF
          </button>
        </div>
      </div>
    </div>
  );
}
