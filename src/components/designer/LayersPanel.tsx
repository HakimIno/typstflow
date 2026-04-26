'use client';

import React, { memo, useState } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  ChevronDown, 
  ChevronRight,
  Type,
  Image as ImageIcon,
  Table,
  Square,
  QrCode,
  GripVertical
} from 'lucide-react';
import { clsx } from 'clsx';
import type { ComponentNode } from '@/types/schema';

const ComponentIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'text': return <Type className="w-3.5 h-3.5" />;
    case 'image': return <ImageIcon className="w-3.5 h-3.5" />;
    case 'table': return <Table className="w-3.5 h-3.5" />;
    case 'rect': 
    case 'circle': return <Square className="w-3.5 h-3.5" />;
    case 'qrcode': return <QrCode className="w-3.5 h-3.5" />;
    default: return <Layers className="w-3.5 h-3.5" />;
  }
};

const LayerItem = memo(({ 
  component, 
  zoneKey,
}: { 
  component: ComponentNode; 
  zoneKey: 'header' | 'body' | 'footer';
}) => {
  const isSelected = useDesignerStore((state) => state.selectedComponentIds.includes(component.id));
  const isHidden = useDesignerStore((state) => state.hiddenComponentIds.includes(component.id));
  const isLocked = useDesignerStore((state) => state.lockedComponentIds.includes(component.id));
  
  const selectComponent = useDesignerStore((state) => state.selectComponent);
  const toggleVisibility = useDesignerStore((state) => state.toggleComponentVisibility);
  const toggleLock = useDesignerStore((state) => state.toggleComponentLock);
  const renameComponent = useDesignerStore((state) => state.renameComponent);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(component.name || component.type);

  const handleRename = () => {
    setIsEditing(false);
    renameComponent(component.id, name);
  };

  return (
    <div 
      className={clsx(
        "group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all duration-200 border-l-2",
        isSelected 
          ? "bg-blue-500/10 border-blue-500 text-blue-500" 
          : "border-transparent text-slate-400 hover:bg-slate-50/50 hover:text-slate-200"
      )}
      onClick={() => selectComponent(component.id)}
    >
      <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className={clsx(
        "p-1 rounded-md",
        isSelected ? "bg-blue-500/20" : "bg-slate-100"
      )}>
        <ComponentIcon type={component.type} />
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        {isEditing ? (
          <input
            autoFocus
            className="w-full bg-transparent border-none outline-none text-[11.5px] font-medium focus:ring-0 p-0"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
        ) : (
          <span 
            className="block text-[11.5px] font-medium truncate"
            onDoubleClick={() => setIsEditing(true)}
          >
            {component.name || (component.type === 'text' ? component.content : component.type)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={(e) => { e.stopPropagation(); toggleVisibility(component.id); }}
          className={clsx("p-1 hover:bg-slate-100 rounded", isHidden && "text-blue-500 opacity-100")}
          title={isHidden ? "Show" : "Hide"}
        >
          {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); toggleLock(component.id); }}
          className={clsx("p-1 hover:bg-slate-100 rounded", isLocked && "text-orange-500 opacity-100")}
          title={isLocked ? "Unlock" : "Lock"}
        >
          {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
});

const ZoneGroup = ({ 
  zoneKey, 
  label, 
  components 
}: { 
  zoneKey: 'header' | 'body' | 'footer'; 
  label: string; 
  components: ComponentNode[] 
}) => {
  const [isOpen, setIsOpen] = useState(true);

  if (components.length === 0) return null;

  return (
    <div className="mb-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {label}
        <span className="ml-auto text-[9px] bg-slate-100 px-1.5 rounded-full lowercase font-medium">
          {components.length}
        </span>
      </button>
      
      {isOpen && (
        <div className="space-y-px">
          {[...components].reverse().map((c, idx) => (
            <LayerItem 
              key={c.id} 
              component={c} 
              zoneKey={zoneKey} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const LayersPanel = memo(function LayersPanel() {
  const zones = useDesignerStore((state) => state.schema.zones);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-canvas)]">
      <div className="p-4 flex items-center gap-2 border-b border-[var(--border-subtle)]">
        <Layers className="w-4 h-4 text-blue-500" />
        <h2 className="text-sm font-bold text-slate-200">Layers</h2>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <ZoneGroup 
          zoneKey="header" 
          label="Report Header" 
          components={zones.header.components} 
        />
        <ZoneGroup 
          zoneKey="body" 
          label="Detail Band" 
          components={zones.body.components} 
        />
        <ZoneGroup 
          zoneKey="footer" 
          label="Page Footer" 
          components={zones.footer.components} 
        />

        {Object.values(zones).every(z => z.components.length === 0) && (
          <div className="flex flex-col items-center justify-center h-48 px-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
              <Layers className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-xs text-slate-400">No layers yet. Add components from the palette to see them here.</p>
          </div>
        )}
      </div>
    </div>
  );
});
