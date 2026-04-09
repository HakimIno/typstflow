'use client';

import React from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { Save, Download, Undo, Redo, Eye, FileText, ChevronDown, Play, Layout, Cpu, Search } from 'lucide-react';
import { clsx } from 'clsx';

export function Toolbar() {
  const { schema, updateSchema, viewMode, setViewMode, activeTab, setActiveTab, sampleData } = useDesignerStore();

  const handleExport = async () => {
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema,
          data: sampleData
        }),
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${schema.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export PDF');
    }
  };

  return (
    <div className="flex flex-col flex-shrink-0">
      {/* Top Main Toolbar */}
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
        </div>

        {/* View Switcher (Center Segment Control) */}
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

      {/* Sub Toolbar: Actions & Tab Switcher */}
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
