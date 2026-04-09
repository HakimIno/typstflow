'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { Palette } from '@/components/designer/Palette';
import { Canvas } from '@/components/designer/Canvas';
import { PropertiesPanel } from '@/components/designer/PropertiesPanel';
import { Toolbar } from '@/components/designer/Toolbar';
import { ReportTree } from '@/components/designer/推演/ReportTree'; // Wait, let me check the path
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { ComponentNode } from '@/types/schema';
import { PreviewPane } from '@/components/designer/PreviewPane';
import { DataPanel } from '@/components/designer/DataPanel';
import { ReportTree as ReportTreeComponent } from '@/components/designer/ReportTree';

export default function DesignerPage() {
  const { addComponent, moveComponent, schema, viewMode, activeTab } = useDesignerStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function createComponent(type: string): ComponentNode {
    const id = Math.random().toString(36).substring(7);
    const base: any = {
      id,
      type,
      style: { fontSize: 10, fontWeight: 'regular' },
      align: 'left',
    };

    switch (type) {
      case 'text':
        return { ...base, content: 'Text Block' };
      case 'table':
        return {
          ...base,
          content: '',
          dataSource: 'items',
          showHeader: true,
          columns: [
            { header: 'Item', field: 'description', width: '2fr' },
            { header: 'Qty', field: 'qty', width: '1fr' },
            { header: 'Price', field: 'price', width: '1fr' },
          ],
        } as any;
      case 'line':
        return { ...base, thickness: '1pt', color: 'black' } as any;
      case 'spacer':
        return { ...base, height: '1cm' } as any;
      case 'image':
        return { ...base, src: '', width: '4cm' } as any;
      default:
        return base;
    }
  }

  useEffect(() => {
    if (!mounted) return;
    
    return monitorForElements({
      onDrop({ source, location }) {
        const destination = location.current.dropTargets[0];
        if (!destination) return;

        const zoneKey = destination.data.zoneKey as 'header' | 'body' | 'footer';
        const sourceData = source.data;

        if (sourceData.type === 'palette-item') {
          const newComponent = createComponent(sourceData.componentType as string);
          addComponent(zoneKey, newComponent);
        } else if (sourceData.type === 'canvas-item') {
          const itemId = sourceData.id as string;
          const fromZone = sourceData.zoneKey as any;
          moveComponent(itemId, fromZone, zoneKey, schema.zones[zoneKey].components.length);
        }
      },
    });
  }, [mounted, addComponent, moveComponent, schema.zones]);

  if (!mounted) return null;

  const renderLeftPanel = () => {
    switch (activeTab) {
      case 'palette': return <Palette />;
      case 'outline': return <ReportTreeComponent />;
      case 'data': return <DataPanel />;
      default: return <Palette />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-200 overflow-hidden font-sans">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden p-0.5 gap-0.5">
        
        {/* Left Sidebar: Dynamic Panels */}
        <aside className="w-56 flex flex-col pro-panel overflow-hidden border-r border-slate-300 shadow-sm">
          {renderLeftPanel()}
        </aside>
        
        {/* Center: Workspace (Design / Preview / Split) */}
        <div className="flex-1 flex overflow-hidden gap-0.5">
           {(viewMode === 'design' || viewMode === 'split') && (
             <main className="flex-1 overflow-auto bg-slate-300 shadow-inner flex justify-center p-0 transition-all border-r border-slate-400/20">
                <Canvas />
             </main>
           )}
           
           {(viewMode === 'preview' || viewMode === 'split') && (
             <div className="flex-1 flex overflow-hidden bg-slate-200">
                <PreviewPane />
             </div>
           )}
        </div>
        
        {/* Right Sidebar: Properties */}
        <aside className="w-64 pro-panel overflow-hidden border-l border-slate-300 shadow-sm">
          <PropertiesPanel />
        </aside>
      </div>

      {/* Status Bar */}
      <footer className="h-6 bg-slate-700 text-slate-300 px-3 flex items-center justify-between text-[10px] uppercase tracking-wider font-bold shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 border-r border-slate-600 pr-4">
             <div className="w-2 h-2 bg-green-500 rounded-full" />
             <span>Status: Ready</span>
          </div>
          <span className="opacity-50">Report: {schema.name}</span>
        </div>
        <div className="flex gap-4">
          <span>{schema.page.size} {schema.page.orientation}</span>
          <span className="opacity-50">v{schema.version}</span>
        </div>
      </footer>
    </div>
  );
}
